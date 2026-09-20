// D:\Projects\Kalwanga\packages\web\components\payment\PaymentMethodSelector.tsx

'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  CreditCard, Banknote, Wallet, Building, QrCode, Gift, Star,
  CheckCircle, ChevronDown, ChevronUp, Info, AlertCircle,
  Smartphone, Landmark, Shield, Lock, Zap, Globe
} from 'lucide-react';
import { useThemeStore } from '../../app/stores/themeStore';
import { PaymentProvider } from '../../services/paymentService';

// ============================================
// TYPES
// ============================================

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  icon: React.ReactNode;
  description: string;
  enabled: boolean;
  requiresDetails?: boolean;
  provider?: PaymentProvider;
  providerName?: string;
  providerImageUrl?: string;
  providerDarkImageUrl?: string;
  popular?: boolean;
  recommended?: boolean;
  comingSoon?: boolean;
}

interface PaymentMethodSelectorProps {
  selectedMethod: string;
  onSelect: (methodId: string) => void;
  availableMethods?: PaymentMethod[];
  showProviderInfo?: boolean;
  className?: string;
}

// ============================================
// CONSTANTS - EXACT PROVIDER IMAGE URLs
// ============================================

const PROVIDER_IMAGE_URLS: Record<string, string> = {
  STRIPE: 'https://stripe.com/img/v3/home/social.png',
  PAYPAL: 'https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg',
  FLUTTERWAVE: 'https://flutterwave.com/images/logo/flyer.png',
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
  FLUTTERWAVE: 'https://flutterwave.com/images/logo/flyer.png',
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

const PROVIDER_CONFIGS: Record<string, { icon: string; name: string; color: string }> = {
  STRIPE: { icon: '💳', name: 'Stripe', color: 'primary' },
  PAYPAL: { icon: '💸', name: 'PayPal', color: 'primary' },
  FLUTTERWAVE: { icon: '🌊', name: 'Flutterwave', color: 'cyan' },
  PAYSTACK: { icon: '🔷', name: 'Paystack', color: 'sky' },
  SQUARE: { icon: '⬜', name: 'Square', color: 'gray' },
  CASH: { icon: '💰', name: 'Cash', color: 'success' },
  MOBILE_MONEY: { icon: '📱', name: 'Mobile Money', color: 'brand' },
  BANK_TRANSFER: { icon: '🏦', name: 'Bank Transfer', color: 'indigo' },
  GIFT_CARD: { icon: '🎁', name: 'Gift Card', color: 'brand' },
  LOYALTY_POINTS: { icon: '⭐', name: 'Loyalty Points', color: 'warning' },
  MTN: { icon: '📱', name: 'MTN Mobile Money', color: 'warning' },
  AIRTEL: { icon: '📱', name: 'Airtel Money', color: 'danger' },
  TIGO: { icon: '📱', name: 'Tigo Pesa', color: 'primary' },
  VODAFONE: { icon: '📱', name: 'Vodafone Cash', color: 'danger' },
};

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'CASH',
    name: 'Cash',
    code: 'CASH',
    icon: <Banknote className="w-5 h-5" />,
    description: 'Pay with cash at the counter',
    enabled: true,
    provider: PaymentProvider.CASH,
    providerName: 'Cash Payment',
    providerImageUrl: PROVIDER_IMAGE_URLS.CASH,
    providerDarkImageUrl: PROVIDER_DARK_IMAGE_URLS.CASH,
    popular: true,
  },
  {
    id: 'CREDIT_CARD',
    name: 'Credit Card',
    code: 'CREDIT_CARD',
    icon: <CreditCard className="w-5 h-5" />,
    description: 'Pay with credit card (Visa, Mastercard, Amex)',
    enabled: true,
    requiresDetails: true,
    provider: PaymentProvider.STRIPE,
    providerName: 'Stripe',
    providerImageUrl: PROVIDER_IMAGE_URLS.STRIPE,
    providerDarkImageUrl: PROVIDER_DARK_IMAGE_URLS.STRIPE,
    popular: true,
    recommended: true,
  },
  {
    id: 'DEBIT_CARD',
    name: 'Debit Card',
    code: 'DEBIT_CARD',
    icon: <Wallet className="w-5 h-5" />,
    description: 'Pay with your debit card',
    enabled: true,
    requiresDetails: true,
    provider: PaymentProvider.STRIPE,
    providerName: 'Stripe',
    providerImageUrl: PROVIDER_IMAGE_URLS.STRIPE,
    providerDarkImageUrl: PROVIDER_DARK_IMAGE_URLS.STRIPE,
  },
  {
    id: 'PAYPAL',
    name: 'PayPal',
    code: 'PAYPAL',
    icon: <Globe className="w-5 h-5" />,
    description: 'Pay with your PayPal wallet',
    enabled: true,
    requiresDetails: true,
    provider: PaymentProvider.PAYPAL,
    providerName: 'PayPal',
    providerImageUrl: PROVIDER_IMAGE_URLS.PAYPAL,
    providerDarkImageUrl: PROVIDER_DARK_IMAGE_URLS.PAYPAL,
    popular: true,
  },
  {
    id: 'FLUTTERWAVE',
    name: 'Flutterwave',
    code: 'FLUTTERWAVE',
    icon: <Globe className="w-5 h-5" />,
    description: 'Pay with Flutterwave (Cards, Mobile Money, Bank Transfer)',
    enabled: true,
    requiresDetails: true,
    provider: PaymentProvider.FLUTTERWAVE,
    providerName: 'Flutterwave',
    providerImageUrl: PROVIDER_IMAGE_URLS.FLUTTERWAVE,
    providerDarkImageUrl: PROVIDER_DARK_IMAGE_URLS.FLUTTERWAVE,
  },
  {
    id: 'PAYSTACK',
    name: 'Paystack',
    code: 'PAYSTACK',
    icon: <CreditCard className="w-5 h-5" />,
    description: 'Pay with Paystack (Cards, Bank Transfer, USSD)',
    enabled: true,
    requiresDetails: true,
    provider: PaymentProvider.PAYSTACK,
    providerName: 'Paystack',
    providerImageUrl: PROVIDER_IMAGE_URLS.PAYSTACK,
    providerDarkImageUrl: PROVIDER_DARK_IMAGE_URLS.PAYSTACK,
  },
  {
    id: 'SQUARE',
    name: 'Square',
    code: 'SQUARE',
    icon: <CreditCard className="w-5 h-5" />,
    description: 'Pay with Square (Cards, Digital Wallet)',
    enabled: true,
    requiresDetails: true,
    provider: PaymentProvider.SQUARE,
    providerName: 'Square',
    providerImageUrl: PROVIDER_IMAGE_URLS.SQUARE,
    providerDarkImageUrl: PROVIDER_DARK_IMAGE_URLS.SQUARE,
  },
  {
    id: 'MOBILE_MONEY',
    name: 'Mobile Money',
    code: 'MOBILE_MONEY',
    icon: <Smartphone className="w-5 h-5" />,
    description: 'M-Pesa, Tigo Pesa, Airtel Money',
    enabled: true,
    requiresDetails: true,
    provider: PaymentProvider.MOBILE_MONEY,
    providerName: 'Mobile Money',
    providerImageUrl: PROVIDER_IMAGE_URLS.MOBILE_MONEY,
    providerDarkImageUrl: PROVIDER_DARK_IMAGE_URLS.MOBILE_MONEY,
    popular: true,
  },
  {
    id: 'BANK_TRANSFER',
    name: 'Bank Transfer',
    code: 'BANK_TRANSFER',
    icon: <Landmark className="w-5 h-5" />,
    description: 'Direct bank transfer',
    enabled: true,
    requiresDetails: true,
    provider: PaymentProvider.BANK_TRANSFER,
    providerName: 'Bank Transfer',
    providerImageUrl: PROVIDER_IMAGE_URLS.BANK_TRANSFER,
    providerDarkImageUrl: PROVIDER_DARK_IMAGE_URLS.BANK_TRANSFER,
  },
  {
    id: 'GIFT_CARD',
    name: 'Gift Card',
    code: 'GIFT_CARD',
    icon: <Gift className="w-5 h-5" />,
    description: 'Redeem your gift card',
    enabled: true,
    requiresDetails: true,
    provider: PaymentProvider.GIFT_CARD,
    providerName: 'Gift Card',
    providerImageUrl: PROVIDER_IMAGE_URLS.GIFT_CARD,
    providerDarkImageUrl: PROVIDER_DARK_IMAGE_URLS.GIFT_CARD,
  },
  {
    id: 'LOYALTY_POINTS',
    name: 'Loyalty Points',
    code: 'LOYALTY_POINTS',
    icon: <Star className="w-5 h-5" />,
    description: 'Pay with your loyalty points',
    enabled: true,
    requiresDetails: true,
    provider: PaymentProvider.LOYALTY_POINTS,
    providerName: 'Loyalty Points',
    providerImageUrl: PROVIDER_IMAGE_URLS.LOYALTY_POINTS,
    providerDarkImageUrl: PROVIDER_DARK_IMAGE_URLS.LOYALTY_POINTS,
  },
];

// ============================================
// MAIN COMPONENT
// ============================================

export function PaymentMethodSelector({
  selectedMethod,
  onSelect,
  availableMethods = DEFAULT_PAYMENT_METHODS,
  showProviderInfo = true,
  className = '',
}: PaymentMethodSelectorProps) {
  const { isDark } = useThemeStore();
  const [showAll, setShowAll] = useState(false);
  const [hoveredMethod, setHoveredMethod] = useState<string | null>(null);

  // Filter enabled methods
  const enabledMethods = availableMethods.filter(m => m.enabled);
  const filteredMethods = showAll
    ? enabledMethods
    : enabledMethods.slice(0, 6);

  const selected = availableMethods.find(m => m.id === selectedMethod);

  const getProviderImageUrl = (method: PaymentMethod): string => {
    if (!method.providerImageUrl) return '';
    return isDark && method.providerDarkImageUrl
      ? method.providerDarkImageUrl
      : method.providerImageUrl;
  };

  const getProviderConfig = (providerCode?: string) => {
    if (!providerCode) return null;
    return PROVIDER_CONFIGS[providerCode] || null;
  };

  // Group methods by category
  const getMethodCategory = (methodId: string): 'card' | 'digital' | 'mobile' | 'bank' | 'cash' | 'other' => {
    const categories: Record<string, 'card' | 'digital' | 'mobile' | 'bank' | 'cash' | 'other'> = {
      CREDIT_CARD: 'card',
      DEBIT_CARD: 'card',
      PAYPAL: 'digital',
      FLUTTERWAVE: 'digital',
      PAYSTACK: 'digital',
      SQUARE: 'card',
      MOBILE_MONEY: 'mobile',
      BANK_TRANSFER: 'bank',
      GIFT_CARD: 'digital',
      LOYALTY_POINTS: 'digital',
      CASH: 'cash',
    };
    return categories[methodId] || 'other';
  };

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      card: 'Cards',
      digital: 'Digital Wallets',
      mobile: 'Mobile Money',
      bank: 'Bank Transfers',
      cash: 'Cash',
      other: 'Other',
    };
    return labels[category] || category;
  };

  return (
    <div className={`${className} animate-fade-in`}>
      <div className="space-y-6">
        {/* Selected Method Display */}
        {selected && (
          <div className={`p-4 rounded-2xl border-2 border-brand-500 bg-brand-50 dark:bg-brand-900/20 transition duration-250 ${
            isDark ? 'border-brand-400' : 'border-brand-500'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-brand-100 dark:bg-brand-900/30`}>
                  {selected.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {selected.name}
                    </p>
                    {selected.recommended && (
                      <span className="text-2xs font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 px-2 py-0.5 rounded-md">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {selected.description}
                  </p>
                  {showProviderInfo && selected.providerName && (
                    <div className="flex items-center gap-2 mt-1">
                      {getProviderImageUrl(selected) ? (
                        <div className="relative w-5 h-5">
                          <Image
                            src={getProviderImageUrl(selected)}
                            alt={selected.providerName}
                            width={20}
                            height={20}
                            className="rounded object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : null}
                      <span className={`text-xs ${isDark ? 'text-brand-400' : 'text-brand-600'}`}>
                        Powered by {selected.providerName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <CheckCircle className="w-6 h-6 text-brand-500" />
            </div>
          </div>
        )}

        {/* Payment Methods Grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Available Payment Methods
            </p>
            <span className={`text-2xs tabular-nums ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {enabledMethods.length} methods
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredMethods.map((method) => {
              const isSelected = selectedMethod === method.id;
              const isHovered = hoveredMethod === method.id;
              const isComingSoon = method.comingSoon || false;
              const providerConfig = getProviderConfig(method.provider);
              const imageUrl = getProviderImageUrl(method);
              const category = getMethodCategory(method.id);

              return (
                <button
                  key={method.id}
                  onClick={() => !isComingSoon && onSelect(method.id)}
                  onMouseEnter={() => setHoveredMethod(method.id)}
                  onMouseLeave={() => setHoveredMethod(null)}
                  className={`p-4 border-2 rounded-2xl text-center transition duration-250 relative focus-ring ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-brand scale-[1.02]'
                      : isComingSoon
                        ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed'
                        : 'border-gray-200 dark:border-gray-600 hover:border-brand-300 dark:hover:border-brand-500 hover:shadow-card-hover'
                  } ${!method.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={!method.enabled || isComingSoon}
                >
                  <div className="flex flex-col items-center gap-2">
                    {/* Provider Logo or Icon */}
                    <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center transition duration-250 ${
                      isSelected
                        ? 'bg-brand-100 dark:bg-brand-900/30'
                        : isHovered && !isComingSoon
                          ? 'bg-gray-100 dark:bg-gray-700'
                          : 'bg-gray-100 dark:bg-gray-700/50'
                    }`}>
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={method.name}
                          width={36}
                          height={36}
                          className="rounded object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const parent = (e.target as HTMLImageElement).parentElement;
                            if (parent) {
                              const fallback = document.createElement('span');
                              fallback.className = 'text-2xl';
                              fallback.textContent = providerConfig?.icon || '💳';
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      ) : (
                        <span className="text-2xl">{providerConfig?.icon || method.icon}</span>
                      )}
                    </div>

                    <span className={`text-sm font-medium ${
                      isSelected
                        ? 'text-brand-600 dark:text-brand-400'
                        : isComingSoon
                          ? 'text-gray-400 dark:text-gray-500'
                          : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {method.name}
                    </span>

                    {method.popular && !isComingSoon && (
                      <span className="absolute top-2 right-2 text-2xs font-medium bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300 px-1.5 py-0.5 rounded-md">
                        Popular
                      </span>
                    )}

                    {method.recommended && !isComingSoon && (
                      <span className="absolute top-2 left-2 text-2xs font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 px-1.5 py-0.5 rounded-md">
                        Best
                      </span>
                    )}

                    {isComingSoon && (
                      <span className="absolute top-2 right-2 text-2xs font-medium bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300 px-1.5 py-0.5 rounded-md">
                        Soon
                      </span>
                    )}

                    {isSelected && (
                      <CheckCircle className="w-4 h-4 text-brand-500 absolute bottom-2 right-2" />
                    )}

                    {showProviderInfo && method.providerName && !isComingSoon && (
                      <span className={`text-2xs ${isSelected ? 'text-brand-500' : 'text-gray-400 dark:text-gray-500'}`}>
                        {method.providerName}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {enabledMethods.length > 6 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className={`mt-4 text-sm flex items-center gap-1 transition duration-250 focus-ring rounded ${
                isDark ? 'text-brand-400 hover:text-brand-300' : 'text-brand-600 hover:text-brand-700'
              }`}
            >
              {showAll ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show All ({enabledMethods.length} methods)
                </>
              )}
            </button>
          )}
        </div>

        {/* Security Badge */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-200 dark:border-gray-700">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-success-500" />
            Secure
          </span>
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-brand-500" />
            Encrypted
          </span>
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-brand-500" />
            Instant
          </span>
          <span className="flex items-center gap-1 text-2xs text-gray-400 dark:text-gray-500">
            <Info className="w-3 h-3" />
            All transactions are secure
          </span>
        </div>
      </div>
    </div>
  );
}
