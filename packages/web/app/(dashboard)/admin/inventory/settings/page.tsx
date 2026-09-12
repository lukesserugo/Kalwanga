// D:\Projects\Kalwanga\packages\web\app\(dashboard)\inventory\settings\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Save, RefreshCw, AlertTriangle,
  Bell, MapPin, Tag, Package, DollarSign,
  Truck, Users, Clock, Shield, Check, X,
  Loader2, Lock, Building2, Database, Globe,
  Mail, Phone, Hash, Calendar, Percent,
  Weight, FileText, ChevronDown, ChevronUp,
  Info, HelpCircle, AlertCircle, CheckCircle,
  ArrowLeft, Eye, EyeOff, Zap, Star, Award,
  ClipboardList, BarChart3, PieChart, TrendingUp,
  TrendingDown, ShoppingCart, Warehouse
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { toast } from '../../../../../utils/toast-manager';
import { PermissionResource } from '../../../../../types/enums';
import { inventoryService } from '../../../../../services/inventoryService';
import { formatCurrency, formatDate } from '../../../../../utils/formatters';

// ============================================
// TYPES
// ============================================

interface SettingsData {
  // Default Values
  defaultReorderPoint: number;
  defaultReorderQuantity: number;
  defaultLocation: string;
  defaultSupplier: string;
  defaultUnit: string;
  defaultTaxRate: number;
  defaultWeight: number;
  
  // Alerts & Notifications
  lowStockAlertThreshold: number;
  enableLowStockAlerts: boolean;
  enableEmailNotifications: boolean;
  enableSMSNotifications: boolean;
  notificationEmail: string;
  notificationPhone: string;
  
  // Auto-Reorder
  enableAutoReorder: boolean;
  autoReorderDays: number;
  autoReorderQuantity: number;
  
  // Advanced Settings
  enableBarcodeScanning: boolean;
  enableQrGeneration: boolean;
  enableStockTracking: boolean;
  enableBatchTracking: boolean;
  enableExpiryTracking: boolean;
  enableSerialTracking: boolean;
  enableMultiLocation: boolean;
  
  // Preferences
  defaultViewMode: 'table' | 'grid' | 'compact';
  itemsPerPage: number;
  showLowStockBadge: boolean;
  showBarcodeInList: boolean;
  showImagesInList: boolean;
  defaultSortField: string;
  defaultSortOrder: 'asc' | 'desc';
  
  // Integrations
  enableSupplierSync: boolean;
  enableCategorySync: boolean;
  enablePricingSync: boolean;
}

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
  fields: string[];
}

// ============================================
// CONSTANTS
// ============================================

const SECTIONS: SettingsSection[] = [
  {
    id: 'defaults',
    title: 'Default Values',
    icon: Tag,
    description: 'Configure default settings for new inventory items',
    fields: ['defaultReorderPoint', 'defaultReorderQuantity', 'defaultLocation', 'defaultSupplier', 'defaultUnit', 'defaultTaxRate', 'defaultWeight'],
  },
  {
    id: 'alerts',
    title: 'Alerts & Notifications',
    icon: Bell,
    description: 'Configure stock alerts and notification preferences',
    fields: ['lowStockAlertThreshold', 'enableLowStockAlerts', 'enableEmailNotifications', 'enableSMSNotifications', 'notificationEmail', 'notificationPhone'],
  },
  {
    id: 'autoreorder',
    title: 'Auto-Reorder',
    icon: RefreshCw,
    description: 'Automate reordering when stock levels are low',
    fields: ['enableAutoReorder', 'autoReorderDays', 'autoReorderQuantity'],
  },
  {
    id: 'advanced',
    title: 'Advanced Settings',
    icon: Shield,
    description: 'Advanced inventory management features',
    fields: ['enableBarcodeScanning', 'enableQrGeneration', 'enableStockTracking', 'enableBatchTracking', 'enableExpiryTracking', 'enableSerialTracking', 'enableMultiLocation'],
  },
  {
    id: 'preferences',
    title: 'Preferences',
    icon: Settings,
    description: 'Customize your inventory management experience',
    fields: ['defaultViewMode', 'itemsPerPage', 'showLowStockBadge', 'showBarcodeInList', 'showImagesInList', 'defaultSortField', 'defaultSortOrder'],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    icon: Globe,
    description: 'Connect with external systems and services',
    fields: ['enableSupplierSync', 'enableCategorySync', 'enablePricingSync'],
  },
];

const UNITS = [
  { value: 'each', label: 'Each' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'l', label: 'Liter (L)' },
  { value: 'ml', label: 'Milliliter (mL)' },
  { value: 'box', label: 'Box' },
  { value: 'pack', label: 'Pack' },
  { value: 'piece', label: 'Piece' },
  { value: 'carton', label: 'Carton' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'set', label: 'Set' },
  { value: 'roll', label: 'Roll' },
  { value: 'meter', label: 'Meter' },
  { value: 'square_meter', label: 'Square Meter' },
  { value: 'cubic_meter', label: 'Cubic Meter' },
];

const VIEW_MODES = [
  { value: 'table', label: 'Table View' },
  { value: 'grid', label: 'Grid View' },
  { value: 'compact', label: 'Compact View' },
];

const SORT_FIELDS = [
  { value: 'name', label: 'Name' },
  { value: 'sku', label: 'SKU' },
  { value: 'stock', label: 'Stock' },
  { value: 'price', label: 'Price' },
  { value: 'value', label: 'Total Value' },
  { value: 'createdAt', label: 'Created Date' },
  { value: 'updatedAt', label: 'Last Updated' },
];

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100, 200];

// ============================================
// SUB-COMPONENTS
// ============================================

const SectionToggle: React.FC<{
  section: SettingsSection;
  isActive: boolean;
  onClick: () => void;
}> = ({ section, isActive, onClick }) => {
  const Icon = section.icon;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
          : 'bg-gray-50 dark:bg-gray-700/30 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 border border-transparent'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{section.title}</span>
    </button>
  );
};

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, description, disabled = false }) => {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
    </div>
  );
};

const SettingInput: React.FC<{
  label: string;
  value: string | number;
  onChange: (value: any) => void;
  type?: 'text' | 'number' | 'select' | 'email' | 'tel';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  disabled?: boolean;
}> = ({
  label,
  value,
  onChange,
  type = 'text',
  options = [],
  placeholder,
  min,
  max,
  step,
  description,
  disabled = false,
}) => {
  const baseClasses = "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors disabled:opacity-50";

  if (type === 'select') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={baseClasses + " border-gray-300 dark:border-gray-600"}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={baseClasses + ` ${type === 'number' ? 'border-gray-300 dark:border-gray-600' : 'border-gray-300 dark:border-gray-600'}`}
      />
      {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function InventorySettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermission();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeSection, setActiveSection] = useState('defaults');
  const [settings, setSettings] = useState<SettingsData>({
    defaultReorderPoint: 5,
    defaultReorderQuantity: 10,
    defaultLocation: 'Warehouse',
    defaultSupplier: '',
    defaultUnit: 'each',
    defaultTaxRate: 0,
    defaultWeight: 0,
    lowStockAlertThreshold: 20,
    enableLowStockAlerts: true,
    enableEmailNotifications: true,
    enableSMSNotifications: false,
    notificationEmail: '',
    notificationPhone: '',
    enableAutoReorder: false,
    autoReorderDays: 7,
    autoReorderQuantity: 10,
    enableBarcodeScanning: true,
    enableQrGeneration: true,
    enableStockTracking: true,
    enableBatchTracking: false,
    enableExpiryTracking: false,
    enableSerialTracking: false,
    enableMultiLocation: true,
    defaultViewMode: 'table',
    itemsPerPage: 20,
    showLowStockBadge: true,
    showBarcodeInList: true,
    showImagesInList: true,
    defaultSortField: 'name',
    defaultSortOrder: 'asc',
    enableSupplierSync: false,
    enableCategorySync: false,
    enablePricingSync: false,
  });
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || 
                          (user?.businessUnits?.[0] as any)?.id || 
                          localStorage.getItem('businessUnitId') || '';

  const canManageSettings = hasPermission(`${PermissionResource.INVENTORY}:manage`) || user?.role === 'SUPER_ADMIN';

  // ============================================
  // LOAD SETTINGS
  // ============================================

  const loadSettings = useCallback(async () => {
    if (!businessUnitId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Load settings from API
      // const data = await inventoryService.getSettings(businessUnitId);
      // if (data) setSettings(data);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setSuccess(false);
    } catch (error: any) {
      console.error('Failed to load settings:', error);
      setError(error?.message || 'Failed to load settings');
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessUnitId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSettings();
    toast.success('Settings refreshed');
  };

  // ============================================
  // SAVE SETTINGS
  // ============================================

  const validateSettings = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (settings.defaultReorderPoint < 0) {
      errors.defaultReorderPoint = 'Reorder point cannot be negative';
    }
    if (settings.defaultReorderQuantity < 0) {
      errors.defaultReorderQuantity = 'Reorder quantity cannot be negative';
    }
    if (settings.lowStockAlertThreshold < 0 || settings.lowStockAlertThreshold > 100) {
      errors.lowStockAlertThreshold = 'Threshold must be between 0 and 100';
    }
    if (settings.autoReorderDays < 1) {
      errors.autoReorderDays = 'Auto-reorder days must be at least 1';
    }
    if (settings.itemsPerPage < 1) {
      errors.itemsPerPage = 'Items per page must be at least 1';
    }
    if (settings.notificationEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.notificationEmail)) {
      errors.notificationEmail = 'Please enter a valid email address';
    }
    if (settings.notificationPhone && !/^\+?[\d\s-]{10,}$/.test(settings.notificationPhone)) {
      errors.notificationPhone = 'Please enter a valid phone number';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateSettings()) {
      const firstError = Object.values(validationErrors)[0];
      toast.error(firstError);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);
    
    try {
      // await inventoryService.updateSettings(settings);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setSuccess(true);
      setUnsavedChanges(false);
      toast.success('Settings saved successfully');
      
      // Auto-hide success message
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      setError(error?.message || 'Failed to save settings');
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSettingsChange = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setUnsavedChanges(true);
    if (validationErrors[key as string]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key as string];
        return newErrors;
      });
    }
  };

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    if (isAuthenticated && businessUnitId && canManageSettings) {
      loadSettings();
    }
  }, [isAuthenticated, businessUnitId, canManageSettings, loadSettings]);

  // ============================================
  // PERMISSION GUARD
  // ============================================

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Please Login</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You need to be logged in to manage settings.</p>
        <button 
          onClick={() => router.push('/login')} 
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Login
        </button>
      </div>
    );
  }

  if (!canManageSettings) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to manage inventory settings.</p>
        <button 
          onClick={() => router.push('/admin/inventory')} 
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to Inventory
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  const renderSection = (sectionId: string) => {
    switch (sectionId) {
      case 'defaults':
        return (
          <div className="space-y-4">
            <SettingInput
              label="Default Reorder Point"
              value={settings.defaultReorderPoint}
              onChange={(v) => handleSettingsChange('defaultReorderPoint', v)}
              type="number"
              min={0}
              description="Minimum stock level before reorder"
              disabled={saving}
            />
            <SettingInput
              label="Default Reorder Quantity"
              value={settings.defaultReorderQuantity}
              onChange={(v) => handleSettingsChange('defaultReorderQuantity', v)}
              type="number"
              min={0}
              description="Default quantity to reorder"
              disabled={saving}
            />
            <SettingInput
              label="Default Location"
              value={settings.defaultLocation}
              onChange={(v) => handleSettingsChange('defaultLocation', v)}
              type="text"
              placeholder="Enter default location"
              disabled={saving}
            />
            <SettingInput
              label="Default Supplier"
              value={settings.defaultSupplier}
              onChange={(v) => handleSettingsChange('defaultSupplier', v)}
              type="text"
              placeholder="Enter default supplier"
              disabled={saving}
            />
            <SettingInput
              label="Default Unit"
              value={settings.defaultUnit}
              onChange={(v) => handleSettingsChange('defaultUnit', v)}
              type="select"
              options={UNITS}
              disabled={saving}
            />
            <SettingInput
              label="Default Tax Rate (%)"
              value={settings.defaultTaxRate}
              onChange={(v) => handleSettingsChange('defaultTaxRate', v)}
              type="number"
              min={0}
              max={100}
              step={0.1}
              description="Default tax rate for new items"
              disabled={saving}
            />
            <SettingInput
              label="Default Weight (kg)"
              value={settings.defaultWeight}
              onChange={(v) => handleSettingsChange('defaultWeight', v)}
              type="number"
              min={0}
              step={0.001}
              description="Default weight for new items"
              disabled={saving}
            />
          </div>
        );

      case 'alerts':
        return (
          <div className="space-y-4">
            <SettingInput
              label="Low Stock Alert Threshold (%)"
              value={settings.lowStockAlertThreshold}
              onChange={(v) => handleSettingsChange('lowStockAlertThreshold', v)}
              type="number"
              min={0}
              max={100}
              description="Alert when stock falls below this percentage of reorder point"
              disabled={saving}
            />
            <ToggleSwitch
              checked={settings.enableLowStockAlerts}
              onChange={(v) => handleSettingsChange('enableLowStockAlerts', v)}
              label="Enable Low Stock Alerts"
              description="Get notified when stock levels are low"
              disabled={saving}
            />
            <ToggleSwitch
              checked={settings.enableEmailNotifications}
              onChange={(v) => handleSettingsChange('enableEmailNotifications', v)}
              label="Email Notifications"
              description="Receive alerts via email"
              disabled={saving}
            />
            {settings.enableEmailNotifications && (
              <SettingInput
                label="Notification Email"
                value={settings.notificationEmail}
                onChange={(v) => handleSettingsChange('notificationEmail', v)}
                type="email"
                placeholder="admin@company.com"
                disabled={saving}
              />
            )}
            <ToggleSwitch
              checked={settings.enableSMSNotifications}
              onChange={(v) => handleSettingsChange('enableSMSNotifications', v)}
              label="SMS Notifications"
              description="Receive alerts via SMS"
              disabled={saving}
            />
            {settings.enableSMSNotifications && (
              <SettingInput
                label="Notification Phone"
                value={settings.notificationPhone}
                onChange={(v) => handleSettingsChange('notificationPhone', v)}
                type="tel"
                placeholder="+1 234 567 8900"
                disabled={saving}
              />
            )}
          </div>
        );

      case 'autoreorder':
        return (
          <div className="space-y-4">
            <ToggleSwitch
              checked={settings.enableAutoReorder}
              onChange={(v) => handleSettingsChange('enableAutoReorder', v)}
              label="Enable Auto-Reorder"
              description="Automatically create purchase orders for low stock items"
              disabled={saving}
            />
            {settings.enableAutoReorder && (
              <>
                <SettingInput
                  label="Auto-Reorder Days"
                  value={settings.autoReorderDays}
                  onChange={(v) => handleSettingsChange('autoReorderDays', v)}
                  type="number"
                  min={1}
                  description="Check stock levels every X days"
                  disabled={saving}
                />
                <SettingInput
                  label="Auto-Reorder Quantity"
                  value={settings.autoReorderQuantity}
                  onChange={(v) => handleSettingsChange('autoReorderQuantity', v)}
                  type="number"
                  min={1}
                  description="Quantity to reorder when stock is low"
                  disabled={saving}
                />
              </>
            )}
          </div>
        );

      case 'advanced':
        return (
          <div className="space-y-4">
            <ToggleSwitch
              checked={settings.enableBarcodeScanning}
              onChange={(v) => handleSettingsChange('enableBarcodeScanning', v)}
              label="Barcode Scanning"
              description="Enable barcode scanning for inventory items"
              disabled={saving}
            />
            <ToggleSwitch
              checked={settings.enableQrGeneration}
              onChange={(v) => handleSettingsChange('enableQrGeneration', v)}
              label="QR Code Generation"
              description="Generate QR codes for inventory items"
              disabled={saving}
            />
            <ToggleSwitch
              checked={settings.enableStockTracking}
              onChange={(v) => handleSettingsChange('enableStockTracking', v)}
              label="Stock Tracking"
              description="Track stock movements and history"
              disabled={saving}
            />
            <ToggleSwitch
              checked={settings.enableBatchTracking}
              onChange={(v) => handleSettingsChange('enableBatchTracking', v)}
              label="Batch Tracking"
              description="Track inventory by batch numbers"
              disabled={saving}
            />
            <ToggleSwitch
              checked={settings.enableExpiryTracking}
              onChange={(v) => handleSettingsChange('enableExpiryTracking', v)}
              label="Expiry Tracking"
              description="Track expiry dates for perishable items"
              disabled={saving}
            />
            <ToggleSwitch
              checked={settings.enableSerialTracking}
              onChange={(v) => handleSettingsChange('enableSerialTracking', v)}
              label="Serial Tracking"
              description="Track inventory by serial numbers"
              disabled={saving}
            />
            <ToggleSwitch
              checked={settings.enableMultiLocation}
              onChange={(v) => handleSettingsChange('enableMultiLocation', v)}
              label="Multi-Location"
              description="Manage inventory across multiple locations"
              disabled={saving}
            />
          </div>
        );

      case 'preferences':
        return (
          <div className="space-y-4">
            <SettingInput
              label="Default View Mode"
              value={settings.defaultViewMode}
              onChange={(v) => handleSettingsChange('defaultViewMode', v)}
              type="select"
              options={VIEW_MODES}
              disabled={saving}
            />
            <SettingInput
              label="Items Per Page"
              value={settings.itemsPerPage}
              onChange={(v) => handleSettingsChange('itemsPerPage', v)}
              type="select"
              options={ITEMS_PER_PAGE_OPTIONS.map(v => ({ value: v.toString(), label: v.toString() }))}
              disabled={saving}
            />
            <ToggleSwitch
              checked={settings.showLowStockBadge}
              onChange={(v) => handleSettingsChange('showLowStockBadge', v)}
              label="Show Low Stock Badge"
              description="Display a badge for low stock items"
              disabled={saving}
            />
            <ToggleSwitch
              checked={settings.showBarcodeInList}
              onChange={(v) => handleSettingsChange('showBarcodeInList', v)}
              label="Show Barcode in List"
              description="Display barcode in the inventory list"
              disabled={saving}
            />
            <ToggleSwitch
              checked={settings.showImagesInList}
              onChange={(v) => handleSettingsChange('showImagesInList', v)}
              label="Show Images in List"
              description="Display product images in the inventory list"
              disabled={saving}
            />
            <SettingInput
              label="Default Sort Field"
              value={settings.defaultSortField}
              onChange={(v) => handleSettingsChange('defaultSortField', v)}
              type="select"
              options={SORT_FIELDS}
              disabled={saving}
            />
            <SettingInput
              label="Default Sort Order"
              value={settings.defaultSortOrder}
              onChange={(v) => handleSettingsChange('defaultSortOrder', v)}
              type="select"
              options={[
                { value: 'asc', label: 'Ascending' },
                { value: 'desc', label: 'Descending' },
              ]}
              disabled={saving}
            />
          </div>
        );

      case 'integrations':
        return (
          <div className="space-y-4">
            <ToggleSwitch
              checked={settings.enableSupplierSync}
              onChange={(v) => handleSettingsChange('enableSupplierSync', v)}
              label="Supplier Sync"
              description="Synchronize supplier data with external systems"
              disabled={saving}
            />
            <ToggleSwitch
              checked={settings.enableCategorySync}
              onChange={(v) => handleSettingsChange('enableCategorySync', v)}
              label="Category Sync"
              description="Synchronize category data with external systems"
              disabled={saving}
            />
            <ToggleSwitch
              checked={settings.enablePricingSync}
              onChange={(v) => handleSettingsChange('enablePricingSync', v)}
              label="Pricing Sync"
              description="Synchronize pricing data with external systems"
              disabled={saving}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <button
            onClick={() => router.push('/admin/inventory')}
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Inventory
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Settings className="w-8 h-8 text-blue-500" />
            Inventory Settings
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Configure inventory defaults and preferences</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing || saving}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {unsavedChanges && (
            <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Unsaved changes
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
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
          className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-3"
        >
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          <p className="text-sm text-green-700 dark:text-green-300">Settings saved successfully!</p>
        </motion.div>
      )}

      {/* Settings Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Navigation Tabs */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-1.5 overflow-x-auto">
          {SECTIONS.map((section) => (
            <SectionToggle
              key={section.id}
              section={section}
              isActive={activeSection === section.id}
              onClick={() => setActiveSection(section.id)}
            />
          ))}
        </div>

        {/* Section Content */}
        <div className="p-6">
          {SECTIONS.map((section) => (
            <div
              key={section.id}
              className={activeSection === section.id ? 'block' : 'hidden'}
            >
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <section.icon className="w-5 h-5 text-blue-500" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{section.title}</h2>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{section.description}</p>
                {businessUnitId && (
                  <p className="text-xs text-gray-400 mt-1">
                    Business Unit: {businessUnitId.slice(0, 8)}...
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderSection(section.id)}
              </div>
            </div>
          ))}

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-400 dark:text-gray-500">
              {businessUnitId && (
                <span>Settings apply to: Business Unit {businessUnitId.slice(0, 8)}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  setActiveSection('defaults');
                  loadSettings();
                  setUnsavedChanges(false);
                  toast.info('Settings reset to saved values');
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                disabled={saving}
              >
                Reset to Saved
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
