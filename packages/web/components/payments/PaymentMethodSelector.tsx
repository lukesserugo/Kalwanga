// packages/web/components/payment/PaymentMethodSelector.tsx

'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  CreditCard,
  Banknote,
  Wallet,
  Gift,
  Star,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Info,
  Smartphone,
  Landmark,
  Shield,
  Lock,
  Zap,
  Globe,
} from 'lucide-react';
import { useThemeStore } from '../../app/stores/themeStore';
import { PaymentProvider } from '../../services/paymentService';
import { getProviderLogo } from '../payments/ProviderLogos';

// ============================================
// TYPES
// ============================================

export interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  icon: React.ReactNode;
  description: string;
  enabled: boolean;
  requiresDetails?: boolean;
  provider?: PaymentProvider | string;
  providerName?: string;
  popular?: boolean;
  recommended?: boolean;
  comingSoon?: boolean;
  isHealthy?: boolean;
  configured?: boolean;
}

interface PaymentMethodSelectorProps {
  selectedMethod: string;
  onSelect: (methodId: string) => void;
  availableMethods?: PaymentMethod[];
  showProviderInfo?: boolean;
  respectConfiguration?: boolean;
  className?: string;
}

// ============================================
// PROVIDER TEXT CONFIG
// ============================================
//
// Only text metadata lives here now. The artwork comes from
// `getProviderLogo`, which returns an inline React SVG
// component — no image URL, no `/public/` file, no 404.

const PROVIDER_CONFIGS: Record<
  string,
  { icon: string; name: string; color: string }
> = {
  STRIPE: { icon: '💳', name: 'Stripe', color: 'primary' },
  PAYPAL: { icon: '💸', name: 'PayPal', color: 'primary' },
  FLUTTERWAVE: { icon: '🌊', name: 'Flutterwave', color: 'cyan' },
  SQUARE: { icon: '⬜', name: 'Square', color: 'gray' },
  CASH: { icon: '💰', name: 'Cash', color: 'success' },
  MOBILE_MONEY: {
    icon: '📱',
    name: 'Mobile Money',
    color: 'brand',
  },
  BANK_TRANSFER: {
    icon: '🏦',
    name: 'Bank Transfer',
    color: 'indigo',
  },
  GIFT_CARD: { icon: '🎁', name: 'Gift Card', color: 'brand' },
  LOYALTY_POINTS: {
    icon: '⭐',
    name: 'Loyalty Points',
    color: 'warning',
  },
  MTN: { icon: '📱', name: 'MTN Mobile Money', color: 'warning' },
  AIRTEL: { icon: '📱', name: 'Airtel Money', color: 'danger' },
  MPESA: { icon: '📱', name: 'M-Pesa', color: 'green' },
};

// ============================================
// DEFAULT METHODS
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
    popular: true,
  },
  {
    id: 'FLUTTERWAVE',
    name: 'Flutterwave',
    code: 'FLUTTERWAVE',
    icon: <Globe className="w-5 h-5" />,
    description:
      'Pay with Flutterwave (Cards, Mobile Money, Bank Transfer)',
    enabled: true,
    requiresDetails: true,
    provider: PaymentProvider.FLUTTERWAVE,
    providerName: 'Flutterwave',
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
  },
  {
    id: 'MOBILE_MONEY',
    name: 'Mobile Money',
    code: 'MOBILE_MONEY',
    icon: <Smartphone className="w-5 h-5" />,
    description: 'MTN, Airtel Money, M-Pesa',
    enabled: true,
    requiresDetails: true,
    provider: PaymentProvider.MOBILE_MONEY,
    providerName: 'Mobile Money',
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
  },
];

// ============================================
// DISABLE-REASON METADATA
// ============================================

const DISABLE_BADGE_LABELS: Record<string, string> = {
  'Coming soon': 'Soon',
  'Not available': 'Off',
  'Provider unavailable': 'Offline',
  'Not configured — ask an admin to enable it': 'Setup',
};

// ============================================
// MAIN COMPONENT
// ============================================

export function PaymentMethodSelector({
  selectedMethod,
  onSelect,
  availableMethods = DEFAULT_PAYMENT_METHODS,
  showProviderInfo = true,
  respectConfiguration = false,
  className = '',
}: PaymentMethodSelectorProps) {
  const { isDark } = useThemeStore();
  const [showAll, setShowAll] = useState(false);
  const [hoveredMethod, setHoveredMethod] = useState<string | null>(null);

  const enabledMethods = useMemo(
    () => availableMethods.filter((m) => m.enabled),
    [availableMethods],
  );

  const filteredMethods = useMemo(
    () => (showAll ? enabledMethods : enabledMethods.slice(0, 6)),
    [showAll, enabledMethods],
  );

  const selected = useMemo(
    () => availableMethods.find((m) => m.id === selectedMethod),
    [availableMethods, selectedMethod],
  );

  const getProviderConfig = useCallback((providerCode?: string) => {
    if (!providerCode) return null;
    const key = providerCode.toUpperCase();
    return PROVIDER_CONFIGS[key] || null;
  }, []);

  const getDisabledReason = useCallback(
    (method: PaymentMethod): string | null => {
      if (method.comingSoon) return 'Coming soon';
      if (!method.enabled) return 'Not available';
      if (method.isHealthy === false) return 'Provider unavailable';
      if (respectConfiguration && method.configured === false) {
        return 'Not configured — ask an admin to enable it';
      }
      return null;
    },
    [respectConfiguration],
  );

  return (
    <div className={`${className} animate-fade-in`}>
      <div className="space-y-6">
        {/* Selected Method Display */}
        {selected && (
          <div
            className={`p-4 rounded-2xl border-2 border-brand-500 bg-brand-50 dark:bg-brand-900/20 transition duration-250 ${
              isDark ? 'border-brand-400' : 'border-brand-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-brand-100 dark:bg-brand-900/30">
                  {selected.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p
                      className={`font-semibold text-lg ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {selected.name}
                    </p>
                    {selected.recommended && (
                      <span className="text-2xs font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 px-2 py-0.5 rounded-md">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    {selected.description}
                  </p>
                  {showProviderInfo && selected.providerName && (
                    <div className="flex items-center gap-2 mt-1">
                      {(() => {
                        const SelectedLogo = getProviderLogo(
                          typeof selected.provider === 'string'
                            ? selected.provider
                            : undefined,
                        );
                        if (!SelectedLogo) return null;
                        return (
                          <SelectedLogo className="w-5 h-5 rounded object-contain" />
                        );
                      })()}
                      <span
                        className={`text-xs ${
                          isDark ? 'text-brand-400' : 'text-brand-600'
                        }`}
                      >
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
            <p
              className={`text-sm font-medium ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Available Payment Methods
            </p>
            <span
              className={`text-2xs tabular-nums ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              {enabledMethods.length} methods
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredMethods.map((method) => {
              const isSelected = selectedMethod === method.id;
              const isHovered = hoveredMethod === method.id;
              const disabledReason = getDisabledReason(method);
              const isDisabled = disabledReason !== null;
              const providerConfig = getProviderConfig(
                typeof method.provider === 'string'
                  ? method.provider
                  : undefined,
              );
              const Logo = getProviderLogo(
                typeof method.provider === 'string'
                  ? method.provider
                  : undefined,
              );
              const badgeLabel = disabledReason
                ? DISABLE_BADGE_LABELS[disabledReason] ?? 'Off'
                : null;

              return (
                <button
                  key={method.id}
                  onClick={() => !isDisabled && onSelect(method.id)}
                  onMouseEnter={() => setHoveredMethod(method.id)}
                  onMouseLeave={() => setHoveredMethod(null)}
                  className={`p-4 border-2 rounded-2xl text-center transition duration-250 relative focus-ring ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-brand scale-[1.02]'
                      : isDisabled
                        ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed'
                        : 'border-gray-200 dark:border-gray-600 hover:border-brand-300 dark:hover:border-brand-500 hover:shadow-card-hover'
                  } ${!method.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={isDisabled}
                  aria-pressed={isSelected}
                  aria-label={`${method.name} — ${method.description}`}
                  title={disabledReason || method.description}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`relative w-12 h-12 rounded-xl flex items-center justify-center transition duration-250 ${
                        isSelected
                          ? 'bg-brand-100 dark:bg-brand-900/30'
                          : isHovered && !isDisabled
                            ? 'bg-gray-100 dark:bg-gray-700'
                            : 'bg-gray-100 dark:bg-gray-700/50'
                      }`}
                    >
                      {Logo ? (
                        <Logo className="w-9 h-9 rounded object-contain" />
                      ) : (
                        <span className="text-2xl">
                          {providerConfig?.icon || method.icon}
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-sm font-medium ${
                        isSelected
                          ? 'text-brand-600 dark:text-brand-400'
                          : isDisabled
                            ? 'text-gray-400 dark:text-gray-500'
                            : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {method.name}
                    </span>

                    {method.popular && !isDisabled && (
                      <span className="absolute top-2 right-2 text-2xs font-medium bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300 px-1.5 py-0.5 rounded-md">
                        Popular
                      </span>
                    )}

                    {method.recommended && !isDisabled && (
                      <span className="absolute top-2 left-2 text-2xs font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 px-1.5 py-0.5 rounded-md">
                        Best
                      </span>
                    )}

                    {method.comingSoon && (
                      <span className="absolute top-2 right-2 text-2xs font-medium bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300 px-1.5 py-0.5 rounded-md">
                        Soon
                      </span>
                    )}

                    {!method.comingSoon &&
                      disabledReason !== null &&
                      badgeLabel !== null && (
                        <span className="absolute top-2 right-2 text-2xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded-md">
                          {badgeLabel}
                        </span>
                      )}

                    {isSelected && (
                      <CheckCircle className="w-4 h-4 text-brand-500 absolute bottom-2 right-2" />
                    )}

                    {showProviderInfo &&
                      method.providerName &&
                      !isDisabled && (
                        <span
                          className={`text-2xs ${
                            isSelected
                              ? 'text-brand-500'
                              : 'text-gray-400 dark:text-gray-500'
                          }`}
                        >
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
                isDark
                  ? 'text-brand-400 hover:text-brand-300'
                  : 'text-brand-600 hover:text-brand-700'
              }`}
              aria-expanded={showAll}
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

export default PaymentMethodSelector;
