'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Save, RefreshCw, Loader2, Lock,
  Shield, Clock, DollarSign, ShoppingBag, Users,
  CreditCard, Gift, Percent, Tag, Truck,
  Globe, Bell, AlertCircle, CheckCircle, XCircle,
  ChevronDown, ChevronUp, Eye, EyeOff, Copy
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { checkoutService } from '../../../../../services/checkoutService';
import { toast } from '../../../../../utils/toast-manager';
import { useThemeStore } from '../../../../stores/themeStore';

interface CheckoutSettings {
  allowPartialPayment: boolean;
  requireCustomer: boolean;
  requireSignature: boolean;
  maxDiscount: number;
  taxInclusive: boolean;
  defaultPaymentMethod: string;
  receiptFooter: string;
  loyaltyPointsEnabled: boolean;
  pointsPerDollar: number;
  allowGuestCheckout: boolean;
  maxCartItems: number;
  cartExpiryHours: number;
  discountEnabled: boolean;
  maxDiscountPercentage: number;
  autoApplyPromotions: boolean;
  reserveStockOnAdd: boolean;
  reserveStockMinutes: number;
  lowStockThreshold: number;
  freeShippingThreshold: number;
  shippingCost: number;
  taxRate: number;
  notifyOnAbandonedCart: boolean;
  abandonedCartHours: number;
  currencyCode: string;
  currencySymbol: string;
  showStockBadge: boolean;
  showVariantImages: boolean;
}

export default function CheckoutSettingsPage() {
  const router = useRouter();
  const { canView, canManage, isLoading: permissionLoading } = usePermission();
  const { isDark } = useThemeStore();
  
  const [settings, setSettings] = useState<CheckoutSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'payment' | 'cart' | 'loyalty' | 'notifications'>('general');

  // ✅ FIXED: Use SALE or ORDER permission instead of CHECKOUT if it doesn't exist
  // Option 1: Use SALE permission (checkout is part of sales)
  const canViewCheckout = canView(PermissionResource.SALE) || canView(PermissionResource.ORDER);
  const canManageCheckout = canManage(PermissionResource.SALE) || canManage(PermissionResource.ORDER);

  // Option 2: If you want to add CHECKOUT to the enum, uncomment this:
  // const canViewCheckout = canView(PermissionResource.CHECKOUT);
  // const canManageCheckout = canManage(PermissionResource.CHECKOUT);

  useEffect(() => {
    if (canViewCheckout) {
      loadSettings();
    }
  }, [canViewCheckout]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await checkoutService.getCheckoutSettings();
      setSettings(response.data || getDefaultSettings());
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load settings');
      setSettings(getDefaultSettings());
    } finally {
      setLoading(false);
    }
  };

  const getDefaultSettings = (): CheckoutSettings => ({
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
  });

  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      await checkoutService.updateCheckoutSettings(settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof CheckoutSettings>(key: K, value: CheckoutSettings[K]) => {
    setSettings(prev => prev ? { ...prev, [key]: value } : null);
  };

  const renderSettingToggle = (label: string, key: keyof CheckoutSettings, description?: string) => (
    <div className="flex items-start justify-between py-3 border-b border-gray-200 dark:border-gray-700">
      <div>
        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{label}</p>
        {description && <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{description}</p>}
      </div>
      <button
        onClick={() => updateSetting(key, !settings?.[key])}
        className={`relative w-12 h-6 rounded-full transition ${
          settings?.[key] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition ${
          settings?.[key] ? 'translate-x-6' : ''
        }`} />
      </button>
    </div>
  );

  const renderNumberInput = (label: string, key: keyof CheckoutSettings, suffix?: string) => (
    <div className="py-3 border-b border-gray-200 dark:border-gray-700">
      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={settings?.[key] as number || 0}
          onChange={(e) => updateSetting(key, parseFloat(e.target.value) || 0)}
          className={`w-32 px-3 py-2 rounded-lg text-sm ${
            isDark
              ? 'bg-gray-700 text-white border-gray-600'
              : 'bg-gray-100 text-gray-900 border-gray-300'
          } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
        />
        {suffix && <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{suffix}</span>}
      </div>
    </div>
  );

  const renderTextInput = (label: string, key: keyof CheckoutSettings, placeholder?: string) => (
    <div className="py-3 border-b border-gray-200 dark:border-gray-700">
      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {label}
      </label>
      <input
        type="text"
        value={settings?.[key] as string || ''}
        onChange={(e) => updateSetting(key, e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 rounded-lg text-sm ${
          isDark
            ? 'bg-gray-700 text-white border-gray-600'
            : 'bg-gray-100 text-gray-900 border-gray-300'
        } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
      />
    </div>
  );

  const renderSelect = (label: string, key: keyof CheckoutSettings, options: Array<{ value: string; label: string }>) => (
    <div className="py-3 border-b border-gray-200 dark:border-gray-700">
      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {label}
      </label>
      <select
        value={settings?.[key] as string || ''}
        onChange={(e) => updateSetting(key, e.target.value)}
        className={`w-full px-3 py-2 rounded-lg text-sm ${
          isDark
            ? 'bg-gray-700 text-white border-gray-600'
            : 'bg-gray-100 text-gray-900 border-gray-300'
        } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );

  if (permissionLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!canViewCheckout) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to manage checkout settings.</p>
        <button
          onClick={() => router.push('/admin/checkout')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Back to Checkout
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/checkout')}
            className={`p-2 rounded-lg transition ${
              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Checkout Settings
            </h1>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Configure your checkout preferences and rules
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSettings}
            className={`p-2 rounded-lg transition ${
              isDark
                ? 'bg-gray-800 hover:bg-gray-700 text-white'
                : 'bg-white hover:bg-gray-100 text-gray-700'
            } border ${isDark ? 'border-gray-700' : 'border-gray-300'}`}
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex gap-2 mb-6 p-1 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
        {[
          { id: 'general', label: 'General' },
          { id: 'payment', label: 'Payment' },
          { id: 'cart', label: 'Cart' },
          { id: 'loyalty', label: 'Loyalty' },
          { id: 'notifications', label: 'Notifications' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : isDark
                  ? 'text-gray-400 hover:bg-gray-700'
                  : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Settings Content */}
      <div className={`rounded-xl p-6 shadow-sm ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        {activeTab === 'general' && (
          <div>
            <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              General Settings
            </h2>
            {renderSettingToggle('Allow Guest Checkout', 'allowGuestCheckout', 'Allow users to checkout without creating an account')}
            {renderSettingToggle('Require Customer Account', 'requireCustomer', 'Force users to create an account before checkout')}
            {renderSettingToggle('Require Digital Signature', 'requireSignature', 'Require customers to sign for their order')}
            {renderNumberInput('Maximum Cart Items', 'maxCartItems', 'items')}
            {renderNumberInput('Cart Expiry (Hours)', 'cartExpiryHours', 'hours')}
            {renderTextInput('Receipt Footer Text', 'receiptFooter', 'Thank you for your business!')}
          </div>
        )}

        {activeTab === 'payment' && (
          <div>
            <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Payment Settings
            </h2>
            {renderSettingToggle('Allow Partial Payment', 'allowPartialPayment', 'Allow customers to pay in installments')}
            {renderSettingToggle('Tax Inclusive Pricing', 'taxInclusive', 'Show prices including tax')}
            {renderSelect('Default Payment Method', 'defaultPaymentMethod', [
              { value: 'CASH', label: 'Cash' },
              { value: 'CREDIT_CARD', label: 'Credit Card' },
              { value: 'DEBIT_CARD', label: 'Debit Card' },
              { value: 'MOBILE_MONEY', label: 'Mobile Money' },
              { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
              { value: 'GIFT_CARD', label: 'Gift Card' },
              { value: 'LOYALTY_POINTS', label: 'Loyalty Points' },
            ])}
            {renderNumberInput('Maximum Discount Amount', 'maxDiscount', 'USD')}
            {renderNumberInput('Tax Rate', 'taxRate', '%')}
            {renderSettingToggle('Enable Discounts', 'discountEnabled', 'Allow customers to apply discount codes')}
            {renderNumberInput('Maximum Discount Percentage', 'maxDiscountPercentage', '%')}
          </div>
        )}

        {activeTab === 'cart' && (
          <div>
            <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Cart Settings
            </h2>
            {renderSettingToggle('Reserve Stock on Add', 'reserveStockOnAdd', 'Temporarily reserve stock when added to cart')}
            {renderNumberInput('Reserve Stock Duration (Minutes)', 'reserveStockMinutes', 'minutes')}
            {renderNumberInput('Low Stock Threshold', 'lowStockThreshold', 'units')}
            {renderNumberInput('Free Shipping Threshold', 'freeShippingThreshold', 'USD')}
            {renderNumberInput('Shipping Cost', 'shippingCost', 'USD')}
            {renderSettingToggle('Show Stock Badge', 'showStockBadge', 'Display stock levels on product cards')}
            {renderSettingToggle('Show Variant Images', 'showVariantImages', 'Display images for product variants')}
          </div>
        )}

        {activeTab === 'loyalty' && (
          <div>
            <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Loyalty Points Settings
            </h2>
            {renderSettingToggle('Enable Loyalty Points', 'loyaltyPointsEnabled', 'Allow customers to earn and redeem loyalty points')}
            {renderNumberInput('Points per Dollar', 'pointsPerDollar', 'points')}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div>
            <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Notification Settings
            </h2>
            {renderSettingToggle('Notify on Abandoned Cart', 'notifyOnAbandonedCart', 'Send reminder emails for abandoned carts')}
            {renderNumberInput('Abandoned Cart Detection (Hours)', 'abandonedCartHours', 'hours')}
          </div>
        )}
      </div>
    </div>
  );
}
