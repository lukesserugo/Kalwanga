// D:\Projects\Kalwanga\packages\web\components\payment\PaymentForm.tsx

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  CreditCard, Banknote, Wallet, Building, QrCode, Gift, Star,
  Eye, EyeOff, Smartphone, Landmark, CheckCircle, XCircle,
  Loader2, AlertCircle, Shield, Lock, Zap, ArrowRight,
  Globe, ChevronDown
} from 'lucide-react';
import { useThemeStore } from '../../app/stores/themeStore';
import { formatCurrency } from '../../utils/formatters';
import { toast } from '../../utils/toast-manager';

// ============================================
// TYPES
// ============================================

interface PaymentFormProps {
  amount: number;
  currency?: string;
  paymentMethod: string;
  provider?: string;
  customerId?: string;
  customerLoyaltyPoints?: number;
  onSuccess?: (payment: any) => void;
  onError?: (error: any) => void;
  onCancel?: () => void;
  className?: string;
}

interface PaymentDetails {
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
  cardHolder?: string;
  phoneNumber?: string;
  provider?: string;
  giftCardCode?: string;
  loyaltyPoints?: number;
  bankReference?: string;
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
};

const PROVIDER_DARK_IMAGE_URLS: Record<string, string> = {
  STRIPE: 'https://stripe.com/img/v3/home/social.png',
  PAYPAL: 'https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg',
  FLUTTERWAVE: 'https://flutterwave.com/images/logo/flyer.png',
  PAYSTACK: 'https://paystack.com/assets/images/logo-white.png',
  SQUARE: 'https://squareup.com/icons/square_logo.svg',
};

const PROVIDER_CONFIGS: Record<string, { icon: string; name: string; color: string; description: string }> = {
  STRIPE: { icon: '💳', name: 'Stripe', color: 'blue', description: 'Credit and debit card payments' },
  PAYPAL: { icon: '💸', name: 'PayPal', color: 'blue', description: 'PayPal wallet payments' },
  FLUTTERWAVE: { icon: '🌊', name: 'Flutterwave', color: 'cyan', description: 'Cards, Mobile Money, Bank Transfer' },
  PAYSTACK: { icon: '🔷', name: 'Paystack', color: 'sky', description: 'Cards, Bank Transfer, USSD' },
  SQUARE: { icon: '⬜', name: 'Square', color: 'gray', description: 'Cards, Digital Wallet' },
};

// ============================================
// MAIN COMPONENT
// ============================================

export function PaymentForm({
  amount,
  currency = 'USD',
  paymentMethod,
  provider,
  customerId,
  customerLoyaltyPoints = 0,
  onSuccess,
  onError,
  onCancel,
  className = '',
}: PaymentFormProps) {
  const { isDark } = useThemeStore();
  const [step, setStep] = useState<'form' | 'processing' | 'complete' | 'error'>('form');
  const [details, setDetails] = useState<PaymentDetails>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showCvv, setShowCvv] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>(provider || 'STRIPE');
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);

  // Card fields
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardHolder, setCardHolder] = useState('');

  // Mobile Money fields
  const [phoneNumber, setPhoneNumber] = useState('');
  const [mobileProvider, setMobileProvider] = useState('MTN');

  // Gift Card fields
  const [giftCardCode, setGiftCardCode] = useState('');

  // Loyalty Points fields
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);

  // Bank Transfer fields
  const [bankReference, setBankReference] = useState('');

  const maxPoints = Math.min(customerLoyaltyPoints, Math.floor(amount * 10));
  const loyaltyDiscount = (loyaltyPoints || 0) * 0.1;
  const finalAmount = amount - loyaltyDiscount;

  // Get provider config
  const getProviderImageUrl = (providerCode: string): string => {
    return isDark && PROVIDER_DARK_IMAGE_URLS[providerCode]
      ? PROVIDER_DARK_IMAGE_URLS[providerCode]
      : PROVIDER_IMAGE_URLS[providerCode] || '';
  };

  const getProviderConfig = (providerCode: string) => {
    return PROVIDER_CONFIGS[providerCode] || PROVIDER_CONFIGS.STRIPE;
  };

  // Get available providers for the current payment method
  const getAvailableProviders = (): string[] => {
    const methodProviders: Record<string, string[]> = {
      CREDIT_CARD: ['STRIPE', 'FLUTTERWAVE', 'PAYSTACK', 'SQUARE'],
      DEBIT_CARD: ['STRIPE', 'FLUTTERWAVE', 'PAYSTACK', 'SQUARE'],
      PAYPAL: ['PAYPAL'],
      MOBILE_MONEY: ['FLUTTERWAVE', 'PAYSTACK'],
      BANK_TRANSFER: ['FLUTTERWAVE', 'PAYSTACK'],
      GIFT_CARD: ['STRIPE'],
      LOYALTY_POINTS: ['STRIPE'],
    };
    return methodProviders[paymentMethod] || ['STRIPE'];
  };

  // Format card number
  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(' ') : cleaned;
  };

  // Format expiry date
  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    return cleaned;
  };

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (paymentMethod === 'CREDIT_CARD' || paymentMethod === 'DEBIT_CARD') {
      if (!cardNumber.replace(/\s/g, '').match(/^\d{16}$/)) {
        newErrors.cardNumber = 'Invalid card number';
      }
      if (!cardExpiry.match(/^\d{2}\/\d{2}$/)) {
        newErrors.cardExpiry = 'Invalid expiry date (MM/YY)';
      }
      if (!cardCvv.match(/^\d{3,4}$/)) {
        newErrors.cardCvv = 'Invalid CVV';
      }
      if (!cardHolder.trim()) {
        newErrors.cardHolder = 'Card holder name is required';
      }
    }

    if (paymentMethod === 'MOBILE_MONEY') {
      if (!phoneNumber.match(/^\d{9,12}$/)) {
        newErrors.phoneNumber = 'Invalid phone number';
      }
    }

    if (paymentMethod === 'GIFT_CARD') {
      if (!giftCardCode.trim()) {
        newErrors.giftCardCode = 'Gift card code is required';
      }
    }

    if (paymentMethod === 'LOYALTY_POINTS') {
      if (loyaltyPoints <= 0) {
        newErrors.loyaltyPoints = 'Please enter points to use';
      }
      if (loyaltyPoints > maxPoints) {
        newErrors.loyaltyPoints = `Only ${maxPoints} points available`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!validate()) return;

    setProcessing(true);
    setStep('processing');

    try {
      const paymentData: any = {
        amount: finalAmount || amount,
        paymentMethod,
        customerId,
        currency,
        provider: selectedProvider,
        metadata: {},
      };

      // Add method-specific details
      if (paymentMethod === 'CREDIT_CARD' || paymentMethod === 'DEBIT_CARD') {
        paymentData.source = 'card';
        paymentData.metadata = {
          cardLast4: cardNumber.replace(/\s/g, '').slice(-4),
          cardBrand: 'unknown',
        };
      }

      if (paymentMethod === 'MOBILE_MONEY') {
        paymentData.metadata.provider = mobileProvider;
        paymentData.metadata.phoneNumber = phoneNumber;
      }

      if (paymentMethod === 'GIFT_CARD') {
        paymentData.gatewayId = giftCardCode;
      }

      if (paymentMethod === 'LOYALTY_POINTS') {
        paymentData.metadata.pointsToUse = loyaltyPoints;
      }

      if (paymentMethod === 'BANK_TRANSFER') {
        paymentData.metadata.bankReference = bankReference || `BT-${Date.now()}`;
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      const mockPayment = {
        id: `pay_${Date.now()}`,
        amount: finalAmount || amount,
        paymentMethod,
        status: 'PAID',
        reference: `PAY-${Date.now()}`,
        processedAt: new Date().toISOString(),
        provider: selectedProvider,
      };

      setStep('complete');
      onSuccess?.(mockPayment);
      toast.success('Payment processed successfully');
    } catch (error) {
      setStep('error');
      onError?.(error);
      toast.error('Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Render provider selector
  const renderProviderSelector = () => {
    const availableProviders = getAvailableProviders();
    const config = getProviderConfig(selectedProvider);
    const imageUrl = getProviderImageUrl(selectedProvider);

    return (
      <div className="mb-4">
        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Payment Provider
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowProviderDropdown(!showProviderDropdown)}
            className={`w-full flex items-center gap-3 px-4 py-3 border rounded-lg transition ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600'
                : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'
            } ${showProviderDropdown ? 'ring-2 ring-blue-500' : ''}`}
          >
            {imageUrl ? (
              <div className="relative w-8 h-8 flex-shrink-0">
                <Image
                  src={imageUrl}
                  alt={config.name}
                  width={32}
                  height={32}
                  className="rounded object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const parent = (e.target as HTMLImageElement).parentElement;
                    if (parent) {
                      const fallback = document.createElement('span');
                      fallback.className = 'text-xl';
                      fallback.textContent = config.icon;
                      parent.appendChild(fallback);
                    }
                  }}
                />
              </div>
            ) : (
              <span className="text-xl">{config.icon}</span>
            )}
            <span className="flex-1 text-left">{config.name}</span>
            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {config.description}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showProviderDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showProviderDropdown && (
            <div className={`absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg border z-10 overflow-hidden ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            }`}>
              {availableProviders.map((providerCode) => {
                const providerConfig = getProviderConfig(providerCode);
                const providerImageUrl = getProviderImageUrl(providerCode);
                const isSelected = selectedProvider === providerCode;

                return (
                  <button
                    key={providerCode}
                    type="button"
                    onClick={() => {
                      setSelectedProvider(providerCode);
                      setShowProviderDropdown(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 transition ${
                      isSelected
                        ? isDark
                          ? 'bg-blue-900/30 text-white'
                          : 'bg-blue-50 text-blue-700'
                        : isDark
                          ? 'hover:bg-gray-700 text-gray-300'
                          : 'hover:bg-gray-50 text-gray-700'
                    } ${isSelected ? 'border-l-4 border-blue-500' : ''}`}
                  >
                    {providerImageUrl ? (
                      <div className="relative w-8 h-8 flex-shrink-0">
                        <Image
                          src={providerImageUrl}
                          alt={providerConfig.name}
                          width={32}
                          height={32}
                          className="rounded object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const parent = (e.target as HTMLImageElement).parentElement;
                            if (parent) {
                              const fallback = document.createElement('span');
                              fallback.className = 'text-xl';
                              fallback.textContent = providerConfig.icon;
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <span className="text-xl">{providerConfig.icon}</span>
                    )}
                    <span className="flex-1 text-left">{providerConfig.name}</span>
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {providerConfig.description}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render card form
  const renderCardForm = () => (
    <div className="space-y-4">
      {renderProviderSelector()}

      <div>
        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Card Number
        </label>
        <div className="relative">
          <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            placeholder="1234 5678 9012 3456"
            maxLength={19}
            className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } ${errors.cardNumber ? 'border-red-500' : ''}`}
          />
        </div>
        {errors.cardNumber && (
          <p className="mt-1 text-sm text-red-500">{errors.cardNumber}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Expiry Date
          </label>
          <input
            type="text"
            value={cardExpiry}
            onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
            placeholder="MM/YY"
            maxLength={5}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } ${errors.cardExpiry ? 'border-red-500' : ''}`}
          />
          {errors.cardExpiry && (
            <p className="mt-1 text-sm text-red-500">{errors.cardExpiry}</p>
          )}
        </div>
        <div>
          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            CVV
          </label>
          <div className="relative">
            <input
              type={showCvv ? 'text' : 'password'}
              value={cardCvv}
              onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
              placeholder="123"
              maxLength={4}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } ${errors.cardCvv ? 'border-red-500' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowCvv(!showCvv)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showCvv ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.cardCvv && (
            <p className="mt-1 text-sm text-red-500">{errors.cardCvv}</p>
          )}
        </div>
      </div>

      <div>
        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Card Holder Name
        </label>
        <input
          type="text"
          value={cardHolder}
          onChange={(e) => setCardHolder(e.target.value)}
          placeholder="John Doe"
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            isDark
              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
          } ${errors.cardHolder ? 'border-red-500' : ''}`}
        />
        {errors.cardHolder && (
          <p className="mt-1 text-sm text-red-500">{errors.cardHolder}</p>
        )}
      </div>
    </div>
  );

  // Render PayPal form
  const renderPayPalForm = () => (
    <div className="space-y-4">
      <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-blue-50'}`}>
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-blue-500" />
          <div>
            <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              PayPal Checkout
            </p>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              You will be redirected to PayPal to complete your payment
            </p>
          </div>
        </div>
      </div>

      {renderProviderSelector()}

      <div>
        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Email Address
        </label>
        <input
          type="email"
          placeholder="john@example.com"
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            isDark
              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
          }`}
        />
      </div>
    </div>
  );

  // Render Flutterwave specific form
  const renderFlutterwaveForm = () => (
    <div className="space-y-4">
      <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-cyan-50'}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌊</span>
          <div>
            <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Flutterwave Payment
            </p>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Pay with Cards, Mobile Money, or Bank Transfer
            </p>
          </div>
        </div>
      </div>

      {renderProviderSelector()}
    </div>
  );

  // Render mobile money form
  const renderMobileMoneyForm = () => (
    <div className="space-y-4">
      {renderProviderSelector()}

      <div>
        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Phone Number
        </label>
        <div className="relative">
          <Smartphone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
            placeholder="0712345678"
            className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } ${errors.phoneNumber ? 'border-red-500' : ''}`}
          />
        </div>
        {errors.phoneNumber && (
          <p className="mt-1 text-sm text-red-500">{errors.phoneNumber}</p>
        )}
      </div>

      <div>
        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Provider
        </label>
        <select
          value={mobileProvider}
          onChange={(e) => setMobileProvider(e.target.value)}
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            isDark
              ? 'bg-gray-700 border-gray-600 text-white'
              : 'bg-white border-gray-300 text-gray-900'
          }`}
        >
          <option value="MTN">MTN Mobile Money</option>
          <option value="TIGO">Tigo Pesa</option>
          <option value="AIRTEL">Airtel Money</option>
          <option value="VODAFONE">Vodafone Cash</option>
        </select>
      </div>
    </div>
  );

  // Render gift card form
  const renderGiftCardForm = () => (
    <div className="space-y-4">
      {renderProviderSelector()}

      <div>
        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Gift Card Code
        </label>
        <div className="relative">
          <Gift className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={giftCardCode}
            onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
            placeholder="GIFT-XXXX-XXXX"
            className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } ${errors.giftCardCode ? 'border-red-500' : ''}`}
          />
        </div>
        {errors.giftCardCode && (
          <p className="mt-1 text-sm text-red-500">{errors.giftCardCode}</p>
        )}
      </div>
    </div>
  );

  // Render loyalty points form
  const renderLoyaltyPointsForm = () => (
    <div className="space-y-4">
      {renderProviderSelector()}

      <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-blue-50'}`}>
        <div className="flex items-center gap-3">
          <Star className="w-6 h-6 text-yellow-500 fill-current" />
          <div>
            <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Available Points: {customerLoyaltyPoints}
            </p>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {maxPoints} points can be used for this order
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Points to Use
        </label>
        <input
          type="number"
          value={loyaltyPoints}
          onChange={(e) => {
            const val = parseInt(e.target.value) || 0;
            setLoyaltyPoints(Math.min(Math.max(val, 0), maxPoints));
          }}
          min={0}
          max={maxPoints}
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            isDark
              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
          } ${errors.loyaltyPoints ? 'border-red-500' : ''}`}
        />
        {errors.loyaltyPoints && (
          <p className="mt-1 text-sm text-red-500">{errors.loyaltyPoints}</p>
        )}
        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Discount: {formatCurrency(loyaltyDiscount)}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="useMaxPoints"
          checked={loyaltyPoints === maxPoints}
          onChange={(e) => setLoyaltyPoints(e.target.checked ? maxPoints : 0)}
          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
        />
        <label htmlFor="useMaxPoints" className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Use maximum points for this order
        </label>
      </div>
    </div>
  );

  // Render bank transfer form
  const renderBankTransferForm = () => (
    <div className="space-y-4">
      {renderProviderSelector()}

      <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Please make a bank transfer to the following account:
        </p>
        <div className="mt-2 p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <p className={`font-mono text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Bank: Kalwanga Bank
          </p>
          <p className={`font-mono text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Account: 1234567890
          </p>
          <p className={`font-mono text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Reference: BT-{Date.now().toString().slice(-6)}
          </p>
        </div>
      </div>

      <div>
        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Bank Reference Number
        </label>
        <input
          type="text"
          value={bankReference}
          onChange={(e) => setBankReference(e.target.value)}
          placeholder="Enter bank reference"
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            isDark
              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
          }`}
        />
      </div>
    </div>
  );

  // Render form based on payment method
  const renderForm = () => {
    switch (paymentMethod) {
      case 'CREDIT_CARD':
      case 'DEBIT_CARD':
        return renderCardForm();
      case 'PAYPAL':
        return renderPayPalForm();
      case 'FLUTTERWAVE':
        return renderFlutterwaveForm();
      case 'MOBILE_MONEY':
        return renderMobileMoneyForm();
      case 'GIFT_CARD':
        return renderGiftCardForm();
      case 'LOYALTY_POINTS':
        return renderLoyaltyPointsForm();
      case 'BANK_TRANSFER':
        return renderBankTransferForm();
      default:
        return null;
    }
  };

  // Render processing state
  const renderProcessing = () => {
    const config = getProviderConfig(selectedProvider);
    const imageUrl = getProviderImageUrl(selectedProvider);

    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-gray-200 dark:border-gray-700 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-blue-600 rounded-full animate-spin border-t-transparent"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            {imageUrl ? (
              <div className="relative w-8 h-8">
                <Image
                  src={imageUrl}
                  alt={config.name}
                  width={32}
                  height={32}
                  className="rounded object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            )}
          </div>
        </div>
        <h3 className={`mt-4 text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Processing Payment
        </h3>
        <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Please wait while we process your payment via {config.name}...
        </p>
        <div className="mt-4 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
          <Shield className="w-4 h-4" />
          <span>Secure transaction</span>
        </div>
      </div>
    );
  };

  // Render complete state
  const renderComplete = () => {
    const config = getProviderConfig(selectedProvider);
    const imageUrl = getProviderImageUrl(selectedProvider);

    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
          <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
        </div>
        <h3 className={`mt-4 text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Payment Successful!
        </h3>
        <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Your payment has been processed successfully via {config.name}.
        </p>
        {imageUrl && (
          <div className="mt-2 relative w-12 h-12">
            <Image
              src={imageUrl}
              alt={config.name}
              width={48}
              height={48}
              className="rounded object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
        <p className={`text-sm font-medium mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Amount: {formatCurrency(finalAmount || amount)}
        </p>
        <button
          onClick={onCancel}
          className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Continue
        </button>
      </div>
    );
  };

  // Render error state
  const renderError = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
        <XCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
      </div>
      <h3 className={`mt-4 text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
        Payment Failed
      </h3>
      <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        There was an error processing your payment. Please try again.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => setStep('form')}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Try Again
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Amount Display */}
      {step === 'form' && (
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
          <div className="flex justify-between items-center">
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Amount to Pay
            </span>
            <span className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {formatCurrency(finalAmount || amount)}
            </span>
          </div>
          {loyaltyDiscount > 0 && (
            <div className="flex justify-between items-center mt-1">
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Loyalty Discount
              </span>
              <span className="text-sm text-green-600 dark:text-green-400">
                -{formatCurrency(loyaltyDiscount)}
              </span>
            </div>
          )}
          {selectedProvider && (
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                via
              </span>
              {getProviderImageUrl(selectedProvider) ? (
                <div className="relative w-6 h-6">
                  <Image
                    src={getProviderImageUrl(selectedProvider)}
                    alt={getProviderConfig(selectedProvider).name}
                    width={24}
                    height={24}
                    className="rounded object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <span className="text-sm">{getProviderConfig(selectedProvider).icon}</span>
              )}
              <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {getProviderConfig(selectedProvider).name}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {step === 'form' && renderForm()}
          {step === 'processing' && renderProcessing()}
          {step === 'complete' && renderComplete()}
          {step === 'error' && renderError()}
        </motion.div>
      </AnimatePresence>

      {/* Actions */}
      {step === 'form' && (
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={processing}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Pay {formatCurrency(finalAmount || amount)}
              </>
            )}
          </button>
        </div>
      )}

      {/* Trust Badges */}
      {step === 'form' && (
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
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
      )}
    </div>
  );
}
