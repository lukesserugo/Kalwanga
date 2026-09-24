// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\cart\settings\page.tsx

'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Settings,
  Percent,
  Gift,
  CreditCard,
  Truck,
  Bell,
  Globe,
  Database,
  Lock,
  RefreshCw,
  X,
} from 'lucide-react';
import { toast } from '../../../../../utils/toast-manager';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { api } from '../../../../../services/api';

// ============================================
// TYPES
// ============================================
//
// These mirror the Prisma `CartSettings` model. Fields the UI doesn't
// render (id, timestamps) are optional on the wire.
//
// IMPORTANT: the backend's `CART_SETTINGS_ALLOWED_KEYS` whitelist must
// contain every field below. If you add a field here, add it there too
// — otherwise the PUT will be rejected with a 400.

interface CartSettings {
  // Server-managed
  id?: string;
  businessUnitId?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;

  // General
  allowGuestCheckout: boolean;
  requireCustomerForReturn: boolean;
  maxCartItems: number;
  cartExpiryHours: number;

  // Discounts
  discountEnabled: boolean;
  maxDiscountPercentage: number;
  maxDiscountAmount: number;
  autoApplyPromotions: boolean;

  // Loyalty
  loyaltyPointsEnabled: boolean;
  pointsPerDollar: number;
  minPointsForRedeem: number;
  maxPointsPerOrder: number;

  // Inventory
  reserveStockOnAdd: boolean;
  reserveStockMinutes: number;
  lowStockThreshold: number;

  // Checkout
  defaultPaymentMethod: string;
  allowPartialPayment: boolean;
  requireSignature: boolean;
  taxInclusive: boolean;

  // Shipping
  freeShippingThreshold: number;
  shippingCost: number;
  taxRate: number;

  // Notifications
  notifyOnAbandonedCart: boolean;
  abandonedCartHours: number;
  notifyOnLowStock: boolean;

  // UI
  currencyCode: string;
  currencySymbol: string;
  showStockBadge: boolean;
  showVariantImages: boolean;
}

interface CartStats {
  totalCarts: number;
  activeCarts: number;
  abandonedCarts: number;
  averageItems: number;
  averageValue: number;
  conversionRate: number;
  todayCarts: number;
  todayRevenue: number;
}

type TabKey =
  | 'general'
  | 'discounts'
  | 'loyalty'
  | 'inventory'
  | 'checkout'
  | 'shipping'
  | 'notifications'
  | 'ui';

// ============================================
// DEFAULTS
// ============================================

const DEFAULT_SETTINGS: CartSettings = {
  isActive: true,
  allowGuestCheckout: true,
  requireCustomerForReturn: false,
  maxCartItems: 50,
  cartExpiryHours: 24,
  discountEnabled: true,
  maxDiscountPercentage: 20,
  maxDiscountAmount: 100,
  autoApplyPromotions: true,
  loyaltyPointsEnabled: true,
  pointsPerDollar: 10,
  minPointsForRedeem: 100,
  maxPointsPerOrder: 1000,
  reserveStockOnAdd: true,
  reserveStockMinutes: 15,
  lowStockThreshold: 5,
  defaultPaymentMethod: 'CASH',
  allowPartialPayment: true,
  requireSignature: false,
  taxInclusive: false,
  freeShippingThreshold: 50,
  shippingCost: 5,
  taxRate: 8,
  notifyOnAbandonedCart: true,
  abandonedCartHours: 24,
  notifyOnLowStock: true,
  currencyCode: 'USD',
  currencySymbol: '$',
  showStockBadge: true,
  showVariantImages: true,
};

const EMPTY_STATS: CartStats = {
  totalCarts: 0,
  activeCarts: 0,
  abandonedCarts: 0,
  averageItems: 0,
  averageValue: 0,
  conversionRate: 0,
  todayCarts: 0,
  todayRevenue: 0,
};

/**
 * Fields the form is allowed to send to the backend.
 *
 * Excludes server-managed fields (`id`, `businessUnitId`, `createdAt`,
 * `updatedAt`) and matches `CART_SETTINGS_ALLOWED_KEYS` in
 * `packages/backend/src/controllers/cartController.ts`.
 */
const MANAGED_FIELDS: ReadonlyArray<keyof CartSettings> = [
  'isActive',
  'allowGuestCheckout',
  'requireCustomerForReturn',
  'maxCartItems',
  'cartExpiryHours',
  'discountEnabled',
  'maxDiscountPercentage',
  'maxDiscountAmount',
  'autoApplyPromotions',
  'loyaltyPointsEnabled',
  'pointsPerDollar',
  'minPointsForRedeem',
  'maxPointsPerOrder',
  'reserveStockOnAdd',
  'reserveStockMinutes',
  'lowStockThreshold',
  'defaultPaymentMethod',
  'allowPartialPayment',
  'requireSignature',
  'taxInclusive',
  'freeShippingThreshold',
  'shippingCost',
  'taxRate',
  'notifyOnAbandonedCart',
  'abandonedCartHours',
  'notifyOnLowStock',
  'currencyCode',
  'currencySymbol',
  'showStockBadge',
  'showVariantImages',
] as const;

/**
 * Numeric fields the form treats as non-negative. Used to clamp values
 * before writing to state — HTML `min={0}` is advisory only, and a user
 * can paste `-5` into a `type="number"` input.
 */
const NON_NEGATIVE_FIELDS: ReadonlySet<keyof CartSettings> = new Set([
  'maxCartItems',
  'cartExpiryHours',
  'maxDiscountPercentage',
  'maxDiscountAmount',
  'pointsPerDollar',
  'minPointsForRedeem',
  'maxPointsPerOrder',
  'reserveStockMinutes',
  'lowStockThreshold',
  'freeShippingThreshold',
  'shippingCost',
  'taxRate',
  'abandonedCartHours',
]);

// ============================================
// CONSTANTS
// ============================================

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'DEBIT_CARD', label: 'Debit Card' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'GIFT_CARD', label: 'Gift Card' },
  { value: 'LOYALTY_POINTS', label: 'Loyalty Points' },
] as const;

// Matches the Prisma `Currency` enum. `GHS` was previously missing.
const CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar', symbol: '$' },
  { value: 'EUR', label: 'EUR — Euro', symbol: '€' },
  { value: 'GBP', label: 'GBP — British Pound', symbol: '£' },
  { value: 'NGN', label: 'NGN — Nigerian Naira', symbol: '₦' },
  { value: 'KES', label: 'KES — Kenyan Shilling', symbol: 'KES' },
  { value: 'ZAR', label: 'ZAR — South African Rand', symbol: 'R' },
  { value: 'GHS', label: 'GHS — Ghanaian Cedi', symbol: '₵' },
  { value: 'UGX', label: 'UGX — Ugandan Shilling', symbol: 'UGX' },
  { value: 'TZS', label: 'TZS — Tanzanian Shilling', symbol: 'TZS' },
] as const;

const TABS: Array<{
  id: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'discounts', label: 'Discounts', icon: Percent },
  { id: 'loyalty', label: 'Loyalty', icon: Gift },
  { id: 'inventory', label: 'Inventory', icon: Database },
  { id: 'checkout', label: 'Checkout', icon: CreditCard },
  { id: 'shipping', label: 'Shipping', icon: Truck },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'ui', label: 'UI', icon: Globe },
];

// ============================================
// HELPERS
// ============================================

/**
 * The backend sometimes wraps responses in `{ data: ... }` and
 * sometimes returns the payload directly. Handle both.
 */
function unwrap<T>(response: unknown): T | null {
  if (response === null || response === undefined) return null;
  if (typeof response !== 'object') return response as unknown as T;
  if ('data' in (response as Record<string, unknown>)) {
    const inner = (response as Record<string, unknown>).data;
    if (inner !== null && inner !== undefined) return inner as T;
  }
  return response as T;
}

/**
 * Compare only the fields the form is allowed to modify. Prevents
 * `updatedAt` churn from making the form permanently "dirty".
 */
function hasManagedChanges(
  a: CartSettings,
  b: CartSettings,
): boolean {
  for (const key of MANAGED_FIELDS) {
    if (a[key] !== b[key]) return true;
  }
  return false;
}

/**
 * Build the wire payload: only the fields the backend accepts.
 */
function toWirePayload(settings: CartSettings): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const key of MANAGED_FIELDS) {
    payload[key] = settings[key];
  }
  return payload;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function CartSettingsPage() {
  const router = useRouter();
  const {
    hasPermission,
    isLoading: permissionLoading,
  } = usePermission();

  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CartStats>(EMPTY_STATS);
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [settings, setSettings] = useState<CartSettings>(DEFAULT_SETTINGS);
  const [original, setOriginal] = useState<CartSettings>(DEFAULT_SETTINGS);

  const isMountedRef = useRef(true);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const canManageSettings = hasPermission(PermissionResource.SETTINGS);

  // ============================================
  // DERIVED
  // ============================================

  const isDirty = useMemo(
    () => hasManagedChanges(settings, original),
    [settings, original],
  );

  // ============================================
  // FETCH
  // ============================================

  const fetchSettings = useCallback(async () => {
    try {
      setLoadingData(true);
      setError(null);

      // Settings and stats are independent. Fetch them in parallel and
      // tolerate either failing.
      const [settingsResult, statsResult] = await Promise.allSettled([
        api.get<CartSettings>('/cart/settings'),
        api.get<CartStats>('/cart/analytics'),
      ]);

      if (!isMountedRef.current) return;

      if (settingsResult.status === 'fulfilled' && settingsResult.value) {
        const payload = unwrap<CartSettings>(settingsResult.value);
        const merged: CartSettings = {
          ...DEFAULT_SETTINGS,
          ...(payload ?? {}),
        };
        setSettings(merged);
        setOriginal(merged);
      } else {
        // Fall back to defaults so the form still renders.
        setSettings(DEFAULT_SETTINGS);
        setOriginal(DEFAULT_SETTINGS);
        if (settingsResult.status === 'rejected') {
          console.warn(
            'Failed to fetch cart settings:',
            settingsResult.reason,
          );
        }
      }

      if (statsResult.status === 'fulfilled' && statsResult.value) {
        const payload = unwrap<CartStats>(statsResult.value);
        setStats({ ...EMPTY_STATS, ...(payload ?? {}) });
      } else {
        setStats(EMPTY_STATS);
        if (statsResult.status === 'rejected') {
          console.warn(
            'Failed to fetch cart analytics:',
            statsResult.reason,
          );
        }
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.error('Error fetching cart settings:', err);
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load cart settings';
      setError(message);
      toast.error(message);
    } finally {
      if (isMountedRef.current) setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (permissionLoading) return;
    if (canManageSettings) {
      void fetchSettings();
    } else {
      setLoadingData(false);
    }
  }, [permissionLoading, canManageSettings, fetchSettings]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleChange = useCallback(
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      const { name, value, type } = e.target;
      const input = e.target as HTMLInputElement;

      setSettings((prev) => {
        if (type === 'checkbox') {
          return { ...prev, [name]: input.checked };
        }
        if (type === 'number') {
          // Empty input becomes 0, not NaN.
          const parsed = value === '' ? 0 : parseFloat(value);
          let num = Number.isFinite(parsed) ? parsed : 0;
          // `min={0}` on the input is advisory; clamp real values.
          if (
            NON_NEGATIVE_FIELDS.has(name as keyof CartSettings) &&
            num < 0
          ) {
            num = 0;
          }
          return { ...prev, [name]: num };
        }
        return { ...prev, [name]: value };
      });

      // Clear the success flash as soon as the user edits again.
      setSuccess(false);
    },
    [],
  );

  const handleCurrencyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      const currency = CURRENCIES.find((c) => c.value === value);
      setSettings((prev) => ({
        ...prev,
        currencyCode: value,
        currencySymbol: currency?.symbol ?? '$',
      }));
      setSuccess(false);
    },
    [],
  );

  const handleReset = useCallback(() => {
    setSettings(original);
    setError(null);
    setSuccess(false);
    toast.info('Unsaved changes discarded');
  }, [original]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!canManageSettings) {
        toast.error('You do not have permission to update settings');
        return;
      }
      if (!isDirty) {
        toast.info('No changes to save');
        return;
      }

      setSaving(true);
      setError(null);
      setSuccess(false);

      try {
        // Send only the fields the backend whitelist accepts.
        const payload = toWirePayload(settings);

        const response = await api.put<CartSettings>(
          '/cart/settings',
          payload,
        );

        if (!isMountedRef.current) return;

        const updated =
          unwrap<CartSettings>(response) ?? {
            ...original,
            ...payload,
          };

        // Re-merge with the server's response so any server-normalized
        // values land in the form.
        const merged: CartSettings = {
          ...DEFAULT_SETTINGS,
          ...updated,
        };
        setSettings(merged);
        setOriginal(merged);

        setSuccess(true);
        toast.success('Cart settings updated');

        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) setSuccess(false);
        }, 3000);
      } catch (err: any) {
        if (!isMountedRef.current) return;
        console.error('Error saving cart settings:', err);
        const message =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to save cart settings';
        setError(message);
        toast.error(message);
      } finally {
        if (isMountedRef.current) setSaving(false);
      }
    },
    [canManageSettings, isDirty, settings, original],
  );

  // ============================================
  // PERMISSION GUARD
  // ============================================

  if (permissionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Checking permissions…
          </p>
        </div>
      </div>
    );
  }

  if (!canManageSettings) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to manage cart settings.
        </p>
        <button
          type="button"
          onClick={() => router.push('/admin')}
          className="mt-4 px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading cart settings…
          </p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push('/admin/cart')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Settings className="w-7 h-7 text-orange-500" />
                Cart Settings
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Configure shopping cart behavior, discounts, loyalty
                points, and more
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={!isDirty || saving}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !isDirty}
              className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Carts" value={stats.totalCarts} />
          <StatCard
            label="Active Carts"
            value={stats.activeCarts}
            accent="text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            label="Abandoned Carts"
            value={stats.abandonedCarts}
            accent="text-red-600 dark:text-red-400"
          />
          <StatCard
            label="Conversion Rate"
            value={`${stats.conversionRate}%`}
            accent="text-orange-600 dark:text-orange-400"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Error
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 dark:text-red-400 p-1"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mb-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                Saved
              </p>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                Cart settings updated successfully.
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 overflow-x-auto custom-scrollbar">
            <nav className="flex gap-2 sm:gap-3 py-3">
              {TABS.map(({ id, label, icon: Icon }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                      isActive
                        ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    aria-pressed={isActive}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Panel */}
          <div className="p-4 sm:p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {activeTab === 'general' && (
              <Section title="General Settings" icon={Settings}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <CheckboxField
                    label="Allow Guest Checkout"
                    name="allowGuestCheckout"
                    checked={settings.allowGuestCheckout}
                    onChange={handleChange}
                  />
                  <CheckboxField
                    label="Require Customer for Returns"
                    name="requireCustomerForReturn"
                    checked={settings.requireCustomerForReturn}
                    onChange={handleChange}
                  />
                  <NumberField
                    label="Max Cart Items"
                    name="maxCartItems"
                    value={settings.maxCartItems}
                    onChange={handleChange}
                    min={1}
                  />
                  <NumberField
                    label="Cart Expiry (hours)"
                    name="cartExpiryHours"
                    value={settings.cartExpiryHours}
                    onChange={handleChange}
                    min={1}
                  />
                  <CheckboxField
                    label="Active"
                    name="isActive"
                    checked={settings.isActive}
                    onChange={handleChange}
                  />
                </div>
              </Section>
            )}

            {activeTab === 'discounts' && (
              <Section title="Discount Settings" icon={Percent}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <CheckboxField
                    label="Enable Discounts"
                    name="discountEnabled"
                    checked={settings.discountEnabled}
                    onChange={handleChange}
                  />
                  <CheckboxField
                    label="Auto-Apply Promotions"
                    name="autoApplyPromotions"
                    checked={settings.autoApplyPromotions}
                    onChange={handleChange}
                  />
                  <NumberField
                    label="Max Discount (%)"
                    name="maxDiscountPercentage"
                    value={settings.maxDiscountPercentage}
                    onChange={handleChange}
                    min={0}
                    max={100}
                  />
                  <NumberField
                    label="Max Discount Amount"
                    name="maxDiscountAmount"
                    value={settings.maxDiscountAmount}
                    onChange={handleChange}
                    min={0}
                  />
                </div>
              </Section>
            )}

            {activeTab === 'loyalty' && (
              <Section title="Loyalty Points" icon={Gift}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <CheckboxField
                    label="Enable Loyalty Points"
                    name="loyaltyPointsEnabled"
                    checked={settings.loyaltyPointsEnabled}
                    onChange={handleChange}
                  />
                  <NumberField
                    label="Points per Currency Unit"
                    name="pointsPerDollar"
                    value={settings.pointsPerDollar}
                    onChange={handleChange}
                    min={0}
                  />
                  <NumberField
                    label="Min Points to Redeem"
                    name="minPointsForRedeem"
                    value={settings.minPointsForRedeem}
                    onChange={handleChange}
                    min={0}
                  />
                  <NumberField
                    label="Max Points per Order"
                    name="maxPointsPerOrder"
                    value={settings.maxPointsPerOrder}
                    onChange={handleChange}
                    min={0}
                  />
                </div>
              </Section>
            )}

            {activeTab === 'inventory' && (
              <Section title="Inventory Settings" icon={Database}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <CheckboxField
                    label="Reserve Stock on Add"
                    name="reserveStockOnAdd"
                    checked={settings.reserveStockOnAdd}
                    onChange={handleChange}
                  />
                  <NumberField
                    label="Reserve Stock (minutes)"
                    name="reserveStockMinutes"
                    value={settings.reserveStockMinutes}
                    onChange={handleChange}
                    min={0}
                  />
                  <NumberField
                    label="Low Stock Threshold"
                    name="lowStockThreshold"
                    value={settings.lowStockThreshold}
                    onChange={handleChange}
                    min={0}
                  />
                </div>
              </Section>
            )}

            {activeTab === 'checkout' && (
              <Section title="Checkout Settings" icon={CreditCard}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SelectField
                    label="Default Payment Method"
                    name="defaultPaymentMethod"
                    value={settings.defaultPaymentMethod}
                    options={PAYMENT_METHODS.map((m) => ({
                      value: m.value,
                      label: m.label,
                    }))}
                    onChange={handleChange}
                  />
                  <CheckboxField
                    label="Allow Partial Payment"
                    name="allowPartialPayment"
                    checked={settings.allowPartialPayment}
                    onChange={handleChange}
                  />
                  <CheckboxField
                    label="Require Signature"
                    name="requireSignature"
                    checked={settings.requireSignature}
                    onChange={handleChange}
                  />
                  <CheckboxField
                    label="Tax-Inclusive Pricing"
                    name="taxInclusive"
                    checked={settings.taxInclusive}
                    onChange={handleChange}
                  />
                </div>
              </Section>
            )}

            {activeTab === 'shipping' && (
              <Section title="Shipping Settings" icon={Truck}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NumberField
                    label={`Free Shipping Threshold (${settings.currencySymbol})`}
                    name="freeShippingThreshold"
                    value={settings.freeShippingThreshold}
                    onChange={handleChange}
                    min={0}
                  />
                  <NumberField
                    label={`Shipping Cost (${settings.currencySymbol})`}
                    name="shippingCost"
                    value={settings.shippingCost}
                    onChange={handleChange}
                    min={0}
                  />
                  <NumberField
                    label="Tax Rate (%)"
                    name="taxRate"
                    value={settings.taxRate}
                    onChange={handleChange}
                    min={0}
                    max={100}
                  />
                </div>
              </Section>
            )}

            {activeTab === 'notifications' && (
              <Section title="Notifications" icon={Bell}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <CheckboxField
                    label="Notify on Abandoned Cart"
                    name="notifyOnAbandonedCart"
                    checked={settings.notifyOnAbandonedCart}
                    onChange={handleChange}
                  />
                  <NumberField
                    label="Abandoned Cart Hours"
                    name="abandonedCartHours"
                    value={settings.abandonedCartHours}
                    onChange={handleChange}
                    min={1}
                  />
                  <CheckboxField
                    label="Notify on Low Stock"
                    name="notifyOnLowStock"
                    checked={settings.notifyOnLowStock}
                    onChange={handleChange}
                  />
                </div>
              </Section>
            )}

            {activeTab === 'ui' && (
              <Section title="UI Settings" icon={Globe}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Currency
                    </label>
                    <select
                      value={settings.currencyCode}
                      onChange={handleCurrencyChange}
                      className={inputClass}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <CheckboxField
                    label="Show Stock Badge"
                    name="showStockBadge"
                    checked={settings.showStockBadge}
                    onChange={handleChange}
                  />
                  <CheckboxField
                    label="Show Variant Images"
                    name="showVariantImages"
                    checked={settings.showVariantImages}
                    onChange={handleChange}
                  />
                </div>
              </Section>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50 dark:bg-gray-800/50">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {isDirty
                ? 'You have unsaved changes'
                : settings.updatedAt
                ? `Last updated: ${new Date(
                    settings.updatedAt,
                  ).toLocaleString()}`
                : 'No changes'}
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => router.push('/admin/cart')}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !isDirty}
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-full sm:w-auto justify-center shadow-sm"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg ' +
  'focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 ' +
  'focus:border-transparent focus:outline-none ' +
  'bg-white dark:bg-gray-700 text-gray-900 dark:text-white ' +
  'transition-colors duration-200';

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
        <Icon className="w-5 h-5 text-orange-500" />
        {title}
      </div>
      {children}
    </div>
  );
}

function CheckboxField({
  label,
  name,
  checked,
  onChange,
}: {
  label: string;
  name: string;
  checked: boolean;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <input
        type="checkbox"
        id={name}
        name={name}
        checked={checked}
        onChange={onChange}
        className="w-5 h-5 text-orange-600 rounded border-gray-300 dark:border-gray-600 focus:ring-orange-500 dark:focus:ring-orange-400 bg-white dark:bg-gray-700"
      />
      <span className="text-sm text-gray-700 dark:text-gray-300">
        {label}
      </span>
    </label>
  );
}

function NumberField({
  label,
  name,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  name: string;
  value: number;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <input
        type="number"
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step="1"
        className={inputClass}
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        className={inputClass}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = 'text-gray-900 dark:text-white',
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className={`text-2xl font-bold tabular-nums ${accent}`}>
        {value}
      </p>
    </div>
  );
}
