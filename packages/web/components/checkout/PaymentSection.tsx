// D:\Projects\Kalwanga\packages\web\components\payment\PaymentSection.tsx

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Banknote,
  Wallet,
  Landmark,
  Gift,
  Star,
  CheckCircle,
  Loader2,
  Lock,
  Shield,
  Clock,
  Zap,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  Smartphone,
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { toast } from '../../utils/toast-manager';
import type { PaymentMethod } from '../../services/saleService';

// ============================================
// TYPES
// ============================================

interface PaymentMethodOption {
  id: string;
  name: string;
  code: PaymentMethod;
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
  onPaymentComplete: (
    paymentMethod: PaymentMethod,
    details: PaymentDetails,
  ) => void;
  onPaymentCancel?: () => void;
  isProcessing?: boolean;
  availablePaymentMethods?: PaymentMethodOption[];
  customerLoyaltyPoints?: number;
  className?: string;
}

type Step = 'select' | 'details' | 'processing' | 'complete';

// ============================================
// DEFAULT METHODS
// ============================================

const DEFAULT_PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: 'CASH',
    name: 'Cash',
    code: 'CASH',
    icon: <Banknote className="w-6 h-6" />,
    description: 'Pay at the counter',
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
    description: 'Visa, Mastercard debit',
    enabled: true,
    requiresDetails: true,
  },
  {
    id: 'MOBILE_MONEY',
    name: 'Mobile Money',
    code: 'MOBILE_MONEY',
    icon: <Smartphone className="w-6 h-6" />,
    description: 'MTN, Airtel, Tigo',
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
    description: 'Redeem a gift card',
    enabled: true,
    requiresDetails: true,
  },
  {
    id: 'LOYALTY_POINTS',
    name: 'Loyalty Points',
    code: 'LOYALTY_POINTS',
    icon: <Star className="w-6 h-6" />,
    description: 'Pay with your points',
    enabled: true,
    requiresDetails: true,
  },
];

// ============================================
// INPUT HELPERS
// ============================================

function formatCardNumber(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 16);
  const groups = cleaned.match(/.{1,4}/g);
  return groups ? groups.join(' ') : cleaned;
}

function formatExpiry(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 4);
  if (cleaned.length >= 3) {
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  }
  if (cleaned.length === 2) {
    return `${cleaned}/`;
  }
  return cleaned;
}

// ============================================
// COMPONENT
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
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('CASH');
  const [step, setStep] = useState<Step>('select');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Card fields
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [showCvv, setShowCvv] = useState(false);

  // Mobile money
  const [mobileNumber, setMobileNumber] = useState('');
  const [provider, setProvider] = useState('MTN');

  // Gift card
  const [giftCardCode, setGiftCardCode] = useState('');

  // Loyalty points
  const [loyaltyPointsToUse, setLoyaltyPointsToUse] = useState(0);

  // Bank transfer
  const [bankReference, setBankReference] = useState('');

  const selectedPaymentMethod = useMemo(
    () => availablePaymentMethods.find((m) => m.id === selectedMethod),
    [availablePaymentMethods, selectedMethod],
  );

  const maxLoyaltyPoints = useMemo(
    () =>
      Math.min(
        customerLoyaltyPoints,
        Math.floor(total * 10),
      ),
    [customerLoyaltyPoints, total],
  );

  const loyaltyDiscount = useMemo(
    () => (loyaltyPointsToUse || 0) * 0.1,
    [loyaltyPointsToUse],
  );

  const finalTotal = useMemo(
    () => Math.max(0, total - loyaltyDiscount),
    [total, loyaltyDiscount],
  );

  const bankReferenceDisplay = useMemo(
    () => `PAY-${Date.now().toString().slice(-6)}`,
    [],
  );

  // Reset transient state when the user picks a different method
  useEffect(() => {
    setErrors({});
    if (selectedMethod === 'LOYALTY_POINTS') {
      setLoyaltyPointsToUse(
        Math.min(maxLoyaltyPoints, Math.floor(total * 10)),
      );
    } else {
      setLoyaltyPointsToUse(0);
    }
  }, [selectedMethod, total, maxLoyaltyPoints]);

  // ============================================
  // VALIDATION
  // ============================================

  const validateDetails = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (
      selectedMethod === 'CREDIT_CARD' ||
      selectedMethod === 'DEBIT_CARD'
    ) {
      if (!/^\d{16}$/.test(cardNumber.replace(/\s/g, ''))) {
        newErrors.cardNumber = 'Enter a valid 16-digit card number';
      }
      if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
        newErrors.cardExpiry = 'Enter expiry as MM/YY';
      } else {
        const [mm, yy] = cardExpiry.split('/').map(Number);
        if (mm < 1 || mm > 12) {
          newErrors.cardExpiry = 'Month must be 01–12';
        } else {
          const now = new Date();
          const expiry = new Date(2000 + yy, mm);
          if (expiry <= now) {
            newErrors.cardExpiry = 'Card has expired';
          }
        }
      }
      if (!/^\d{3,4}$/.test(cardCvv)) {
        newErrors.cardCvv = 'Enter a valid CVV';
      }
      if (!cardHolder.trim()) {
        newErrors.cardHolder = 'Cardholder name is required';
      }
    }

    if (selectedMethod === 'MOBILE_MONEY') {
      const digits = mobileNumber.replace(/\D/g, '');
      if (digits.length < 9 || digits.length > 15) {
        newErrors.mobileNumber = 'Enter a valid phone number';
      }
    }

    if (selectedMethod === 'GIFT_CARD') {
      if (!giftCardCode.trim()) {
        newErrors.giftCardCode = 'Gift card code is required';
      }
    }

    if (selectedMethod === 'LOYALTY_POINTS') {
      if (loyaltyPointsToUse <= 0) {
        newErrors.loyaltyPoints = 'Enter the number of points to use';
      }
      if (loyaltyPointsToUse > maxLoyaltyPoints) {
        newErrors.loyaltyPoints = `You have only ${maxLoyaltyPoints} points available`;
      }
    }

    if (selectedMethod === 'BANK_TRANSFER') {
      if (!bankReference.trim()) {
        newErrors.bankReference = 'Bank reference is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [
    selectedMethod,
    cardNumber,
    cardExpiry,
    cardCvv,
    cardHolder,
    mobileNumber,
    giftCardCode,
    loyaltyPointsToUse,
    maxLoyaltyPoints,
    bankReference,
  ]);

  // ============================================
  // SUBMIT
  // ============================================

  const handleSubmit = useCallback(async () => {
    if (!validateDetails()) return;

    setSubmitting(true);
    setStep('processing');

    const isCard =
      selectedMethod === 'CREDIT_CARD' || selectedMethod === 'DEBIT_CARD';

    const details: PaymentDetails = {
      cardNumber: isCard ? cardNumber : undefined,
      cardExpiry: isCard ? cardExpiry : undefined,
      cardCvv: isCard ? cardCvv : undefined,
      cardHolder: isCard ? cardHolder : undefined,
      mobileNumber:
        selectedMethod === 'MOBILE_MONEY' ? mobileNumber : undefined,
      provider: selectedMethod === 'MOBILE_MONEY' ? provider : undefined,
      giftCardCode:
        selectedMethod === 'GIFT_CARD' ? giftCardCode : undefined,
      loyaltyPoints:
        selectedMethod === 'LOYALTY_POINTS' ? loyaltyPointsToUse : undefined,
      bankReference:
        selectedMethod === 'BANK_TRANSFER' ? bankReference : undefined,
    };

    try {
      await onPaymentComplete(selectedMethod, details);
      setStep('complete');
    } catch (error) {
      console.error('Payment submission failed:', error);
      setStep('details');
      toast.error('Payment failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [
    validateDetails,
    selectedMethod,
    cardNumber,
    cardExpiry,
    cardCvv,
    cardHolder,
    mobileNumber,
    provider,
    giftCardCode,
    loyaltyPointsToUse,
    bankReference,
    onPaymentComplete,
  ]);

  // ============================================
  // SUB-VIEWS
  // ============================================

  const inputClass = (hasError: boolean) =>
    `w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ${
      hasError
        ? 'border-danger-500 dark:border-danger-500'
        : 'border-gray-300 dark:border-gray-600'
    }`;

  const renderMethodSelection = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {availablePaymentMethods
          .filter((m) => m.enabled)
          .map((method) => {
            const isSelected = selectedMethod === method.code;
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => setSelectedMethod(method.code)}
                className={`relative p-4 border-2 rounded-xl text-center transition-all focus-ring ${
                  isSelected
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-soft'
                    : 'border-gray-200 dark:border-gray-600 hover:border-brand-300 dark:hover:border-brand-500'
                }`}
                aria-pressed={isSelected}
              >
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`p-2 rounded-lg ${
                      isSelected
                        ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {method.icon}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      isSelected
                        ? 'text-brand-600 dark:text-brand-400'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {method.name}
                  </span>
                  <span className="text-2xs text-gray-400 dark:text-gray-500">
                    {method.description}
                  </span>
                  {isSelected && (
                    <CheckCircle className="w-4 h-4 text-brand-500 absolute top-2 right-2" />
                  )}
                </div>
              </button>
            );
          })}
      </div>

      {selectedPaymentMethod?.requiresDetails ? (
        <button
          type="button"
          onClick={() => setStep('details')}
          className="w-full mt-2 px-6 py-3 bg-brand-gradient hover:shadow-brand-lg text-white rounded-lg shadow-brand transition-all flex items-center justify-center gap-2 focus-ring"
        >
          Enter Payment Details
          <ArrowRight className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isProcessing || submitting}
          className="w-full mt-2 px-6 py-3 bg-success-600 hover:bg-success-700 text-white rounded-xl font-semibold shadow-soft transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
        >
          {isProcessing || submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Zap className="w-5 h-5" />
          )}
          Pay {formatCurrency(finalTotal)}
        </button>
      )}
    </div>
  );

  const renderCardForm = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Card Number
        </label>
        <div className="relative">
          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            placeholder="1234 5678 9012 3456"
            maxLength={19}
            className={`${inputClass(!!errors.cardNumber)} pl-10 font-mono tabular-nums`}
          />
        </div>
        {errors.cardNumber && (
          <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {errors.cardNumber}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Expiry
          </label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-exp"
            value={cardExpiry}
            onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
            placeholder="MM/YY"
            maxLength={5}
            className={`${inputClass(!!errors.cardExpiry)} font-mono tabular-nums`}
          />
          {errors.cardExpiry && (
            <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.cardExpiry}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            CVV
          </label>
          <div className="relative">
            <input
              type={showCvv ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="cc-csc"
              value={cardCvv}
              onChange={(e) =>
                setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))
              }
              placeholder="123"
              maxLength={4}
              className={`${inputClass(!!errors.cardCvv)} pr-10 font-mono tabular-nums`}
            />
            <button
              type="button"
              onClick={() => setShowCvv((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus-ring rounded"
              aria-label={showCvv ? 'Hide CVV' : 'Show CVV'}
            >
              {showCvv ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.cardCvv && (
            <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.cardCvv}
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Cardholder Name
        </label>
        <input
          type="text"
          autoComplete="cc-name"
          value={cardHolder}
          onChange={(e) => setCardHolder(e.target.value)}
          placeholder="John Doe"
          className={inputClass(!!errors.cardHolder)}
        />
        {errors.cardHolder && (
          <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {errors.cardHolder}
          </p>
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
          <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={mobileNumber}
            onChange={(e) =>
              setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 15))
            }
            placeholder="256700000000"
            className={`${inputClass(!!errors.mobileNumber)} pl-10 font-mono tabular-nums`}
          />
        </div>
        {errors.mobileNumber && (
          <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {errors.mobileNumber}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Provider
        </label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className={inputClass(false)}
        >
          <option value="MTN">MTN Mobile Money</option>
          <option value="AIRTEL">Airtel Money</option>
          <option value="TIGO">Tigo Pesa</option>
          <option value="VODAFONE">Vodafone Cash</option>
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
          <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={giftCardCode}
            onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
            placeholder="GIFT-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
            className={`${inputClass(!!errors.giftCardCode)} pl-10 font-mono uppercase tracking-wider`}
          />
        </div>
        {errors.giftCardCode && (
          <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {errors.giftCardCode}
          </p>
        )}
      </div>
    </div>
  );

  const renderLoyaltyPointsForm = () => (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-brand-50 dark:bg-gray-700">
        <div className="flex items-center gap-3">
          <Star className="w-6 h-6 text-warning-500 fill-current flex-shrink-0" />
          <div>
            <p className="font-medium text-gray-900 dark:text-white tabular-nums">
              {customerLoyaltyPoints} points available
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
              Up to {maxLoyaltyPoints} can be used for this order
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
          inputMode="numeric"
          value={loyaltyPointsToUse}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10) || 0;
            setLoyaltyPointsToUse(
              Math.min(Math.max(val, 0), maxLoyaltyPoints),
            );
          }}
          min={0}
          max={maxLoyaltyPoints}
          className={`${inputClass(!!errors.loyaltyPoints)} tabular-nums`}
        />
        {errors.loyaltyPoints && (
          <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {errors.loyaltyPoints}
          </p>
        )}
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
          Discount: {formatCurrency(loyaltyDiscount)}
        </p>
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={loyaltyPointsToUse === maxLoyaltyPoints && maxLoyaltyPoints > 0}
          onChange={(e) =>
            setLoyaltyPointsToUse(e.target.checked ? maxLoyaltyPoints : 0)
          }
          className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 focus:outline-none"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Use maximum points for this order
        </span>
      </label>
    </div>
  );

  const renderBankTransferForm = () => (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Please transfer to the account below, then paste the bank
          reference.
        </p>
        <div className="mt-3 p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg space-y-1">
          <p className="font-mono text-sm text-gray-900 dark:text-white">
            Bank: Kalwanga Bank
          </p>
          <p className="font-mono text-sm text-gray-900 dark:text-white tabular-nums">
            Account: 1234567890
          </p>
          <p className="font-mono text-sm text-gray-900 dark:text-white tabular-nums">
            Reference: {bankReferenceDisplay}
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
          className={`${inputClass(!!errors.bankReference)} font-mono`}
        />
        {errors.bankReference && (
          <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {errors.bankReference}
          </p>
        )}
      </div>
    </div>
  );

  const renderDetailsForm = () => (
    <div className="space-y-6">
      {selectedMethod === 'CREDIT_CARD' || selectedMethod === 'DEBIT_CARD'
        ? renderCardForm()
        : selectedMethod === 'MOBILE_MONEY'
          ? renderMobileMoneyForm()
          : selectedMethod === 'GIFT_CARD'
            ? renderGiftCardForm()
            : selectedMethod === 'LOYALTY_POINTS'
              ? renderLoyaltyPointsForm()
              : selectedMethod === 'BANK_TRANSFER'
                ? renderBankTransferForm()
                : null}

      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setStep('select')}
          disabled={submitting}
          className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isProcessing || submitting}
          className="flex-1 px-4 py-3 bg-brand-gradient hover:shadow-brand-lg text-white rounded-lg shadow-brand transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
        >
          {isProcessing || submitting ? (
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

  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-700 rounded-full" />
        <div className="absolute inset-0 border-4 border-brand-500 rounded-full animate-spin border-t-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
        Processing Payment
      </h3>
      <p className="text-sm mt-2 text-gray-500 dark:text-gray-400">
        Please wait while we process your payment…
      </p>
      <div className="mt-4 flex items-center gap-2 text-sm text-brand-600 dark:text-brand-400">
        <Shield className="w-4 h-4" />
        <span>Secure transaction</span>
      </div>
    </div>
  );

  const renderComplete = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-20 h-20 bg-success-100 dark:bg-success-900/30 rounded-full flex items-center justify-center">
        <CheckCircle className="w-12 h-12 text-success-600 dark:text-success-400" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
        Payment Successful
      </h3>
      <p className="text-sm mt-2 text-gray-500 dark:text-gray-400">
        Your payment has been processed successfully.
      </p>
      <p className="text-sm font-medium mt-1 text-gray-900 dark:text-white tabular-nums">
        Amount: {formatCurrency(finalTotal)}
      </p>
      <button
        type="button"
        onClick={() => onPaymentCancel?.()}
        className="mt-6 px-6 py-2 bg-brand-gradient hover:shadow-brand-lg text-white rounded-lg shadow-brand transition-all focus-ring"
      >
        Continue
      </button>
    </div>
  );

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Payment Method
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select your preferred payment method
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-success-600 dark:text-success-400">
          <Shield className="w-4 h-4" />
          <span>Secure</span>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/30">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Total Amount
          </span>
          <span className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
            {formatCurrency(finalTotal)}
          </span>
        </div>
        {loyaltyDiscount > 0 && (
          <div className="flex justify-between items-center mt-1">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Loyalty Discount
            </span>
            <span className="text-sm text-success-600 dark:text-success-400 tabular-nums">
              -{formatCurrency(loyaltyDiscount)}
            </span>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {step === 'select' && renderMethodSelection()}
          {step === 'details' && renderDetailsForm()}
          {step === 'processing' && renderProcessing()}
          {step === 'complete' && renderComplete()}
        </motion.div>
      </AnimatePresence>

      {step !== 'complete' && (
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4 text-2xs text-gray-500 dark:text-gray-400">
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

export default PaymentSection;
