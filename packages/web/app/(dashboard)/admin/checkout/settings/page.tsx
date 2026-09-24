// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\checkout\settings\page.tsx

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  RefreshCw,
  Loader2,
  Lock,
  X,
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import {
  checkoutService,
  type CheckoutSettings,
  type CheckoutSettingsUpdate,
  type PaymentMethod,
} from '../../../../../services/checkoutService';
import { toast } from '../../../../../utils/toast-manager';

// ============================================
// DEFAULTS
// ============================================

const DEFAULT_SETTINGS: CheckoutSettings = {
  allowPartialPayment: true,
  requireCustomer: false,
  requireSignature: false,
  maxDiscount: 50,
  taxInclusive: false,
  defaultPaymentMethod: 'CASH',
  receiptFooter: 'Thank you for your business!',
  loyaltyPointsEnabled: true,
  pointsPerDollar: 10,
  allowGuestCheckout: true,
  maxCartItems: 100,
  cartExpiryHours: 24,
  discountEnabled: true,
  maxDiscountPercentage: 20,
  autoApplyPromotions: false,
  reserveStockOnAdd: true,
  reserveStockMinutes: 15,
  lowStockThreshold: 5,
  freeShippingThreshold: 100,
  shippingCost: 0,
  taxRate: 8,
  notifyOnAbandonedCart: true,
  abandonedCartHours: 2,
  currencyCode: 'USD',
  currencySymbol: '$',
  showStockBadge: true,
  showVariantImages: true,
};

const PAYMENT_METHOD_OPTIONS: Array<{
  value: PaymentMethod;
  label: string;
}> = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'DEBIT_CARD', label: 'Debit Card' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'GIFT_CARD', label: 'Gift Card' },
  { value: 'LOYALTY_POINTS', label: 'Loyalty Points' },
];

type TabKey = 'general' | 'payment' | 'cart' | 'loyalty' | 'notifications';

// ============================================
// MAIN COMPONENT
// ============================================

export default function CheckoutSettingsPage() {
  const router = useRouter();
  const { hasPermission, isLoading: permissionLoading } = usePermission();

  const [settings, setSettings] = useState<CheckoutSettings | null>(null);
  const [original, setOriginal] = useState<CheckoutSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('general');

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const canViewCheckout =
    hasPermission(PermissionResource.SALE) ||
    hasPermission(PermissionResource.ORDER);
  const canManageCheckout = hasPermission(PermissionResource.SALE);

  // ============================================
  // DATA
  // ============================================

  const loadSettings = useCallback(async () => {
    if (!canViewCheckout) return;
    try {
      setLoading(true);
      const response = await checkoutService.getCheckoutSettings();
      if (!isMountedRef.current) return;
      const merged: CheckoutSettings = {
        ...DEFAULT_SETTINGS,
        ...(response.data ?? {}),
      };
      setSettings(merged);
      setOriginal(merged);
    } catch (error: any) {
      if (!isMountedRef.current) return;
      console.error('Failed to load settings:', error);
      toast.error(
        error?.response?.data?.message || 'Failed to load settings',
      );
      setSettings(DEFAULT_SETTINGS);
      setOriginal(DEFAULT_SETTINGS);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [canViewCheckout]);

  useEffect(() => {
    if (permissionLoading) return;
    if (canViewCheckout) {
      void loadSettings();
    } else {
      setLoading(false);
    }
  }, [permissionLoading, canViewCheckout, loadSettings]);

  const isDirty =
    settings !== null &&
    original !== null &&
    JSON.stringify(settings) !== JSON.stringify(original);

  const handleSave = useCallback(async () => {
    if (!settings || !canManageCheckout) return;

    setSaving(true);
    try {
      const payload: CheckoutSettingsUpdate = { ...settings };
      const response = await checkoutService.updateCheckoutSettings(payload);
      if (!isMountedRef.current) return;

      const merged: CheckoutSettings = {
        ...DEFAULT_SETTINGS,
        ...(response.data ?? payload),
      };
      setSettings(merged);
      setOriginal(merged);
      toast.success('Settings saved successfully');
    } catch (error: any) {
      if (!isMountedRef.current) return;
      console.error('Failed to save settings:', error);
      toast.error(
        error?.response?.data?.message || 'Failed to save settings',
      );
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  }, [settings, canManageCheckout]);

  const updateSetting = useCallback(
    <K extends keyof CheckoutSettings>(
      key: K,
      value: CheckoutSettings[K],
    ) => {
      setSettings((prev) => (prev ? { ...prev, [key]: value } : null));
    },
    [],
  );

  // ============================================
  // SUB-RENDERERS
  // ============================================

  const renderToggle = (
    label: string,
    key: keyof CheckoutSettings,
    description?: string,
  ) => {
    const value = Boolean(settings?.[key]);
    return (
      <div className="flex items-start justify-between py-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {label}
          </p>
          {description && (
            <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => updateSetting(key, !value as any)}
          disabled={!canManageCheckout}
          className={`relative w-12 h-6 rounded-full transition shrink-0 ml-4 focus-ring disabled:opacity-50 ${
            value ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
          aria-pressed={value}
          aria-label={label}
        >
          <span
            className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
              value ? 'translate-x-6' : ''
            }`}
          />
        </button>
      </div>
    );
  };

  const renderNumber = (
    label: string,
    key: keyof CheckoutSettings,
    suffix?: string,
    min?: number,
  ) => (
    <div className="py-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
      <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          value={(settings?.[key] as number) ?? 0}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value);
            const num = Number.isFinite(parsed) ? parsed : 0;
            updateSetting(key, (min !== undefined && num < min ? min : num) as any);
          }}
          disabled={!canManageCheckout}
          className="w-32 px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 tabular-nums"
        />
        {suffix && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );

  const renderText = (
    label: string,
    key: keyof CheckoutSettings,
    placeholder?: string,
  ) => (
    <div className="py-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
      <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">
        {label}
      </label>
      <input
        type="text"
        value={(settings?.[key] as string) ?? ''}
        onChange={(e) => updateSetting(key, e.target.value as any)}
        placeholder={placeholder}
        disabled={!canManageCheckout}
        className="w-full px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
      />
    </div>
  );

  const renderSelect = (
    label: string,
    key: keyof CheckoutSettings,
    options: Array<{ value: string; label: string }>,
  ) => (
    <div className="py-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
      <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">
        {label}
      </label>
      <select
        value={(settings?.[key] as string) ?? ''}
        onChange={(e) => updateSetting(key, e.target.value as any)}
        disabled={!canManageCheckout}
        className="w-full px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );

  // ============================================
  // GUARDS
  // ============================================

  if (permissionLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!canViewCheckout || !settings) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to manage checkout settings.
        </p>
        <button
          type="button"
          onClick={() => router.push('/admin/checkout')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Back to Checkout
        </button>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push('/admin/checkout')}
            className="p-2 rounded-lg transition hover:bg-gray-200 dark:hover:bg-gray-700 focus-ring"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Checkout Settings
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure your checkout preferences and rules
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadSettings}
            disabled={loading}
            className="p-2 rounded-lg transition bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-white border border-gray-300 dark:border-gray-700 disabled:opacity-50 focus-ring"
            aria-label="Reload"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isDirty || !canManageCheckout}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Dirty banner */}
      {isDirty && canManageCheckout && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          You have unsaved changes.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 p-1 rounded-lg bg-white dark:bg-gray-800 shadow-sm overflow-x-auto">
        {(
          [
            { id: 'general', label: 'General' },
            { id: 'payment', label: 'Payment' },
            { id: 'cart', label: 'Cart' },
            { id: 'loyalty', label: 'Loyalty' },
            { id: 'notifications', label: 'Notifications' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap focus-ring ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            aria-pressed={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-xl p-6 shadow-sm bg-white dark:bg-gray-800">
        {activeTab === 'general' && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              General Settings
            </h2>
            {renderToggle(
              'Allow Guest Checkout',
              'allowGuestCheckout',
              'Allow users to checkout without creating an account',
            )}
            {renderToggle(
              'Require Customer Account',
              'requireCustomer',
              'Force users to create an account before checkout',
            )}
            {renderToggle(
              'Require Digital Signature',
              'requireSignature',
              'Require customers to sign for their order',
            )}
            {renderNumber('Maximum Cart Items', 'maxCartItems', 'items', 1)}
            {renderNumber('Cart Expiry (Hours)', 'cartExpiryHours', 'hours', 1)}
            {renderText(
              'Receipt Footer Text',
              'receiptFooter',
              'Thank you for your business!',
            )}
          </div>
        )}

        {activeTab === 'payment' && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Payment Settings
            </h2>
            {renderToggle(
              'Allow Partial Payment',
              'allowPartialPayment',
              'Allow customers to pay in installments',
            )}
            {renderToggle(
              'Tax Inclusive Pricing',
              'taxInclusive',
              'Show prices including tax',
            )}
            {renderSelect(
              'Default Payment Method',
              'defaultPaymentMethod',
              PAYMENT_METHOD_OPTIONS.map((m) => ({
                value: m.value,
                label: m.label,
              })),
            )}
            {renderNumber('Maximum Discount Amount', 'maxDiscount', 'USD', 0)}
            {renderNumber('Tax Rate', 'taxRate', '%', 0)}
            {renderToggle(
              'Enable Discounts',
              'discountEnabled',
              'Allow customers to apply discount codes',
            )}
            {renderNumber(
              'Maximum Discount Percentage',
              'maxDiscountPercentage',
              '%',
              0,
            )}
          </div>
        )}

        {activeTab === 'cart' && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Cart Settings
            </h2>
            {renderToggle(
              'Reserve Stock on Add',
              'reserveStockOnAdd',
              'Temporarily reserve stock when added to cart',
            )}
            {renderNumber(
              'Reserve Stock Duration (Minutes)',
              'reserveStockMinutes',
              'minutes',
              0,
            )}
            {renderNumber('Low Stock Threshold', 'lowStockThreshold', 'units', 0)}
            {renderNumber(
              'Free Shipping Threshold',
              'freeShippingThreshold',
              'USD',
              0,
            )}
            {renderNumber('Shipping Cost', 'shippingCost', 'USD', 0)}
            {renderToggle(
              'Show Stock Badge',
              'showStockBadge',
              'Display stock levels on product cards',
            )}
            {renderToggle(
              'Show Variant Images',
              'showVariantImages',
              'Display images for product variants',
            )}
          </div>
        )}

        {activeTab === 'loyalty' && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Loyalty Points Settings
            </h2>
            {renderToggle(
              'Enable Loyalty Points',
              'loyaltyPointsEnabled',
              'Allow customers to earn and redeem loyalty points',
            )}
            {renderNumber('Points per Dollar', 'pointsPerDollar', 'points', 0)}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Notification Settings
            </h2>
            {renderToggle(
              'Notify on Abandoned Cart',
              'notifyOnAbandonedCart',
              'Send reminder emails for abandoned carts',
            )}
            {renderNumber(
              'Abandoned Cart Detection (Hours)',
              'abandonedCartHours',
              'hours',
              1,
            )}
          </div>
        )}
      </div>
    </div>
  );
}
