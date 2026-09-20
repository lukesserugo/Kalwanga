'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Save, RefreshCw, AlertCircle,
  DollarSign, Percent, Clock, Receipt,
  Printer, Mail, Building, Users
} from 'lucide-react';
import { toast } from '../../../../../utils/toast-manager';

export default function SalesSettings() {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    taxRate: 8,
    discountEnabled: true,
    maxDiscount: 20,
    loyaltyPointsEnabled: true,
    pointsPerDollar: 10,
    autoPrintReceipt: true,
    emailReceipts: true,
    receiptFooter: 'Thank you for your business!',
    defaultPaymentMethod: 'CASH',
    currencySymbol: '$',
    currencyCode: 'USD',
    invoicePrefix: 'INV-',
    receiptPrefix: 'RCP-',
  });

  const handleSave = async () => {
    try {
      setLoading(true);
      // Save settings to backend
      await fetch('/api/settings/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      toast.success('Sales settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Sales Settings
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Configure your sales and checkout settings
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2 disabled:opacity-50 focus-ring"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Settings
          </button>
        </div>

        <div className="space-y-6">
          {/* General Settings */}
          <SettingsSection title="General Settings" icon={Settings}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Currency Symbol
                </label>
                <input
                  type="text"
                  value={settings.currencySymbol}
                  onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Currency Code
                </label>
                <input
                  type="text"
                  value={settings.currencyCode}
                  onChange={(e) => setSettings({ ...settings, currencyCode: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Invoice Prefix
                </label>
                <input
                  type="text"
                  value={settings.invoicePrefix}
                  onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
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
                  onChange={(e) => setSettings({ ...settings, receiptPrefix: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          </SettingsSection>

          {/* Tax & Discount Settings */}
          <SettingsSection title="Tax & Discount" icon={DollarSign}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  value={settings.taxRate}
                  onChange={(e) => setSettings({ ...settings, taxRate: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none tabular-nums"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Discount (%)
                </label>
                <input
                  type="number"
                  value={settings.maxDiscount}
                  onChange={(e) => setSettings({ ...settings, maxDiscount: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none tabular-nums"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.discountEnabled}
                    onChange={(e) => setSettings({ ...settings, discountEnabled: e.target.checked })}
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Enable Discounts</span>
                </label>
              </div>
            </div>
          </SettingsSection>

          {/* Loyalty Points */}
          <SettingsSection title="Loyalty Points" icon={Users}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.loyaltyPointsEnabled}
                  onChange={(e) => setSettings({ ...settings, loyaltyPointsEnabled: e.target.checked })}
                  className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                />
                <span className="text-gray-700 dark:text-gray-300">Enable Loyalty Points</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Points per $1 spent
                </label>
                <input
                  type="number"
                  value={settings.pointsPerDollar}
                  onChange={(e) => setSettings({ ...settings, pointsPerDollar: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none tabular-nums"
                />
              </div>
            </div>
          </SettingsSection>

          {/* Receipt Settings */}
          <SettingsSection title="Receipt Settings" icon={Receipt}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoPrintReceipt}
                    onChange={(e) => setSettings({ ...settings, autoPrintReceipt: e.target.checked })}
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Auto-print receipt after sale</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.emailReceipts}
                    onChange={(e) => setSettings({ ...settings, emailReceipts: e.target.checked })}
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Send email receipts</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Receipt Footer Text
                </label>
                <textarea
                  value={settings.receiptFooter}
                  onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
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

function SettingsSection({ title, icon: Icon, children }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-brand p-6"
    >
      <div className="flex items-center gap-2 mb-6">
        <Icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
      </div>
      {children}
    </motion.div>
  );
}
