// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\barcodes\settings\page.tsx

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Loader2,
  Settings,
  Barcode,
  QrCode,
  RefreshCw,
  CheckCircle,
  Lock,
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { toast } from '../../../../../utils/toast-manager';
import { PermissionResource } from '../../../../../types/enums';

export default function BarcodeSettingsPage() {
  const router = useRouter();
  const { canManage, isLoading: permissionLoading } = usePermission();
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [settings, setSettings] = useState({
    barcodeFormat: 'EAN13',
    qrCodeSize: 300,
    barcodeWidth: 2,
    barcodeHeight: 100,
    autoGenerate: true,
    includePrice: true,
    includeName: true,
  });

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const canManageSettings = canManage(PermissionResource.SETTINGS);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Save settings (implement with your API)
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  if (permissionLoading || !isClient) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!canManageSettings) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          You don't have permission to manage settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto animate-fade-in">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/admin/barcodes')}
          className="p-2 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-brand-500" />
            Barcode Settings
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configure barcode and QR code settings
          </p>
        </div>
      </div>

      <div className="card-brand space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Barcode Settings
          </h3>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Barcode Format
              </label>
              <select
                value={settings.barcodeFormat}
                onChange={(e) =>
                  setSettings({ ...settings, barcodeFormat: e.target.value })
                }
                className="input-brand"
              >
                <option value="EAN13">EAN-13</option>
                <option value="CODE128">Code 128</option>
                <option value="QR">QR Code</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Barcode Width
                </label>
                <input
                  type="number"
                  value={settings.barcodeWidth}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      barcodeWidth: parseInt(e.target.value) || 2,
                    })
                  }
                  min="1"
                  max="5"
                  className="input-brand tabular-nums"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Barcode Height
                </label>
                <input
                  type="number"
                  value={settings.barcodeHeight}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      barcodeHeight: parseInt(e.target.value) || 100,
                    })
                  }
                  min="50"
                  max="200"
                  className="input-brand tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                QR Code Size
              </label>
              <input
                type="number"
                value={settings.qrCodeSize}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    qrCodeSize: parseInt(e.target.value) || 300,
                  })
                }
                min="100"
                max="500"
                className="input-brand tabular-nums"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Display Settings
          </h3>
          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoGenerate}
                onChange={(e) =>
                  setSettings({ ...settings, autoGenerate: e.target.checked })
                }
                className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 focus:outline-none"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Auto-generate barcode for new products
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.includePrice}
                onChange={(e) =>
                  setSettings({ ...settings, includePrice: e.target.checked })
                }
                className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 focus:outline-none"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Include price on barcode label
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.includeName}
                onChange={(e) =>
                  setSettings({ ...settings, includeName: e.target.checked })
                }
                className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 focus:outline-none"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Include product name on barcode label
              </span>
            </label>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 flex justify-end gap-3">
          <button
            onClick={() => router.push('/admin/barcodes')}
            className="btn-secondary focus-ring"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg disabled:opacity-50 flex items-center gap-2 transition-all focus-ring"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
