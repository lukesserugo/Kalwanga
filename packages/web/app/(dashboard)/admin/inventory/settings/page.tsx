// D:\Projects\Kalwanga\packages\web\app\(dashboard)\inventory\settings\page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Settings, Save, RefreshCw, AlertTriangle,
  Bell, MapPin, Tag, Package, DollarSign,
  Truck, Users, Clock, Shield, Check, X,
  Loader2, Lock
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { toast } from '../../../../../utils/toast-manager';

interface SettingsData {
  defaultReorderPoint: number;
  defaultReorderQuantity: number;
  defaultLocation: string;
  lowStockAlertThreshold: number;
  enableAutoReorder: boolean;
  autoReorderDays: number;
  defaultSupplier: string;
  enableLowStockAlerts: boolean;
  enableEmailNotifications: boolean;
  enableSMSNotifications: boolean;
}

export default function InventorySettingsPage() {
  const router = useRouter();
  const { user, canManageSettings } = useAuth();
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
    enableLowStockAlerts: true,
    enableEmailNotifications: true,
    enableSMSNotifications: false,
  });

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || '';

  // Check permission
  if (!canManageSettings) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to manage settings.</p>
      </div>
    );
  }

  useEffect(() => {
    loadSettings();
  }, [businessUnitId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // Load settings from API
      // const data = await inventoryService.getSettings(businessUnitId);
      // setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load settings');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Settings className="w-8 h-8 text-blue-500" />
              Inventory Settings
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Configure inventory defaults and preferences</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* Settings Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700"
        >
          {/* Default Values */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Tag className="w-5 h-5 text-blue-500" />
              Default Values
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Default Reorder Point
                </label>
                <input
                  type="number"
                  value={settings.defaultReorderPoint}
                  onChange={(e) => setSettings({ ...settings, defaultReorderPoint: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  min="0"
                />
                <p className="text-xs text-gray-400 mt-1">Minimum stock level before reorder</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Default Reorder Quantity
                </label>
                <input
                  type="number"
                  value={settings.defaultReorderQuantity}
                  onChange={(e) => setSettings({ ...settings, defaultReorderQuantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  min="0"
                />
                <p className="text-xs text-gray-400 mt-1">Default quantity to reorder</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Default Location
                </label>
                <input
                  type="text"
                  value={settings.defaultLocation}
                  onChange={(e) => setSettings({ ...settings, defaultLocation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter default location"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Default Supplier
                </label>
                <input
                  type="text"
                  value={settings.defaultSupplier}
                  onChange={(e) => setSettings({ ...settings, defaultSupplier: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter default supplier"
                />
              </div>
            </div>
          </div>

          {/* Alerts & Notifications */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-500" />
              Alerts & Notifications
            </h3>
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Low Stock Alert Threshold (%)
                </label>
                <input
                  type="number"
                  value={settings.lowStockAlertThreshold}
                  onChange={(e) => setSettings({ ...settings, lowStockAlertThreshold: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  min="0"
                  max="100"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Alert when stock falls below this percentage of reorder point
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.enableLowStockAlerts}
                  onChange={(e) => setSettings({ ...settings, enableLowStockAlerts: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Enable Low Stock Alerts</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.enableEmailNotifications}
                  onChange={(e) => setSettings({ ...settings, enableEmailNotifications: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Email Notifications</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.enableSMSNotifications}
                  onChange={(e) => setSettings({ ...settings, enableSMSNotifications: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">SMS Notifications</span>
              </div>
            </div>
          </div>

          {/* Auto-Reorder */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-500" />
              Auto-Reorder
            </h3>
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.enableAutoReorder}
                  onChange={(e) => setSettings({ ...settings, enableAutoReorder: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    min="1"
                  />
                  <p className="text-xs text-gray-400 mt-1">Check stock levels every X days</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
