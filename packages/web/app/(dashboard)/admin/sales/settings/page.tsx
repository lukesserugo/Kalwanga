// packages/web/app/(dashboard)/admin/sales/settings/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Save,
  RefreshCw,
  DollarSign,
  Receipt,
  Users,
  Loader2,
} from 'lucide-react';
import {
  saleService,
  type SalesSettings,
} from '../../../../../services/saleService';
import { toast } from '../../../../../utils/toast-manager';

const DEFAULT_SETTINGS: SalesSettings = {
  taxRate: 8,
  discountEnabled: true,
  maxDiscount: 20,
  loyaltyPointsEnabled: true,
  pointsPerDollar: 10,
  autoPrintReceipt: true,
  emailReceipts: true,
  receiptFooter: 'Thank you for your business!',
  defaultPaymentMethod: 'CASH',
  currencyCode: 'USD',
  // `currencySymbol` is derived server-side from `currencyCode` and
  // is optional. Not part of the persisted payload.
  invoicePrefix: 'INV-',
  receiptPrefix: 'RCP-',
};

export default function SalesSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SalesSettings>(DEFAULT_SETTINGS);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await saleService.getSalesSettings();
      setSettings({ ...DEFAULT_SETTINGS, ...(data || {}) });
    } catch (error: any) {
      console.error('Failed to load sales settings:', error);
      toast.error(error?.message || 'Failed to load sales settings');
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      // `currencySymbol` is stripped inside `updateSalesSettings`
      // before the request is sent. Only `currencyCode` is persisted.
      const saved = await saleService.updateSalesSettings(settings);
      setSettings({ ...DEFAULT_SETTINGS, ...(saved || settings) });
      toast.success('Sales settings saved successfully');
    } catch (error: any) {
      console.error('Failed to save sales settings:', error);
      toast.error(error?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  // Display symbol: prefer the server-derived symbol, otherwise the
  // ISO code itself. Never hardcode a `$`.
  const displaySymbol =
    settings.currencySymbol && settings.currencySymbol.trim().length > 0
      ? settings.currencySymbol
      : settings.currencyCode;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Sales Settings
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Configure your sales and checkout settings
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => void loadSettings()}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 focus-ring disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Reload
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="px-6 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2 disabled:opacity-50 focus-ring"
            >
              {saving ? (
                <Loader2
                  className="w-4 h-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Save className="w-4 h-4" aria-hidden="true" />
              )}
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <SettingsSection title="General Settings" icon={SettingsIcon}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Currency Code
                </label>
                <input
                  type="text"
                  value={settings.currencyCode}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      currencyCode: e.target.value.toUpperCase(),
                    })
                  }
                  maxLength={3}
                  placeholder="USD"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none font-mono uppercase"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  ISO 4217 code. The display symbol ({displaySymbol}) is
                  derived from this code on the backend.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Invoice Prefix
                </label>
                <input
                  type="text"
                  value={settings.invoicePrefix}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      invoicePrefix: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Receipt Prefix
                </label>
                <input
                  type="text"
                  value={settings.receiptPrefix}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      receiptPrefix: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Default Payment Method
                </label>
                <select
                  value={settings.defaultPaymentMethod}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      defaultPaymentMethod: e.target.value as any,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                >
                  <option value="CASH">Cash</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="DEBIT_CARD">Debit Card</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="GIFT_CARD">Gift Card</option>
                  <option value="CHECK">Check</option>
                </select>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Tax & Discount" icon={DollarSign}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.taxRate}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      taxRate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none tabular-nums"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Discount (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.maxDiscount}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maxDiscount: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none tabular-nums"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.discountEnabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        discountEnabled: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Enable Discounts
                  </span>
                </label>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Loyalty Points" icon={Users}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.loyaltyPointsEnabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      loyaltyPointsEnabled: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                />
                <span className="text-gray-700 dark:text-gray-300">
                  Enable Loyalty Points
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Points per {displaySymbol} 1 spent
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={settings.pointsPerDollar}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      pointsPerDollar: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none tabular-nums"
                />
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Receipt Settings" icon={Receipt}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoPrintReceipt}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        autoPrintReceipt: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Auto-print receipt after sale
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.emailReceipts}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        emailReceipts: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Send email receipts
                  </span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Receipt Footer Text
                </label>
                <textarea
                  value={settings.receiptFooter}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      receiptFooter: e.target.value,
                    })
                  }
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none"
                  placeholder="Thank you for your business!"
                />
              </div>
            </div>
          </SettingsSection>
        </div>
      </div>
    </div>
  );
}

interface SettingsSectionProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

function SettingsSection({
  title,
  icon: Icon,
  children,
}: SettingsSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-brand p-6"
    >
      <div className="flex items-center gap-2 mb-6">
        <Icon
          className="w-5 h-5 text-brand-600 dark:text-brand-400"
          aria-hidden="true"
        />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
      </div>
      {children}
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 animate-pulse max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-56 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-72"></div>
        </div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-32"></div>
      </div>
      <div className="space-y-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 h-48"
          ></div>
        ))}
      </div>
    </div>
  );
}
