// D:\Projects\Kalwanga\packages\web\components\checkout\PaymentSection.tsx

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Banknote, Wallet, Building, QrCode, Gift, Star,
  ChevronDown, ChevronUp, CheckCircle, XCircle, Loader2,
  Lock, Shield, Clock, Zap, Sparkles, AlertCircle,
  Eye, EyeOff, Copy, Check, ArrowRight, ArrowLeft,
  Smartphone, Landmark, Receipt, Printer, Download
} from 'lucide-react';
import { useThemeStore } from '../../app/stores/themeStore';
import { formatCurrency } from '../../utils/formatters';
import { toast } from '../../utils/toast-manager';

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
}

interface PaymentDetails {
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
  cardHolder?: string;
  mobileNumber?: string;
  provider?: string;
  bankReference?: string;
  giftCardCode?: string;
  loyaltyPoints?: number;
}

interface PaymentSectionProps {
  total: number;
  currency?: string;
  onPaymentComplete: (paymentMethod: string, details: PaymentDetails) => void;
  onPaymentCancel?: () => void;
  isProcessing?: boolean;
  availablePaymentMethods?: PaymentMethod[];
  customerLoyaltyPoints?: number;
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
    icon: <Banknote className="w-6 h-6" />,
    description: 'Pay with cash at the counter',
    enabled: true,
  },
  {
    id: 'CREDIT_CARD',
    name: 'Credit Card',
    code: 'CREDIT_CARD',
    icon: <CreditCard className="w-6 h-6" />,
    description: 'Visa, Mastercard, Amex',
    enabled: true,
    requiresDetails: true,
  },
  {
    id: 'DEBIT_CARD',
    name: 'Debit Card',
    code: 'DEBIT_CARD',
    icon: <Wallet className="w-6 h-6" />,
    description: 'Pay with your debit card',
    enabled: true,
    requiresDetails: true,
  },
  {
    id: 'MOBILE_MONEY',
    name: 'Mobile Money',
    code: 'MOBILE_MONEY',
    icon: <Smartphone className="w-6 h-6" />,
    description: 'M-Pesa, Tigo Pesa, Airtel Money',
    enabled: true,
    requiresDetails: true,
  },
  {
    id: 'BANK_TRANSFER',
    name: 'Bank Transfer',
    code: 'BANK_TRANSFER',
    icon: <Landmark className="w-6 h-6" />,
    description: 'Direct bank transfer',
    enabled: true,
    requiresDetails: true,
  },
  {
    id: 'GIFT_CARD',
    name: 'Gift Card',
    code: 'GIFT_CARD',
    icon: <Gift className="w-6 h-6" />,
    description: 'Redeem your gift card',
    enabled: true,
    requiresDetails: true,
  },
  {
    id: 'LOYALTY_POINTS',
    name: 'Loyalty Points',
    code: 'LOYALTY_POINTS',
    icon: <Star className="w-6 h-6" />,
    description: 'Pay with your loyalty points',
    enabled: true,
    requiresDetails: true,
  },
];

// ============================================
// PAYMENT SECTION COMPONENT
// ============================================

export function PaymentSection({
  total,
  currency = 'USD',
  onPaymentComplete,
  onPaymentCancel,
  isProcessing = false,
  availablePaymentMethods = DEFAULT_PAYMENT_METHODS,
  customerLoyaltyPoints = 0,
  className = '',
}: PaymentSectionProps) {
  const { isDark } = useThemeStore();
  const [selectedMethod, setSelectedMethod] = useState<string>('CASH');
  const [showDetails, setShowDetails] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails>({});
  const [step, setStep] = useState<'select' | 'details' | 'processing' | 'complete'>('select');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [provider, setProvider] = useState('MTN');
  const [giftCardCode, setGiftCardCode] = useState('');
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
  const [loyaltyPointsToUse, setLoyaltyPointsToUse] = useState(0);
  const [bankReference, setBankReference] = useState('');
  const [showCvv, setShowCvv] = useState(false);

  const selectedPaymentMethod = availablePaymentMethods.find(m => m.id === selectedMethod);
  const maxLoyaltyPoints = Math.min(customerLoyaltyPoints, Math.floor(total * 10));
  const loyaltyDiscount = (loyaltyPointsToUse || 0) * 0.1;
  const finalTotal = total - loyaltyDiscount;

  // Format card number with spaces
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

  // Validate payment details
  const validateDetails = () => {
    const newErrors: Record<string, string> = {};

    if (selectedMethod === 'CREDIT_CARD' || selectedMethod === 'DEBIT_CARD') {
      if (!cardNumber.replace(/\s/g, '').match(/^\d{16}$/)) {
        newErrors.cardNumber = 'Please enter a valid 16-digit card number';
      }
      if (!cardExpiry.match(/^\d{2}\/\d{2}$/)) {
        newErrors.cardExpiry = 'Please enter a valid expiry date (MM/YY)';
      }
      if (!cardCvv.match(/^\d{3,4}$/)) {
        newErrors.cardCvv = 'Please enter a valid CVV';
      }
      if (!cardHolder.trim()) {
        newErrors.cardHolder = 'Card holder name is required';
      }
    }

    if (selectedMethod === 'MOBILE_MONEY') {
      if (!mobileNumber.match(/^\d{9,12}$/)) {
        newErrors.mobileNumber = 'Please enter a valid phone number';
      }
    }

    if (selectedMethod === 'GIFT_CARD') {
      if (!giftCardCode.trim()) {
        newErrors.giftCardCode = 'Gift card code is required';
      }
    }

    if (selectedMethod === 'LOYALTY_POINTS') {
      if (loyaltyPointsToUse <= 0) {
        newErrors.loyaltyPoints = 'Please enter the number of points to use';
      }
      if (loyaltyPointsToUse > maxLoyaltyPoints) {
        newErrors.loyaltyPoints = `You have only ${maxLoyaltyPoints} points available`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle payment submission
  const handleSubmit = async () => {
    if (!validateDetails()) return;

    setStep('processing');

    const details: PaymentDetails = {
      cardNumber: selectedMethod === 'CREDIT_CARD' || selectedMethod === 'DEBIT_CARD' ? cardNumber : undefined,
      cardExpiry: selectedMethod === 'CREDIT_CARD' || selectedMethod === 'DEBIT_CARD' ? cardExpiry : undefined,
      cardCvv: selectedMethod === 'CREDIT_CARD' || selectedMethod === 'DEBIT_CARD' ? cardCvv : undefined,
      cardHolder: selectedMethod === 'CREDIT_CARD' || selectedMethod === 'DEBIT_CARD' ? cardHolder : undefined,
      mobileNumber: selectedMethod === 'MOBILE_MONEY' ? mobileNumber : undefined,
      provider: selectedMethod === 'MOBILE_MONEY' ? provider : undefined,
      giftCardCode: selectedMethod === 'GIFT_CARD' ? giftCardCode : undefined,
      loyaltyPoints: selectedMethod === 'LOYALTY_POINTS' ? loyaltyPointsToUse : undefined,
      bankReference: selectedMethod === 'BANK_TRANSFER' ? bankReference : undefined,
    };

    try {
      await onPaymentComplete(selectedMethod, details);
      setStep('complete');
    } catch (error) {
      setStep('details');
      toast.error('Payment failed. Please try again.');
    }
  };

  // Reset state when method changes
  useEffect(() => {
    setErrors({});
    if (selectedMethod === 'LOYALTY_POINTS') {
      setLoyaltyPointsToUse(Math.min(maxLoyaltyPoints, Math.floor(total * 10)));
    }
  }, [selectedMethod, total, maxLoyaltyPoints]);

  // Render payment method selection
  const renderMethodSelection = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {availablePaymentMethods.filter(m => m.enabled).map((method) => {
          const isSelected = selectedMethod === method.id;
          return (
            <button
              key={method.id}
              onClick={() => {
                setSelectedMethod(method.id);
                setShowDetails(method.requiresDetails || false);
                setStep('select');
              }}
              className={`p-4 border-2 rounded-xl text-center transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                  : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
              }`}
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
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {method.description}
                </span>
                {isSelected && (
                  <CheckCircle className="w-4 h-4 text-blue-500 absolute top-2 right-2" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedPaymentMethod?.requiresDetails && (
        <button
          onClick={() => setStep('details')}
          className="w-full mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          Enter Payment Details
          <ArrowRight className="w-4 h-4" />
        </button>
      )}

      {!selectedPaymentMethod?.requiresDetails && (
        <button
          onClick={handleSubmit}
          disabled={isProcessing}
          className="w-full mt-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Zap className="w-5 h-5" />
          )}
          Pay {formatCurrency(finalTotal)}
        </button>
      )}
    </div>
  );

  // Render payment details form
  const renderDetailsForm = () => {
    const renderCardForm = () => (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } ${errors.cardNumber ? 'border-red-500' : ''}`}
            />
          </div>
          {errors.cardNumber && (
            <p className="mt-1 text-sm text-red-500">{errors.cardNumber}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } ${errors.cardExpiry ? 'border-red-500' : ''}`}
            />
            {errors.cardExpiry && (
              <p className="mt-1 text-sm text-red-500">{errors.cardExpiry}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Card Holder Name
          </label>
          <input
            type="text"
            value={cardHolder}
            onChange={(e) => setCardHolder(e.target.value)}
            placeholder="John Doe"
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            } ${errors.cardHolder ? 'border-red-500' : ''}`}
          />
          {errors.cardHolder && (
            <p className="mt-1 text-sm text-red-500">{errors.cardHolder}</p>
          )}
        </div>
      </div>
    );

    const renderMobileMoneyForm = () => (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Phone Number
          </label>
          <div className="relative">
            <Smartphone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
              placeholder="0712345678"
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } ${errors.mobileNumber ? 'border-red-500' : ''}`}
            />
          </div>
          {errors.mobileNumber && (
            <p className="mt-1 text-sm text-red-500">{errors.mobileNumber}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Provider
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="MTN">MTN</option>
            <option value="Tigo">Tigo</option>
            <option value="Airtel">Airtel</option>
            <option value="Vodafone">Vodafone</option>
          </select>
        </div>
      </div>
    );

    const renderGiftCardForm = () => (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } ${errors.giftCardCode ? 'border-red-500' : ''}`}
            />
          </div>
          {errors.giftCardCode && (
            <p className="mt-1 text-sm text-red-500">{errors.giftCardCode}</p>
          )}
        </div>
      </div>
    );

    const renderLoyaltyPointsForm = () => (
      <div className="space-y-4">
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-blue-50'}`}>
          <div className="flex items-center gap-3">
            <Star className="w-6 h-6 text-yellow-500 fill-current" />
            <div>
              <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Available Points: {customerLoyaltyPoints}
              </p>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {maxLoyaltyPoints} points can be used for this order
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Points to Use
          </label>
          <input
            type="number"
            value={loyaltyPointsToUse}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 0;
              setLoyaltyPointsToUse(Math.min(Math.max(val, 0), maxLoyaltyPoints));
            }}
            min={0}
            max={maxLoyaltyPoints}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
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
            checked={loyaltyPointsToUse === maxLoyaltyPoints}
            onChange={(e) => {
              setLoyaltyPointsToUse(e.target.checked ? maxLoyaltyPoints : 0);
            }}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <label htmlFor="useMaxPoints" className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Use maximum points for this order
          </label>
        </div>
      </div>
    );

    const renderBankTransferForm = () => (
      <div className="space-y-4">
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
              Reference: PAY-{Date.now().toString().slice(-6)}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Bank Reference Number
          </label>
          <input
            type="text"
            value={bankReference}
            onChange={(e) => setBankReference(e.target.value)}
            placeholder="Enter bank reference"
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          />
        </div>
      </div>
    );

    return (
      <div className="space-y-6">
        {selectedMethod === 'CREDIT_CARD' || selectedMethod === 'DEBIT_CARD' ? renderCardForm() :
         selectedMethod === 'MOBILE_MONEY' ? renderMobileMoneyForm() :
         selectedMethod === 'GIFT_CARD' ? renderGiftCardForm() :
         selectedMethod === 'LOYALTY_POINTS' ? renderLoyaltyPointsForm() :
         selectedMethod === 'BANK_TRANSFER' ? renderBankTransferForm() : null}

        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setStep('select')}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Pay {formatCurrency(finalTotal)}
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // Render processing state
  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative">
        <div className="w-20 h-20 border-4 border-gray-200 dark:border-gray-700 rounded-full"></div>
        <div className="absolute top-0 left-0 w-20 h-20 border-4 border-blue-600 rounded-full animate-spin border-t-transparent"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      </div>
      <h3 className={`mt-4 text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
        Processing Payment
      </h3>
      <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        Please wait while we process your payment...
      </p>
      <div className="mt-4 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
        <Shield className="w-4 h-4" />
        <span>Secure transaction</span>
      </div>
    </div>
  );

  // Render complete state
  const renderComplete = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
        <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
      </div>
      <h3 className={`mt-4 text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
        Payment Successful!
      </h3>
      <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        Your payment has been processed successfully.
      </p>
      <p className={`text-sm font-medium mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        Amount: {formatCurrency(finalTotal)}
      </p>
      <button
        onClick={() => onPaymentCancel?.()}
        className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
      >
        Continue
      </button>
    </div>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Payment Method
          </h3>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Select your preferred payment method
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <Shield className="w-4 h-4" />
          <span>Secure</span>
        </div>
      </div>

      {/* Payment Summary */}
      <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
        <div className="flex justify-between items-center">
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Total Amount
          </span>
          <span className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {formatCurrency(finalTotal)}
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
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {step === 'select' && renderMethodSelection()}
          {step === 'details' && renderDetailsForm()}
          {step === 'processing' && renderProcessing()}
          {step === 'complete' && renderComplete()}
        </motion.div>
      </AnimatePresence>

      {/* Trust Badges */}
      {step !== 'complete' && (
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Encrypted
          </span>
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Secure
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            24/7 Support
          </span>
        </div>
      )}
    </div>
  );
}
