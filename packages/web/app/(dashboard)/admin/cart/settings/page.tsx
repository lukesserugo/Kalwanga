// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\cart\settings\page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Save, Loader2, AlertCircle, CheckCircle,
  ShoppingCart, DollarSign, Tag, Percent, Users,
  Settings, Shield, Clock, Info, AlertTriangle,
  CreditCard, Gift, Zap, Truck, RefreshCw, Lock,
  Globe, Bell, Mail, Smartphone, Database, Layers,
  Plus, Minus, X, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from '../../../../../utils/toast-manager';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { api } from '../../../../../services/api';

// ============================================
// INTERFACES
// ============================================

interface CartSettings {
  id: string;
  companyId: string;
  // General Settings
  allowGuestCheckout: boolean;
  requireCustomerForReturn: boolean;
  maxCartItems: number;
  cartExpiryHours: number;
  // Discount Settings
  discountEnabled: boolean;
  maxDiscountPercentage: number;
  maxDiscountAmount: number;
  autoApplyPromotions: boolean;
  // Loyalty Settings
  loyaltyPointsEnabled: boolean;
  pointsPerDollar: number;
  minPointsForRedeem: number;
  maxPointsPerOrder: number;
  // Inventory Settings
  reserveStockOnAdd: boolean;
  reserveStockMinutes: number;
  lowStockThreshold: number;
  // Checkout Settings
  defaultPaymentMethod: string;
  allowPartialPayment: boolean;
  requireSignature: boolean;
  taxInclusive: boolean;
  // Shipping Settings
  freeShippingThreshold: number;
  shippingCost: number;
  taxRate: number;
  // Notification Settings
  notifyOnAbandonedCart: boolean;
  abandonedCartHours: number;
  notifyOnLowStock: boolean;
  // UI Settings
  currencySymbol: string;
  currencyCode: string;
  showStockBadge: boolean;
  showVariantImages: boolean;
  // Status
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
];

const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar', symbol: '$' },
  { value: 'EUR', label: 'EUR - Euro', symbol: '€' },
  { value: 'GBP', label: 'GBP - British Pound', symbol: '£' },
  { value: 'UGX', label: 'UGX - Ugandan Shilling', symbol: 'UGX' },
  { value: 'KES', label: 'KES - Kenyan Shilling', symbol: 'KES' },
  { value: 'TZS', label: 'TZS - Tanzanian Shilling', symbol: 'TZS' },
  { value: 'NGN', label: 'NGN - Nigerian Naira', symbol: '₦' },
  { value: 'ZAR', label: 'ZAR - South African Rand', symbol: 'R' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function CartSettingsPage() {
  const router = useRouter();
  const { canManage, isLoading: permissionLoading } = usePermission();
  
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CartStats | null>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState<CartSettings>({
    id: '',
    companyId: '',
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
    currencySymbol: '$',
    currencyCode: 'USD',
    showStockBadge: true,
    showVariantImages: true,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  });
  const [sections, setSections] = useState({
    general: true,
    discounts: true,
    loyalty: true,
    inventory: true,
    checkout: true,
    shipping: true,
    notifications: true,
    ui: true,
  });

  const canManageSettings = canManage(PermissionResource.SETTINGS);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchSettings = useCallback(async () => {
    try {
      setLoadingData(true);
      setError(null);

      // Fetch settings
      try {
        const response = await api.get('/cart/settings');
        console.log('📥 Cart settings response:', response);
        
        // ✅ FIX: response is the data directly
        if (response) {
          setSettings(prev => ({ ...prev, ...response }));
        }
      } catch (settingsError) {
        console.warn('Failed to fetch cart settings:', settingsError);
        // Use defaults
      }

      // Fetch stats
      try {
        const statsResponse = await api.get('/cart/analytics');
        console.log('📥 Cart analytics response:', statsResponse);
        
        // ✅ FIX: statsResponse is the data directly
        if (statsResponse) {
          setStats(statsResponse as CartStats);
        }
      } catch (statsError) {
        console.warn('Failed to fetch cart analytics:', statsError);
        setStats({
          totalCarts: 0,
          activeCarts: 0,
          abandonedCarts: 0,
          averageItems: 0,
          averageValue: 0,
          conversionRate: 0,
          todayCarts: 0,
          todayRevenue: 0,
        });
      }
    } catch (error: any) {
      console.error('Error fetching cart settings:', error);
      setError(error?.message || 'Failed to load cart settings');
      toast.error('Failed to load cart settings');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (canManageSettings) {
      fetchSettings();
    } else {
      setLoadingData(false);
    }
  }, [canManageSettings, fetchSettings]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setSettings(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      const numValue = value === '' ? 0 : parseFloat(value);
      setSettings(prev => ({ ...prev, [name]: numValue }));
    } else {
      setSettings(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const currency = CURRENCIES.find(c => c.value === value);
    setSettings(prev => ({
      ...prev,
      currencyCode: value,
      currencySymbol: currency?.symbol || '$',
    }));
  };

  const toggleSection = (section: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canManageSettings) {
      toast.error('You don\'t have permission to update settings');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const payload = { ...settings };
      delete (payload as any).id;
      delete (payload as any).companyId;
      delete (payload as any).createdAt;
      delete (payload as any).updatedAt;

      console.log('📤 Saving cart settings:', payload);
      
      const response = await api.put('/cart/settings', payload);
      console.log('✅ Cart settings saved:', response);

      setSuccess(true);
      toast.success('Cart settings updated successfully');
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      console.error('Error saving cart settings:', error);
      const errorMessage = error?.response?.data?.message || 'Failed to save cart settings';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderSectionToggle = (key: keyof typeof sections, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => toggleSection(key)}
      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
      </div>
      {sections[key] ? (
        <ChevronUp className="w-4 h-4 text-gray-400" />
      ) : (
        <ChevronDown className="w-4 h-4 text-gray-400" />
      )}
    </button>
  );

  const renderInput = (label: string, name: string, type: string = 'text', options?: any[]) => {
    if (type === 'checkbox') {
      return (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id={name}
            name={name}
            checked={!!(settings as any)[name]}
            onChange={handleChange}
            className="w-5 h-5 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700"
          />
          <label htmlFor={name} className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            {label}
          </label>
        </div>
      );
    }

    if (type === 'select' && options) {
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {label}
          </label>
          <select
            id={name}
            name={name}
            value={(settings as any)[name] || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
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

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
        <input
          type={type}
          id={name}
          name={name}
          value={(settings as any)[name] ?? ''}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
          min={type === 'number' ? 0 : undefined}
          step={type === 'number' ? '0.01' : undefined}
        />
      </div>
    );
  };

  // ============================================
  // AUTH GUARD
  // ============================================

  if (permissionLoading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading cart settings...</p>
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
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to manage cart settings. Please contact your administrator.
        </p>
        <button
          onClick={() => router.push('/admin')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 transition-colors duration-200">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Settings className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                Cart Settings
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Configure shopping cart behavior, discounts, loyalty points, and more
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchSettings}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
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

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Carts</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalCarts}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Carts</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.activeCarts}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Abandoned Carts</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.abandonedCarts}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Conversion Rate</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.conversionRate}%</p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Error</p>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 dark:text-red-400 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Success Banner */}
        {success && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3 animate-fadeIn">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">Success!</p>
              <p className="text-sm text-green-700 dark:text-green-300">Cart settings updated successfully.</p>
            </div>
          </div>
        )}

        {/* Settings Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 overflow-x-auto">
            <nav className="flex gap-2 sm:gap-4 py-3">
              {[
                { id: 'general', label: 'General', icon: Settings },
                { id: 'discounts', label: 'Discounts', icon: Percent },
                { id: 'loyalty', label: 'Loyalty', icon: Gift },
                { id: 'inventory', label: 'Inventory', icon: Database },
                { id: 'checkout', label: 'Checkout', icon: CreditCard },
                { id: 'shipping', label: 'Shipping', icon: Truck },
                { id: 'notifications', label: 'Notifications', icon: Bell },
                { id: 'ui', label: 'UI', icon: Globe },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize whitespace-nowrap flex items-center gap-2 ${
                    activeTab === id
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-4 sm:p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* GENERAL SETTINGS */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                  <Settings className="w-5 h-5 text-blue-600" />
                  General Settings
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderInput('Allow Guest Checkout', 'allowGuestCheckout', 'checkbox')}
                  {renderInput('Require Customer for Returns', 'requireCustomerForReturn', 'checkbox')}
                  {renderInput('Max Cart Items', 'maxCartItems', 'number')}
                  {renderInput('Cart Expiry Hours', 'cartExpiryHours', 'number')}
                  {renderInput('Active', 'isActive', 'checkbox')}
                </div>
              </div>
            )}

            {/* DISCOUNT SETTINGS */}
            {activeTab === 'discounts' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                  <Percent className="w-5 h-5 text-green-600" />
                  Discount Settings
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderInput('Enable Discounts', 'discountEnabled', 'checkbox')}
                  {renderInput('Auto-Apply Promotions', 'autoApplyPromotions', 'checkbox')}
                  {renderInput('Max Discount Percentage (%)', 'maxDiscountPercentage', 'number')}
                  {renderInput('Max Discount Amount ($)', 'maxDiscountAmount', 'number')}
                </div>
              </div>
            )}

            {/* LOYALTY SETTINGS */}
            {activeTab === 'loyalty' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                  <Gift className="w-5 h-5 text-purple-600" />
                  Loyalty Points Settings
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderInput('Enable Loyalty Points', 'loyaltyPointsEnabled', 'checkbox')}
                  {renderInput('Points per Dollar', 'pointsPerDollar', 'number')}
                  {renderInput('Min Points to Redeem', 'minPointsForRedeem', 'number')}
                  {renderInput('Max Points per Order', 'maxPointsPerOrder', 'number')}
                </div>
              </div>
            )}

            {/* INVENTORY SETTINGS */}
            {activeTab === 'inventory' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                  <Database className="w-5 h-5 text-orange-600" />
                  Inventory Settings
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderInput('Reserve Stock on Add', 'reserveStockOnAdd', 'checkbox')}
                  {renderInput('Reserve Stock Minutes', 'reserveStockMinutes', 'number')}
                  {renderInput('Low Stock Threshold', 'lowStockThreshold', 'number')}
                </div>
              </div>
            )}

            {/* CHECKOUT SETTINGS */}
            {activeTab === 'checkout' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  Checkout Settings
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderInput('Default Payment Method', 'defaultPaymentMethod', 'select', PAYMENT_METHODS)}
                  {renderInput('Allow Partial Payment', 'allowPartialPayment', 'checkbox')}
                  {renderInput('Require Signature', 'requireSignature', 'checkbox')}
                  {renderInput('Tax Inclusive Pricing', 'taxInclusive', 'checkbox')}
                </div>
              </div>
            )}

            {/* SHIPPING SETTINGS */}
            {activeTab === 'shipping' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                  <Truck className="w-5 h-5 text-cyan-600" />
                  Shipping Settings
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderInput('Free Shipping Threshold ($)', 'freeShippingThreshold', 'number')}
                  {renderInput('Shipping Cost ($)', 'shippingCost', 'number')}
                  {renderInput('Tax Rate (%)', 'taxRate', 'number')}
                </div>
              </div>
            )}

            {/* NOTIFICATION SETTINGS */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                  <Bell className="w-5 h-5 text-yellow-600" />
                  Notification Settings
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderInput('Notify on Abandoned Cart', 'notifyOnAbandonedCart', 'checkbox')}
                  {renderInput('Abandoned Cart Hours', 'abandonedCartHours', 'number')}
                  {renderInput('Notify on Low Stock', 'notifyOnLowStock', 'checkbox')}
                </div>
              </div>
            )}

            {/* UI SETTINGS */}
            {activeTab === 'ui' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                  <Globe className="w-5 h-5 text-rose-600" />
                  UI Settings
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderInput('Currency', 'currencyCode', 'select', CURRENCIES)}
                  {renderInput('Show Stock Badge', 'showStockBadge', 'checkbox')}
                  {renderInput('Show Variant Images', 'showVariantImages', 'checkbox')}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50 dark:bg-gray-800/50">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Last updated: {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : 'Never'}
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => router.push('/admin')}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 w-full sm:w-auto justify-center"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
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
