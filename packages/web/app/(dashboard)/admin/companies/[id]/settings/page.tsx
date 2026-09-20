// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\companies\[id]\settings\page.tsx

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Loader2,
  Settings,
  ShoppingBag,
  RefreshCw,
  Gift,
} from 'lucide-react';
import { companyService } from '../../../../../../services/companyService';
import { toast } from '../../../../../../utils/toast-manager';
// ============================================================
// RESERVED ROUTE GUARD
// ============================================================
const RESERVED_ROUTE_IDS = new Set([
  'settings',
  'default',
  'search',
  'email',
  'by-business-unit',
  'ensure-user',
  'bulk',
  'export',
  'activity',
  'stats',
  'business-units',
  'default-business-unit',
  'new',
  'edit',
]);

function isReservedRouteId(id: string | undefined | null): boolean {
  if (!id) return false;
  return RESERVED_ROUTE_IDS.has(id);
}

interface CompanySettings {
  id?: string;
  companyId?: string;
  taxRate: number;
  taxInclusive: boolean;
  receiptFooter?: string;
  receiptHeader?: string;
  lowStockThreshold: number;
  autoReorder: boolean;
  allowReturns: boolean;
  requireCustomerForReturn: boolean;
  maxReturnDays: number;
  allowCash: boolean;
  allowCard: boolean;
  allowMobileMoney: boolean;
  allowGiftCards: boolean;
}

interface SalesSettings {
  id?: string;
  companyId?: string;
  taxRate: number;
  discountEnabled: boolean;
  maxDiscount: number;
  loyaltyPointsEnabled: boolean;
  pointsPerDollar: number;
  autoPrintReceipt: boolean;
  emailReceipts: boolean;
  receiptFooter: string;
  defaultPaymentMethod: string;
  currencySymbol: string;
  currencyCode: string;
  invoicePrefix: string;
  receiptPrefix: string;
}

const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  taxRate: 0,
  taxInclusive: false,
  receiptHeader: '',
  receiptFooter: '',
  lowStockThreshold: 10,
  autoReorder: false,
  allowReturns: true,
  requireCustomerForReturn: false,
  maxReturnDays: 30,
  allowCash: true,
  allowCard: true,
  allowMobileMoney: true,
  allowGiftCards: true,
};

const DEFAULT_SALES_SETTINGS: SalesSettings = {
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
};

type TabId = 'general' | 'sales' | 'inventory' | 'returns';

export default function CompanySettingsPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [company, setCompany] = useState<any>(null);
  const [settings, setSettings] = useState<CompanySettings>(
    DEFAULT_COMPANY_SETTINGS
  );
  const [salesSettings, setSalesSettings] = useState<SalesSettings>(
    DEFAULT_SALES_SETTINGS
  );

  // ✅ Redirect guard — ensures router.replace runs at most once per mount
  const hasRedirectedRef = useRef(false);

  const redirectOnce = useCallback(
    (reason: string) => {
      if (hasRedirectedRef.current) return;
      hasRedirectedRef.current = true;
      toast.error(reason);
      router.replace('/admin/companies');
    },
    [router]
  );

  // ============================================================
  // LOAD SETTINGS
  // ============================================================
  const loadSettings = useCallback(async () => {
    if (!id || isReservedRouteId(id)) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    try {
      setLoading(true);

      const [settingsData, companyData] = await Promise.all([
        companyService.getSettings(id),
        companyService.getById(id).catch(() => null),
      ]);

      if (cancelled) return;

      setCompany(companyData);

      setSettings({
        ...DEFAULT_COMPANY_SETTINGS,
        ...(settingsData?.settings || {}),
      });

      setSalesSettings({
        ...DEFAULT_SALES_SETTINGS,
        ...(settingsData?.salesSettings || {}),
      });
    } catch (error: any) {
      if (cancelled) return;

      console.error('Failed to load settings:', error);

      if (error?.response?.status === 404) {
        redirectOnce('Company not found. Redirecting...');
        return;
      }

      if (
        typeof error?.message === 'string' &&
        error.message.includes('reserved route')
      ) {
        redirectOnce('Invalid company ID');
        return;
      }

      toast.error(error?.message || 'Failed to load company settings');
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [id, redirectOnce]);

  useEffect(() => {
    if (!id) return;

    if (isReservedRouteId(id)) {
      redirectOnce(`Invalid company ID: "${id}" is a reserved route`);
      return;
    }

    loadSettings();
  }, [id, loadSettings, redirectOnce]);

  // ============================================================
  // SAVE
  // ============================================================
  const handleSave = async () => {
    if (!id || isReservedRouteId(id)) return;

    try {
      setSaving(true);
      await companyService.updateSettings(id, {
        settings,
        salesSettings,
      });
      toast.success('Settings saved successfully');
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      toast.error(error?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  const tabs: Array<{ id: TabId; label: string; icon: any }> = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'sales', label: 'Sales', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventory', icon: RefreshCw },
    { id: 'returns', label: 'Returns', icon: Gift },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <Link
          href={`/admin/companies/${id}`}
          prefetch={false}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Back to company"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Company Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 truncate">
            {company?.name || 'Company'} — Configure your company settings
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  General Settings
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Configure basic company settings
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Currency
                  </label>
                  <select
                    value={company?.currency || 'USD'}
                    onChange={(e) =>
                      setCompany((prev: any) => ({
                        ...(prev || {}),
                        currency: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="NGN">NGN</option>
                    <option value="KES">KES</option>
                    <option value="UGX">UGX</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Timezone
                  </label>
                  <select
                    value={company?.timezone || 'UTC'}
                    onChange={(e) =>
                      setCompany((prev: any) => ({
                        ...(prev || {}),
                        timezone: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                  >
                    <option value="UTC">UTC</option>
                    <option value="EST">EST</option>
                    <option value="PST">PST</option>
                    <option value="GMT">GMT</option>
                    <option value="EAT">EAT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.taxRate}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      taxRate: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.taxInclusive}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        taxInclusive: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                </label>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Prices are tax inclusive
                </span>
              </div>
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Sales Settings
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Configure sales and payment settings
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default Payment Method
                  </label>
                  <select
                    value={salesSettings.defaultPaymentMethod}
                    onChange={(e) =>
                      setSalesSettings((prev) => ({
                        ...prev,
                        defaultPaymentMethod: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="DEBIT_CARD">Debit Card</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Maximum Discount (%)
                  </label>
                  <input
                    type="number"
                    value={salesSettings.maxDiscount}
                    onChange={(e) =>
                      setSalesSettings((prev) => ({
                        ...prev,
                        maxDiscount: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={salesSettings.discountEnabled}
                    onChange={(e) =>
                      setSalesSettings((prev) => ({
                        ...prev,
                        discountEnabled: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                </label>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable Discounts
                </span>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={salesSettings.loyaltyPointsEnabled}
                    onChange={(e) =>
                      setSalesSettings((prev) => ({
                        ...prev,
                        loyaltyPointsEnabled: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                </label>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable Loyalty Points
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Points per Dollar
                </label>
                <input
                  type="number"
                  value={salesSettings.pointsPerDollar}
                  onChange={(e) =>
                    setSalesSettings((prev) => ({
                      ...prev,
                      pointsPerDollar: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Inventory Settings
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Configure inventory management settings
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Low Stock Threshold
                </label>
                <input
                  type="number"
                  value={settings.lowStockThreshold}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      lowStockThreshold: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoReorder}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        autoReorder: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                </label>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable Auto Reorder
                </span>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allowGiftCards}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        allowGiftCards: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                </label>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable Gift Cards
                </span>
              </div>
            </div>
          )}

          {activeTab === 'returns' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Returns Settings
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Configure return and refund policies
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Maximum Return Days
                </label>
                <input
                  type="number"
                  value={settings.maxReturnDays}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      maxReturnDays: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allowReturns}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        allowReturns: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                </label>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Allow Returns
                </span>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.requireCustomerForReturn}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        requireCustomerForReturn: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                </label>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Require Customer for Return
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
