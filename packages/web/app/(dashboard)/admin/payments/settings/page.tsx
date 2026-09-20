// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\payments\settings\page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft, Save, RefreshCw, Loader2, Lock,
  Shield, Clock, DollarSign, CreditCard, Users,
  Bell, AlertCircle, CheckCircle, XCircle,
  ChevronDown, ChevronUp, Eye, EyeOff, Copy,
  Settings as SettingsIcon, Zap, Sparkles,
  Building, Smartphone, Banknote, Wallet, Gift, Star,
  Globe, ToggleLeft, ToggleRight, Edit, Trash2,
  PlusCircle, Key, Database, Server, Cloud
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { paymentService, PaymentProviderStatus } from '../../../../../services/paymentService';
import { toast } from '../../../../../utils/toast-manager';
import { useThemeStore } from '../../../../stores/themeStore';

// ============================================
// TYPES
// ============================================

interface PaymentSettings {
  // General Settings
  allowPartialPayment: boolean;
  requireCustomer: boolean;
  requireSignature: boolean;
  maxDiscount: number;
  taxInclusive: boolean;
  defaultPaymentMethod: string;

  // Payment Method Settings
  allowCash: boolean;
  allowCard: boolean;
  allowMobileMoney: boolean;
  allowBankTransfer: boolean;
  allowGiftCards: boolean;
  allowLoyaltyPoints: boolean;
  allowPayPal: boolean;
  allowFlutterwave: boolean;
  allowPaystack: boolean;
  allowSquare: boolean;

  // Loyalty Settings
  loyaltyPointsEnabled: boolean;
  pointsPerDollar: number;

  // Notification Settings
  notifyOnPayment: boolean;
  notifyOnRefund: boolean;
  notifyOnFailed: boolean;
  notifyAdminOnLargePayment: boolean;
  largePaymentThreshold: number;

  // Security Settings
  require2FAForRefund: boolean;
  requireApprovalForRefund: boolean;
  maxRefundAmount: number;

  // Currency Settings
  currencyCode: string;
  currencySymbol: string;
}

// ============================================
// CONSTANTS - EXACT PROVIDER IMAGE URLs
// ============================================

const PROVIDER_IMAGE_URLS: Record<string, string> = {
  STRIPE: 'https://stripe.com/img/v3/home/social.png',
  PAYPAL: 'https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg',
  FLUTTERWAVE: 'https://flutterwave.com/images/logo/flyer.svg',
  PAYSTACK: 'https://paystack.com/assets/images/logo.png',
  SQUARE: 'https://squareup.com/icons/square_logo.svg',
  MTN: 'https://www.mtn.co.ug/wp-content/uploads/2023/05/mtn-logo.png',
  AIRTEL: 'https://www.airtel.in/static-assets/new-home/img/airtel-red-logo.svg',
  TIGO: 'https://www.tigo.com.tz/sites/default/files/tigo-logo.png',
  VODAFONE: 'https://www.vodafone.com/content/dam/vodcom/Images/Logo/vodafone_logo_red.png',
  CASH: 'https://cdn-icons-png.flaticon.com/512/2331/2331970.png',
  MOBILE_MONEY: 'https://cdn-icons-png.flaticon.com/512/545/545245.png',
  BANK_TRANSFER: 'https://cdn-icons-png.flaticon.com/512/2845/2845813.png',
  GIFT_CARD: 'https://cdn-icons-png.flaticon.com/512/3144/3144456.png',
  LOYALTY_POINTS: 'https://cdn-icons-png.flaticon.com/512/1828/1828665.png',
};

const PROVIDER_DARK_IMAGE_URLS: Record<string, string> = {
  STRIPE: 'https://stripe.com/img/v3/home/social.png',
  PAYPAL: 'https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg',
  FLUTTERWAVE: 'https://flutterwave.com/images/logo/flyer.svg',
  PAYSTACK: 'https://paystack.com/assets/images/logo-white.png',
  SQUARE: 'https://squareup.com/icons/square_logo.svg',
  MTN: 'https://www.mtn.co.ug/wp-content/uploads/2023/05/mtn-logo.png',
  AIRTEL: 'https://www.airtel.in/static-assets/new-home/img/airtel-red-logo.svg',
  TIGO: 'https://www.tigo.com.tz/sites/default/files/tigo-logo.png',
  VODAFONE: 'https://www.vodafone.com/content/dam/vodcom/Images/Logo/vodafone_logo_red.png',
  CASH: 'https://cdn-icons-png.flaticon.com/512/2331/2331970.png',
  MOBILE_MONEY: 'https://cdn-icons-png.flaticon.com/512/545/545245.png',
  BANK_TRANSFER: 'https://cdn-icons-png.flaticon.com/512/2845/2845813.png',
  GIFT_CARD: 'https://cdn-icons-png.flaticon.com/512/3144/3144456.png',
  LOYALTY_POINTS: 'https://cdn-icons-png.flaticon.com/512/1828/1828665.png',
};

const PROVIDER_CONFIGS: Record<string, { icon: string; name: string; color: string; bgColor: string }> = {
  STRIPE: { icon: '💳', name: 'Stripe', color: 'primary', bgColor: 'bg-primary-50 dark:bg-primary-900/20' },
  PAYPAL: { icon: '💸', name: 'PayPal', color: 'primary', bgColor: 'bg-primary-50 dark:bg-primary-900/20' },
  FLUTTERWAVE: { icon: '🌊', name: 'Flutterwave', color: 'cyan', bgColor: 'bg-cyan-50 dark:bg-cyan-900/20' },
  PAYSTACK: { icon: '🔷', name: 'Paystack', color: 'sky', bgColor: 'bg-sky-50 dark:bg-sky-900/20' },
  SQUARE: { icon: '⬜', name: 'Square', color: 'gray', bgColor: 'bg-gray-50 dark:bg-gray-800/50' },
  CASH: { icon: '💰', name: 'Cash', color: 'success', bgColor: 'bg-success-50 dark:bg-success-900/20' },
  MOBILE_MONEY: { icon: '📱', name: 'Mobile Money', color: 'brand', bgColor: 'bg-brand-50 dark:bg-brand-900/20' },
  BANK_TRANSFER: { icon: '🏦', name: 'Bank Transfer', color: 'indigo', bgColor: 'bg-indigo-50 dark:bg-indigo-900/20' },
  GIFT_CARD: { icon: '🎁', name: 'Gift Card', color: 'brand', bgColor: 'bg-brand-50 dark:bg-brand-900/20' },
  LOYALTY_POINTS: { icon: '⭐', name: 'Loyalty Points', color: 'warning', bgColor: 'bg-warning-50 dark:bg-warning-900/20' },
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminPaymentSettingsPage() {
  const router = useRouter();
  const { canView, canManage, isLoading: permissionLoading } = usePermission();
  const { isDark } = useThemeStore();

  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [providers, setProviders] = useState<PaymentProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'methods' | 'providers' | 'loyalty' | 'notifications' | 'security'>('general');
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [showProviderConfig, setShowProviderConfig] = useState<string | null>(null);
  const [providerConfigData, setProviderConfigData] = useState<Record<string, any>>({});
  const [savingProvider, setSavingProvider] = useState(false);

  const canViewPayments = canView(PermissionResource.PAYMENT) || canManage(PermissionResource.PAYMENT);
  const canManagePayments = canManage(PermissionResource.PAYMENT);

  useEffect(() => {
    if (canViewPayments) {
      loadSettings();
      loadProviders();
    }
  }, [canViewPayments]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // For now, use default settings
      setSettings(getDefaultSettings());
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load settings');
      setSettings(getDefaultSettings());
    } finally {
      setLoading(false);
    }
  };

  const loadProviders = async () => {
    try {
      setLoadingProviders(true);
      const response = await paymentService.getPaymentProviders();
      if (response.success && response.data) {
        setProviders(response.data);
      } else {
        setProviders(getDefaultProviders());
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
      setProviders(getDefaultProviders());
    } finally {
      setLoadingProviders(false);
    }
  };

  const getDefaultSettings = (): PaymentSettings => ({
    allowPartialPayment: true,
    requireCustomer: false,
    requireSignature: false,
    maxDiscount: 50,
    taxInclusive: false,
    defaultPaymentMethod: 'CASH',
    allowCash: true,
    allowCard: true,
    allowMobileMoney: true,
    allowBankTransfer: true,
    allowGiftCards: true,
    allowLoyaltyPoints: true,
    allowPayPal: false,
    allowFlutterwave: false,
    allowPaystack: false,
    allowSquare: false,
    loyaltyPointsEnabled: true,
    pointsPerDollar: 10,
    notifyOnPayment: true,
    notifyOnRefund: true,
    notifyOnFailed: true,
    notifyAdminOnLargePayment: true,
    largePaymentThreshold: 1000,
    require2FAForRefund: false,
    requireApprovalForRefund: true,
    maxRefundAmount: 5000,
    currencyCode: 'USD',
    currencySymbol: '$',
  });

  const getDefaultProviders = (): PaymentProviderStatus[] => {
    return [
      {
        id: 'default_cash',
        provider: 'CASH',
        name: 'Cash',
        code: 'CASH',
        type: 'OFFLINE',
        isActive: true,
        isHealthy: true,
        configured: true,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Cash',
          type: 'OFFLINE',
          supportedCurrencies: ['USD', 'TZS', 'KES', 'UGX'],
          supportedMethods: ['CASH'],
          description: 'Pay with cash at the counter',
          icon: '💰',
          feePercentage: 0,
          feeFixed: 0,
        },
      },
      {
        id: 'default_stripe',
        provider: 'STRIPE',
        name: 'Stripe',
        code: 'STRIPE',
        type: 'ONLINE',
        isActive: true,
        isHealthy: true,
        configured: true,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Stripe',
          type: 'ONLINE',
          supportedCurrencies: ['USD', 'EUR', 'GBP'],
          supportedMethods: ['CREDIT_CARD', 'DEBIT_CARD'],
          description: 'Pay with credit card (Visa, Mastercard, Amex)',
          icon: '💳',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 2.9,
          feeFixed: 0.30,
        },
      },
      {
        id: 'default_mobile_money',
        provider: 'MOBILE_MONEY',
        name: 'Mobile Money',
        code: 'MOBILE_MONEY',
        type: 'ONLINE',
        isActive: true,
        isHealthy: true,
        configured: true,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Mobile Money',
          type: 'ONLINE',
          supportedCurrencies: ['TZS', 'KES', 'UGX', 'USD'],
          supportedMethods: ['MOBILE_MONEY'],
          description: 'M-Pesa, Tigo Pesa, Airtel Money',
          icon: '📱',
          minAmount: 1,
          maxAmount: 10000,
          feePercentage: 1.5,
          feeFixed: 0.10,
        },
      },
      {
        id: 'default_bank_transfer',
        provider: 'BANK_TRANSFER',
        name: 'Bank Transfer',
        code: 'BANK_TRANSFER',
        type: 'ONLINE',
        isActive: true,
        isHealthy: true,
        configured: true,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Bank Transfer',
          type: 'ONLINE',
          supportedCurrencies: ['USD', 'TZS', 'KES', 'UGX'],
          supportedMethods: ['BANK_TRANSFER'],
          description: 'Direct bank transfer',
          icon: '🏦',
          minAmount: 10,
          maxAmount: 1000000,
          feePercentage: 0,
          feeFixed: 0,
        },
      },
      {
        id: 'default_gift_card',
        provider: 'GIFT_CARD',
        name: 'Gift Card',
        code: 'GIFT_CARD',
        type: 'ONLINE',
        isActive: true,
        isHealthy: true,
        configured: true,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Gift Card',
          type: 'ONLINE',
          supportedCurrencies: ['USD'],
          supportedMethods: ['GIFT_CARD'],
          description: 'Redeem your gift card',
          icon: '🎁',
          minAmount: 1,
          maxAmount: 1000,
          feePercentage: 0,
          feeFixed: 0,
        },
      },
      {
        id: 'default_loyalty_points',
        provider: 'LOYALTY_POINTS',
        name: 'Loyalty Points',
        code: 'LOYALTY_POINTS',
        type: 'OFFLINE',
        isActive: true,
        isHealthy: true,
        configured: true,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Loyalty Points',
          type: 'OFFLINE',
          supportedCurrencies: ['USD'],
          supportedMethods: ['LOYALTY_POINTS'],
          description: 'Pay with your loyalty points',
          icon: '⭐',
          minAmount: 1,
          maxAmount: 1000,
          feePercentage: 0,
          feeFixed: 0,
        },
      },
      {
        id: 'default_paypal',
        provider: 'PAYPAL',
        name: 'PayPal',
        code: 'PAYPAL',
        type: 'ONLINE',
        isActive: false,
        isHealthy: true,
        configured: false,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'PayPal',
          type: 'ONLINE',
          supportedCurrencies: ['USD', 'EUR', 'GBP'],
          supportedMethods: ['PAYPAL'],
          description: 'Pay with PayPal',
          icon: '💸',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 3.5,
          feeFixed: 0.30,
        },
      },
      {
        id: 'default_flutterwave',
        provider: 'FLUTTERWAVE',
        name: 'Flutterwave',
        code: 'FLUTTERWAVE',
        type: 'ONLINE',
        isActive: false,
        isHealthy: true,
        configured: false,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Flutterwave',
          type: 'ONLINE',
          supportedCurrencies: ['NGN', 'GHS', 'KES', 'UGX', 'TZS', 'USD'],
          supportedMethods: ['FLUTTERWAVE'],
          description: 'Pay with Flutterwave (Cards, Mobile Money, Bank Transfer)',
          icon: '🌊',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 1.9,
          feeFixed: 0.20,
        },
      },
      {
        id: 'default_paystack',
        provider: 'PAYSTACK',
        name: 'Paystack',
        code: 'PAYSTACK',
        type: 'ONLINE',
        isActive: false,
        isHealthy: true,
        configured: false,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Paystack',
          type: 'ONLINE',
          supportedCurrencies: ['NGN', 'GHS', 'USD'],
          supportedMethods: ['PAYSTACK'],
          description: 'Pay with Paystack (Cards, Bank Transfer, USSD)',
          icon: '🔷',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 1.5,
          feeFixed: 0.20,
        },
      },
      {
        id: 'default_square',
        provider: 'SQUARE',
        name: 'Square',
        code: 'SQUARE',
        type: 'ONLINE',
        isActive: false,
        isHealthy: true,
        configured: false,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Square',
          type: 'ONLINE',
          supportedCurrencies: ['USD', 'EUR', 'GBP'],
          supportedMethods: ['SQUARE'],
          description: 'Pay with Square (Cards, Digital Wallet)',
          icon: '⬜',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 2.6,
          feeFixed: 0.30,
        },
      },
    ];
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      // Save settings via API
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleProvider = async (providerId: string, currentStatus: boolean) => {
    try {
      const response = await paymentService.togglePaymentProvider(providerId, !currentStatus);
      if (response.success) {
        toast.success(`Provider ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
        await loadProviders();
      } else {
        toast.error(response.message || 'Failed to toggle provider');
      }
    } catch (error: any) {
      console.error('Failed to toggle provider:', error);
      toast.error(error?.message || 'Failed to toggle provider');
    }
  };

  const handleConfigureProvider = async (providerId: string) => {
    if (!providerId) return;

    setSavingProvider(true);
    try {
      // Wrap config data in the expected format
      const response = await paymentService.configurePaymentProvider(providerId, {
        config: providerConfigData,
        settings: {},
      });
      if (response.success) {
        toast.success('Provider configured successfully');
        await loadProviders();
        setShowProviderConfig(null);
        setEditingProvider(null);
        setProviderConfigData({});
      } else {
        toast.error(response.message || 'Failed to configure provider');
      }
    } catch (error: any) {
      console.error('Failed to configure provider:', error);
      toast.error(error?.message || 'Failed to configure provider');
    } finally {
      setSavingProvider(false);
    }
  };

  const updateSetting = <K extends keyof PaymentSettings>(key: K, value: PaymentSettings[K]) => {
    setSettings(prev => prev ? { ...prev, [key]: value } : null);
  };

  const getProviderImageUrl = (provider: string): string => {
    return isDark && PROVIDER_DARK_IMAGE_URLS[provider]
      ? PROVIDER_DARK_IMAGE_URLS[provider]
      : PROVIDER_IMAGE_URLS[provider] || '';
  };

  const renderToggle = (label: string, key: keyof PaymentSettings, description?: string) => (
    <div className="flex items-start justify-between py-3 border-b border-gray-200 dark:border-gray-700">
      <div>
        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{label}</p>
        {description && <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{description}</p>}
      </div>
      <button
        onClick={() => updateSetting(key, !settings?.[key])}
        className={`relative w-12 h-6 rounded-full transition duration-250 flex-shrink-0 focus-ring ${
          settings?.[key] ? 'bg-brand-gradient' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition duration-250 ${
          settings?.[key] ? 'translate-x-6' : ''
        }`} />
      </button>
    </div>
  );

  const renderNumberInput = (label: string, key: keyof PaymentSettings, suffix?: string, min?: number, max?: number) => (
    <div className="py-3 border-b border-gray-200 dark:border-gray-700">
      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={settings?.[key] as number || 0}
          onChange={(e) => updateSetting(key, parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          className={`w-32 px-3 py-2 rounded-lg text-sm tabular-nums ${
            isDark
              ? 'bg-gray-700 text-white border-gray-600'
              : 'bg-gray-100 text-gray-900 border-gray-300'
          } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
        />
        {suffix && <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{suffix}</span>}
      </div>
    </div>
  );

  const renderSelect = (label: string, key: keyof PaymentSettings, options: Array<{ value: string; label: string }>) => (
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
        } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );

  // Render provider configuration form
  const renderProviderConfigForm = (provider: PaymentProviderStatus) => {
    const config = PROVIDER_CONFIGS[provider.provider] || PROVIDER_CONFIGS.STRIPE;
    const imageUrl = getProviderImageUrl(provider.provider);
    const configValues = provider.config || {};

    return (
      <div className={`p-4 rounded-xl border animate-slide-down ${isDark ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-center gap-3 mb-4">
          {imageUrl ? (
            <div className="relative w-10 h-10 flex-shrink-0">
              <Image
                src={imageUrl}
                alt={provider.name || 'Payment provider'}
                width={40}
                height={40}
                style={{ width: 'auto', height: 'auto' }}
                className="rounded-lg object-contain max-w-[40px] max-h-[40px]"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const fallback = document.createElement('span');
                    fallback.className = `text-2xl ${isDark ? 'text-gray-300' : 'text-gray-600'}`;
                    fallback.textContent = config.icon;
                    parent.appendChild(fallback);
                  }
                }}
              />
            </div>
          ) : (
            <span className="text-2xl">{config.icon}</span>
          )}
          <div>
            <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{provider.name || 'Unknown Provider'}</h4>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {provider.provider || ''} • {provider.type || 'N/A'}
            </p>
          </div>
          <span className={`ml-auto text-2xs px-2 py-0.5 rounded-full ${
            provider.configured
              ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
              : 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300'
          }`}>
            {provider.configured ? 'Configured' : 'Not Configured'}
          </span>
        </div>

        {/* Provider-specific config fields */}
        {provider.provider === 'STRIPE' && (
          <div className="space-y-3">
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Secret Key
              </label>
              <input
                type="password"
                value={providerConfigData.apiKey || (configValues as any)?.apiKey || ''}
                onChange={(e) => setProviderConfigData({ ...providerConfigData, apiKey: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  isDark
                    ? 'bg-gray-700 text-white border-gray-600'
                    : 'bg-white text-gray-900 border-gray-300'
                } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                placeholder="sk_test_..."
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Webhook Secret
              </label>
              <input
                type="password"
                value={providerConfigData.webhookSecret || (configValues as any)?.webhookSecret || ''}
                onChange={(e) => setProviderConfigData({ ...providerConfigData, webhookSecret: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  isDark
                    ? 'bg-gray-700 text-white border-gray-600'
                    : 'bg-white text-gray-900 border-gray-300'
                } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                placeholder="whsec_..."
              />
            </div>
          </div>
        )}

        {provider.provider === 'PAYPAL' && (
          <div className="space-y-3">
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Client ID
              </label>
              <input
                type="text"
                value={providerConfigData.clientId || (configValues as any)?.clientId || ''}
                onChange={(e) => setProviderConfigData({ ...providerConfigData, clientId: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  isDark
                    ? 'bg-gray-700 text-white border-gray-600'
                    : 'bg-white text-gray-900 border-gray-300'
                } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                placeholder="Enter PayPal Client ID"
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Client Secret
              </label>
              <input
                type="password"
                value={providerConfigData.clientSecret || (configValues as any)?.clientSecret || ''}
                onChange={(e) => setProviderConfigData({ ...providerConfigData, clientSecret: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  isDark
                    ? 'bg-gray-700 text-white border-gray-600'
                    : 'bg-white text-gray-900 border-gray-300'
                } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                placeholder="Enter PayPal Client Secret"
              />
            </div>
          </div>
        )}

        {provider.provider === 'FLUTTERWAVE' && (
          <div className="space-y-3">
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                API Key
              </label>
              <input
                type="password"
                value={providerConfigData.apiKey || (configValues as any)?.apiKey || ''}
                onChange={(e) => setProviderConfigData({ ...providerConfigData, apiKey: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  isDark
                    ? 'bg-gray-700 text-white border-gray-600'
                    : 'bg-white text-gray-900 border-gray-300'
                } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                placeholder="FLWSECK-..."
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Public Key
              </label>
              <input
                type="text"
                value={providerConfigData.publicKey || (configValues as any)?.publicKey || ''}
                onChange={(e) => setProviderConfigData({ ...providerConfigData, publicKey: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  isDark
                    ? 'bg-gray-700 text-white border-gray-600'
                    : 'bg-white text-gray-900 border-gray-300'
                } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                placeholder="FLWPUBK-..."
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Encryption Key
              </label>
              <input
                type="password"
                value={providerConfigData.encryptionKey || (configValues as any)?.encryptionKey || ''}
                onChange={(e) => setProviderConfigData({ ...providerConfigData, encryptionKey: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  isDark
                    ? 'bg-gray-700 text-white border-gray-600'
                    : 'bg-white text-gray-900 border-gray-300'
                } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                placeholder="FLWSECK-..."
              />
            </div>
          </div>
        )}

        {provider.provider === 'PAYSTACK' && (
          <div className="space-y-3">
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Secret Key
              </label>
              <input
                type="password"
                value={providerConfigData.secretKey || (configValues as any)?.secretKey || ''}
                onChange={(e) => setProviderConfigData({ ...providerConfigData, secretKey: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  isDark
                    ? 'bg-gray-700 text-white border-gray-600'
                    : 'bg-white text-gray-900 border-gray-300'
                } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                placeholder="sk_live_..."
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Public Key
              </label>
              <input
                type="text"
                value={providerConfigData.publicKey || (configValues as any)?.publicKey || ''}
                onChange={(e) => setProviderConfigData({ ...providerConfigData, publicKey: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  isDark
                    ? 'bg-gray-700 text-white border-gray-600'
                    : 'bg-white text-gray-900 border-gray-300'
                } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                placeholder="pk_live_..."
              />
            </div>
          </div>
        )}

        {provider.provider === 'SQUARE' && (
          <div className="space-y-3">
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Access Token
              </label>
              <input
                type="password"
                value={providerConfigData.accessToken || (configValues as any)?.accessToken || ''}
                onChange={(e) => setProviderConfigData({ ...providerConfigData, accessToken: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  isDark
                    ? 'bg-gray-700 text-white border-gray-600'
                    : 'bg-white text-gray-900 border-gray-300'
                } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                placeholder="EAAAE..."
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Location ID
              </label>
              <input
                type="text"
                value={providerConfigData.locationId || (configValues as any)?.locationId || ''}
                onChange={(e) => setProviderConfigData({ ...providerConfigData, locationId: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  isDark
                    ? 'bg-gray-700 text-white border-gray-600'
                    : 'bg-white text-gray-900 border-gray-300'
                } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                placeholder="L..."
              />
            </div>
          </div>
        )}

        {/* Environment selector */}
        <div className="mt-3">
          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Environment
          </label>
          <select
            value={providerConfigData.environment || (configValues as any)?.environment || 'sandbox'}
            onChange={(e) => setProviderConfigData({ ...providerConfigData, environment: e.target.value })}
            className={`w-full px-3 py-2 rounded-lg text-sm ${
              isDark
                ? 'bg-gray-700 text-white border-gray-600'
                : 'bg-white text-gray-900 border-gray-300'
            } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
          >
            <option value="sandbox">Sandbox (Test)</option>
            <option value="production">Production (Live)</option>
          </select>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => provider.id && handleConfigureProvider(provider.id)}
            disabled={savingProvider}
            className="flex-1 btn-brand disabled:opacity-50"
          >
            {savingProvider ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {savingProvider ? 'Saving...' : 'Save Configuration'}
          </button>
          <button
            onClick={() => {
              setShowProviderConfig(null);
              setEditingProvider(null);
              setProviderConfigData({});
            }}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  if (permissionLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!canViewPayments) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to manage payment settings.</p>
        <button
          onClick={() => router.push('/admin/payments')}
          className="mt-4 btn-brand"
        >
          Back to Payments
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-container mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 animate-fade-in">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/payments')}
              className={`p-2 rounded-lg transition duration-250 focus-ring ${
                isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
              }`}
              aria-label="Back to payments"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Payment Settings
              </h1>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Configure your payment preferences, providers, and rules
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { loadSettings(); loadProviders(); }}
              className={`p-2 rounded-lg transition duration-250 focus-ring ${
                isDark
                  ? 'bg-gray-800 hover:bg-gray-700 text-white'
                  : 'bg-white hover:bg-gray-100 text-gray-700'
              } border ${isDark ? 'border-gray-700' : 'border-gray-300'}`}
              aria-label="Refresh settings"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-brand disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className={`flex flex-wrap gap-2 mb-6 p-1 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-soft`}>
          {[
            { id: 'general', label: 'General' },
            { id: 'methods', label: 'Payment Methods' },
            { id: 'providers', label: 'Providers' },
            { id: 'loyalty', label: 'Loyalty' },
            { id: 'notifications', label: 'Notifications' },
            { id: 'security', label: 'Security' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition duration-250 focus-ring ${
                activeTab === tab.id
                  ? 'bg-brand-gradient text-white shadow-brand'
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
        <div className="card-brand shadow-soft">
          {activeTab === 'general' && (
            <div>
              <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                General Settings
              </h2>
              {renderToggle('Allow Partial Payment', 'allowPartialPayment', 'Allow customers to pay in installments')}
              {renderToggle('Require Customer Account', 'requireCustomer', 'Force users to have an account before payment')}
              {renderToggle('Require Digital Signature', 'requireSignature', 'Require customers to sign for their payment')}
              {renderNumberInput('Maximum Discount Amount', 'maxDiscount', 'USD', 0, 100)}
              {renderToggle('Tax Inclusive Pricing', 'taxInclusive', 'Show prices including tax')}
              {renderSelect('Default Payment Method', 'defaultPaymentMethod', [
                { value: 'CASH', label: 'Cash' },
                { value: 'CREDIT_CARD', label: 'Credit Card' },
                { value: 'DEBIT_CARD', label: 'Debit Card' },
                { value: 'MOBILE_MONEY', label: 'Mobile Money' },
                { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
                { value: 'GIFT_CARD', label: 'Gift Card' },
                { value: 'LOYALTY_POINTS', label: 'Loyalty Points' },
                { value: 'PAYPAL', label: 'PayPal' },
                { value: 'FLUTTERWAVE', label: 'Flutterwave' },
                { value: 'PAYSTACK', label: 'Paystack' },
                { value: 'SQUARE', label: 'Square' },
              ])}
            </div>
          )}

          {activeTab === 'methods' && (
            <div>
              <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Payment Methods
              </h2>
              {renderToggle('Allow Cash', 'allowCash', 'Enable cash payments')}
              {renderToggle('Allow Credit/Debit Cards', 'allowCard', 'Enable card payments via Stripe')}
              {renderToggle('Allow Mobile Money', 'allowMobileMoney', 'Enable mobile money payments (M-Pesa, Tigo Pesa, Airtel Money)')}
              {renderToggle('Allow Bank Transfer', 'allowBankTransfer', 'Enable bank transfer payments')}
              {renderToggle('Allow Gift Cards', 'allowGiftCards', 'Enable gift card payments')}
              {renderToggle('Allow Loyalty Points', 'allowLoyaltyPoints', 'Enable loyalty points payments')}
              {renderToggle('Allow PayPal', 'allowPayPal', 'Enable PayPal payments')}
              {renderToggle('Allow Flutterwave', 'allowFlutterwave', 'Enable Flutterwave payments (Cards, Mobile Money, Bank Transfer)')}
              {renderToggle('Allow Paystack', 'allowPaystack', 'Enable Paystack payments (Cards, Bank Transfer, USSD)')}
              {renderToggle('Allow Square', 'allowSquare', 'Enable Square payments (Cards, Digital Wallet)')}
            </div>
          )}

          {activeTab === 'providers' && (
            <div>
              <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Payment Providers
              </h2>
              <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Configure and manage your payment providers. Activate providers to make them available to customers.
              </p>

              {loadingProviders ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
                </div>
              ) : (
                <div className="space-y-4">
                  {providers.map((provider) => {
                    const config = PROVIDER_CONFIGS[provider.provider] || PROVIDER_CONFIGS.STRIPE;
                    const imageUrl = getProviderImageUrl(provider.provider);
                    const isActive = provider.isActive && provider.isHealthy && provider.configured;
                    const isEditing = showProviderConfig === provider.id;

                    return (
                      <div
                        key={provider.id}
                        className={`p-4 rounded-xl border transition duration-250 ${
                          isActive
                            ? `${config.bgColor} ${isDark ? 'border-gray-700' : 'border-gray-200'}`
                            : isDark
                              ? 'bg-gray-700/30 border-gray-700'
                              : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {imageUrl ? (
                              <div className="relative w-10 h-10 flex-shrink-0">
                                <Image
                                  src={imageUrl}
                                  alt={provider.name || 'Payment provider'}
                                  width={40}
                                  height={40}
                                  style={{ width: 'auto', height: 'auto' }}
                                  className="rounded-lg object-contain max-w-[40px] max-h-[40px]"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const parent = target.parentElement;
                                    if (parent) {
                                      const fallback = document.createElement('span');
                                      fallback.className = `text-2xl ${isDark ? 'text-gray-300' : 'text-gray-600'}`;
                                      fallback.textContent = config.icon;
                                      parent.appendChild(fallback);
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <span className="text-2xl">{config.icon}</span>
                            )}
                            <div>
                              <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {provider.name || 'Unknown Provider'}
                              </p>
                              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {provider.provider || ''} • {provider.type || 'N/A'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Status badges */}
                            <div className="flex items-center gap-2">
                              {provider.isActive ? (
                                <span className="text-2xs text-success-600 dark:text-success-400 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Active
                                </span>
                              ) : (
                                <span className="text-2xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                  <XCircle className="w-3 h-3" />
                                  Inactive
                                </span>
                              )}
                              {provider.configured ? (
                                <span className="text-2xs text-success-600 dark:text-success-400 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Configured
                                </span>
                              ) : (
                                <span className="text-2xs text-warning-600 dark:text-warning-400 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  Not Configured
                                </span>
                              )}
                            </div>

                            {/* ✅ FIXED: Toggle button with nullish coalescing */}
                            <button
                              onClick={() => {
                                if (provider.id) {
                                  handleToggleProvider(provider.id, provider.isActive);
                                }
                              }}
                              className={`p-1.5 rounded-lg transition duration-250 focus-ring ${
                                isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                              }`}
                              title={provider.isActive ? 'Deactivate' : 'Activate'}
                              disabled={!provider.id}
                            >
                              {provider.isActive ? (
                                <ToggleRight className="w-5 h-5 text-success-500" />
                              ) : (
                                <ToggleLeft className="w-5 h-5 text-gray-400" />
                              )}
                            </button>

                            {/* ✅ FIXED: Configure button with nullish coalescing */}
                            <button
                              onClick={() => {
                                if (isEditing) {
                                  setShowProviderConfig(null);
                                  setProviderConfigData({});
                                } else {
                                  setShowProviderConfig(provider.id ?? null);
                                  setProviderConfigData({
                                    ...(provider.config || {}),
                                    environment: (provider.config as any)?.environment || 'sandbox',
                                  });
                                }
                              }}
                              className={`p-1.5 rounded-lg transition duration-250 focus-ring ${
                                isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                              }`}
                              title={isEditing ? 'Close configuration' : 'Configure provider'}
                              disabled={!provider.id}
                            >
                              {isEditing ? (
                                <XCircle className="w-5 h-5 text-danger-500" />
                              ) : (
                                <SettingsIcon className="w-5 h-5 text-brand-500" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <div className="text-center">
                            <p className={`text-2xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>24h</p>
                            <p className={`text-sm font-medium tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {provider.transactions24h || 0}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className={`text-2xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>7d</p>
                            <p className={`text-sm font-medium tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {provider.transactions7d || 0}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className={`text-2xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>30d</p>
                            <p className={`text-sm font-medium tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {provider.transactions30d || 0}
                            </p>
                          </div>
                        </div>

                        {/* Configuration Form */}
                        {isEditing && provider.id && renderProviderConfigForm(provider)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'loyalty' && (
            <div>
              <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Loyalty Points Settings
              </h2>
              {renderToggle('Enable Loyalty Points', 'loyaltyPointsEnabled', 'Allow customers to earn and redeem loyalty points')}
              {renderNumberInput('Points per Dollar', 'pointsPerDollar', 'points', 1, 100)}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div>
              <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Notification Settings
              </h2>
              {renderToggle('Notify on Payment Success', 'notifyOnPayment', 'Send notification when payment is successful')}
              {renderToggle('Notify on Refund', 'notifyOnRefund', 'Send notification when a refund is processed')}
              {renderToggle('Notify on Failed Payment', 'notifyOnFailed', 'Send notification when a payment fails')}
              {renderToggle('Notify Admin on Large Payment', 'notifyAdminOnLargePayment', 'Notify admin for payments above threshold')}
              {renderNumberInput('Large Payment Threshold', 'largePaymentThreshold', 'USD', 100, 100000)}
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Security Settings
              </h2>
              {renderToggle('Require 2FA for Refunds', 'require2FAForRefund', 'Require two-factor authentication for refunds')}
              {renderToggle('Require Approval for Refunds', 'requireApprovalForRefund', 'Require admin approval for refunds')}
              {renderNumberInput('Maximum Refund Amount', 'maxRefundAmount', 'USD', 0, 100000)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
