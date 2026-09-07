// D:\Projects\Kalwanga\packages\web\components\payment\PaymentMethodSelector.tsx

'use client';

import { useState } from 'react';
import {
  CreditCard, Banknote, Wallet, Building, QrCode, Gift, Star,
  CheckCircle, ChevronDown, ChevronUp, Info, AlertCircle,
  Smartphone, Landmark, Shield, Lock, Zap
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
  popular?: boolean;
  recommended?: boolean;
}

interface PaymentMethodSelectorProps {
  selectedMethod: string;
  onSelect: (methodId: string) => void;
  availableMethods?: PaymentMethod[];
  showProviderInfo?: boolean;
  className?: string;
}

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
    id: 'MOBILE_MONEY',
    name: 'Mobile Money',
    code: 'MOBILE_MONEY',
    icon: <Smartphone className="w-5 h-5" />,
    description: 'M-Pesa, Tigo Pesa, Airtel Money',
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

  const filteredMethods = showAll 
    ? availableMethods.filter(m => m.enabled)
    : availableMethods.filter(m => m.enabled).slice(0, 4);

  const selected = availableMethods.find(m => m.id === selectedMethod);

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Selected Method Display */}
        {selected && (
          <div className={`p-4 rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 ${
            isDark ? 'border-blue-400' : 'border-blue-500'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30`}>
                  {selected.icon}
                </div>
                <div>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {selected.name}
                  </p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {selected.description}
                  </p>
                  {showProviderInfo && selected.providerName && (
                    <span className={`text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                      Powered by {selected.providerName}
                    </span>
                  )}
                </div>
              </div>
              <CheckCircle className="w-5 h-5 text-blue-500" />
            </div>
          </div>
        )}

        {/* Payment Methods Grid */}
        <div>
          <p className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Available Payment Methods
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredMethods.map((method) => {
              const isSelected = selectedMethod === method.id;
              return (
                <button
                  key={method.id}
                  onClick={() => onSelect(method.id)}
                  className={`p-4 border-2 rounded-xl text-center transition-all relative ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                      : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                  } ${!method.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={!method.enabled}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className={`p-2 rounded-lg ${
                      isSelected
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                      {method.icon}
                    </div>
                    <span className={`text-sm font-medium ${
                      isSelected
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {method.name}
                    </span>
                    {method.popular && (
                      <span className="absolute top-2 right-2 text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-1.5 py-0.5 rounded">
                        Popular
                      </span>
                    )}
                    {method.recommended && (
                      <span className="absolute top-2 left-2 text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded">
                        Best
                      </span>
                    )}
                    {isSelected && (
                      <CheckCircle className="w-4 h-4 text-blue-500 absolute bottom-2 right-2" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {availableMethods.length > 4 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className={`mt-3 text-sm flex items-center gap-1 ${
                isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
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
                  Show All ({availableMethods.length})
                </>
              )}
            </button>
          )}
        </div>

        {/* Security Badge */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-green-500" />
            Secure
          </span>
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-blue-500" />
            Encrypted
          </span>
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-orange-500" />
            Instant
          </span>
        </div>
      </div>
    </div>
  );
}
