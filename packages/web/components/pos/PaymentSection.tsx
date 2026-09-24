'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Banknote,
  Wallet,
  Building,
  QrCode,
  Gift,
  Star,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Loader2,
  Lock,
  Shield,
  Clock,
  Zap,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Landmark,
  Receipt,
  Printer,
  Download,
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { toast } from '../../utils/toast-manager';
import type { PaymentMethod } from '../../services/saleService';

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
  /**
   * When provided, the component also offers "apply loyalty points as
   * a discount" alongside the payment method. The parent receives the
   * points to apply via `onPaymentComplete`'s `details.loyaltyPoints`,
   * and is expected to forward them to the checkout payload as
   * `applyLoyaltyPoints: true` + `loyaltyPointsUsed`.
   *
   * When `undefined` (default), the behavior is exactly what it was
   * before: loyalty points can only be used as a *payment method*
   * (via the `LOYALTY_POINTS` option). This preserves backward
   * compatibility for existing callers.
   */
  allowLoyaltyAsDiscount?: boolean;
  /**
   * How much of the total each loyalty point is worth in currency.
   * Defaults to `0.1` (i.e. 10 points = $1), matching the backend's
   * `LOYALTY_POINT_VALUE` constant in `saleService.ts` and
   * `checkoutService.ts`.
   */
  loyaltyPointValue?: number;
}

const DEFAULT_PAYMENT_METHODS: PaymentMethodOption[] = [
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

export function PaymentSection({
  total,
  currency = 'USD',
  onPaymentComplete,
  onPaymentCancel,
  isProcessing = false,
  availablePaymentMethods = DEFAULT_PAYMENT_METHODS,
  customerLoyaltyPoints = 0,
  className = '',
  allowLoyaltyAsDiscount = false,
  loyaltyPointValue = 0.1,
}: PaymentSectionProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('CASH');
  const [showDetails, setShowDetails] = useState(false);
  const [step, setStep] = useState<
    'select' | 'details' | 'processing' | 'complete'
  >('select');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Method-specific form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [provider, setProvider] = useState('MTN');
  const [giftCardCode, setGiftCardCode] = useState('');
  const [bankReference, setBankReference] = useState('');
  const [showCvv, setShowCvv] = useState(false);

  // Loyalty-as-payment-method state
  const [loyaltyPointsToUse, setLoyaltyPointsToUse] = useState(0);

  // Loyalty-as-discount state (only surfaced when allowLoyaltyAsDiscount)
  const [applyLoyaltyDiscount, setApplyLoyaltyDiscount] = useState(false);
  const [loyaltyDiscountPoints, setLoyaltyDiscountPoints] = useState(0);

  const selectedPaymentMethod = availablePaymentMethods.find(
    (m) => m.id === selectedMethod,
  );

  // ── Loyalty math ────────────────────────────────────────────────
  //
  // The loyalty program has two distinct uses:
  //
  //   1. LOYALTY_POINTS as a payment method — the whole total is
  //      covered by points. `maxLoyaltyPointsAsPayment` is the cap.
  //
  //   2. Loyalty as a *discount* on top of another method — the
  //      discount is capped at 50% of the total (matching the
  //      backend's `maxDiscount = round2(totals.total * 0.5)` in
  //      `checkoutService.processCheckout`). `maxLoyaltyPointsAsDiscount`
  //      is the cap for that path.
  //
  // Both are expressed in points, not currency.

  const maxLoyaltyPointsAsPayment = Math.min(
    customerLoyaltyPoints,
    Math.floor(total / loyaltyPointValue),
  );

  const maxLoyaltyDiscountValue = Math.round(total * 0.5 * 100) / 100;
  const maxLoyaltyPointsAsDiscount = Math.min(
    customerLoyaltyPoints,
    Math.floor(maxLoyaltyDiscountValue / loyaltyPointValue),
  );

  // Loyalty discount that would apply to the *currently selected*
  // flow. Zero when neither flow is active.
  const activeLoyaltyDiscount = useMemo(() => {
    if (selectedMethod === 'LOYALTY_POINTS') {
      const points =
        loyaltyPointsToUse > 0 ? loyaltyPointsToUse : maxLoyaltyPointsAsPayment;
      return Math.round(points * loyaltyPointValue * 100) / 100;
    }
    if (allowLoyaltyAsDiscount && applyLoyaltyDiscount && loyaltyDiscountPoints > 0) {
      return Math.round(loyaltyDiscountPoints * loyaltyPointValue * 100) / 100;
    }
    return 0;
  }, [
    selectedMethod,
    loyaltyPointsToUse,
    maxLoyaltyPointsAsPayment,
    allowLoyaltyAsDiscount,
    applyLoyaltyDiscount,
    loyaltyDiscountPoints,
    loyaltyPointValue,
  ]);

  const finalTotal = Math.max(0, total - activeLoyaltyDiscount);

  // Stable reference number: computed once per mount, not on every
  // render. The old inline `Date.now()` recalculation could change the
  // number the user sees mid-flow.
  const bankReferenceDisplay = useMemo(
    () => `PAY-${Date.now().toString().slice(-6)}`,
    [],
  );

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(' ') : cleaned;
  };

  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    return cleaned;
  };

  const validateDetails = () => {
    const newErrors: Record<string, string> = {};

    if (
      selectedMethod === 'CREDIT_CARD' ||
      selectedMethod === 'DEBIT_CARD'
    ) {
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
      const points =
        loyaltyPointsToUse > 0 ? loyaltyPointsToUse : maxLoyaltyPointsAsPayment;
      if (points <= 0) {
        newErrors.loyaltyPoints = 'Please enter the number of points to use';
      }
      if (points > maxLoyaltyPointsAsPayment) {
        newErrors.loyaltyPoints = `You have only ${maxLoyaltyPointsAsPayment} points available`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateDetails()) return;

    setStep('processing');

    // Loyalty points that are *spent* on this transaction. When
    // LOYALTY_POINTS is the payment method, the whole charge is paid
    // in points. When loyalty is a discount on another method, only
    // `loyaltyDiscountPoints` are spent and the rest is charged to the
    // selected method.
    const loyaltyPointsSpent =
      selectedMethod === 'LOYALTY_POINTS'
        ? loyaltyPointsToUse > 0
          ? loyaltyPointsToUse
          : maxLoyaltyPointsAsPayment
        : allowLoyaltyAsDiscount && applyLoyaltyDiscount
        ? loyaltyDiscountPoints
        : 0;

    const details: PaymentDetails = {
      cardNumber:
        selectedMethod === 'CREDIT_CARD' || selectedMethod === 'DEBIT_CARD'
          ? cardNumber
          : undefined,
      cardExpiry:
        selectedMethod === 'CREDIT_CARD' || selectedMethod === 'DEBIT_CARD'
          ? cardExpiry
          : undefined,
      cardCvv:
        selectedMethod === 'CREDIT_CARD' || selectedMethod === 'DEBIT_CARD'
          ? cardCvv
          : undefined,
      cardHolder:
        selectedMethod === 'CREDIT_CARD' || selectedMethod === 'DEBIT_CARD'
          ? cardHolder
          : undefined,
      mobileNumber:
        selectedMethod === 'MOBILE_MONEY' ? mobileNumber : undefined,
      provider: selectedMethod === 'MOBILE_MONEY' ? provider : undefined,
      giftCardCode:
        selectedMethod === 'GIFT_CARD' ? giftCardCode : undefined,
      loyaltyPoints:
        loyaltyPointsSpent > 0 ? loyaltyPointsSpent : undefined,
      bankReference:
        selectedMethod === 'BANK_TRANSFER' ? bankReference : undefined,
    };

    try {
      await onPaymentComplete(selectedMethod, details);
      setStep('complete');
    } catch (error) {
      setStep('details');
      toast.error('Payment failed. Please try again.');
    }
  };

  useEffect(() => {
    setErrors({});
    if (selectedMethod === 'LOYALTY_POINTS') {
      setLoyaltyPointsToUse(
        Math.min(maxLoyaltyPointsAsPayment, Math.floor(total / loyaltyPointValue)),
      );
    }
    // Don't clear the loyalty-discount choice when switching payment
    // methods — the user's intent to burn points on this order doesn't
    // depend on which method pays the remainder.
  }, [selectedMethod, total, maxLoyaltyPointsAsPayment, loyaltyPointValue]);

  const renderLoyaltyDiscountToggle = () => {
    if (!allowLoyaltyAsDiscount) return null;
    if (selectedMethod === 'LOYALTY_POINTS') return null;
    if (customerLoyaltyPoints <= 0) return null;
    if (maxLoyaltyPointsAsDiscount <= 0) return null;

    return (
      <div className="p-4 rounded-lg border border-warning-200 dark:border-warning-800 bg-warning-50 dark:bg-warning-900/20">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={applyLoyaltyDiscount}
            onChange={(e) => {
              setApplyLoyaltyDiscount(e.target.checked);
              if (e.target.checked && loyaltyDiscountPoints === 0) {
                setLoyaltyDiscountPoints(maxLoyaltyPointsAsDiscount);
              }
            }}
            className="mt-0.5 w-4 h-4 rounded text-warning-600 focus:ring-warning-500 bg-white dark:bg-gray-700"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-warning-500 fill-current" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Apply loyalty points as a discount
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
              You have {customerLoyaltyPoints} points · up to{' '}
              {maxLoyaltyPointsAsDiscount} usable (max 50% of total)
            </p>

            {applyLoyaltyDiscount && (
              <div className="mt-3 space-y-2">
                <input
                  type="number"
                  value={loyaltyDiscountPoints}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 0;
                    setLoyaltyDiscountPoints(
                      Math.min(
                        Math.max(val, 0),
                        maxLoyaltyPointsAsDiscount,
                      ),
                    );
                  }}
                  min={0}
                  max={maxLoyaltyPointsAsDiscount}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums focus:ring-2 focus:ring-warning-500 focus:border-transparent text-sm"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    Discount applied
                  </span>
                  <span className="font-medium text-success-600 dark:text-success-400 tabular-nums">
                    -{formatCurrency(activeLoyaltyDiscount)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </label>
      </div>
    );
  };

  const renderMethodSelection = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {availablePaymentMethods
          .filter((m) => m.enabled)
          .map((method) => {
            const isSelected = selectedMethod === method.id;
            return (
              <button
                key={method.id}
                onClick={() => {
                  setSelectedMethod(method.code);
                  setShowDetails(method.requiresDetails || false);
                  setStep('select');
                }}
                className={`relative p-4 border-2 rounded-xl text-center transition-all focus-ring ${
                  isSelected
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-soft'
                    : 'border-gray-200 dark:border-gray-600 hover:border-brand-300 dark:hover:border-brand-500'
                }`}
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

      {renderLoyaltyDiscountToggle()}

      {selectedPaymentMethod?.requiresDetails && (
        <button
          onClick={() => setStep('details')}
          className="w-full mt-2 px-4 py-2 bg-brand-gradient hover:shadow-brand-lg text-white rounded-lg shadow-brand transition-all flex items-center justify-center gap-2 focus-ring"
        >
          Enter Payment Details
          <ArrowRight className="w-4 h-4" />
        </button>
      )}

      {!selectedPaymentMethod?.requiresDetails && (
        <button
          onClick={handleSubmit}
          disabled={isProcessing}
          className="w-full mt-2 px-6 py-3 bg-success-600 hover:bg-success-700 text-white rounded-xl font-semibold shadow-soft transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
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

  const renderDetailsForm = () => {
    const inputBase = (hasError: boolean) =>
      `w-full border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
        hasError ? 'border-danger-500' : 'border-gray-300 dark:border-gray-600'
      }`;

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
              className={`${inputBase(!!errors.cardNumber)} pl-10 pr-4 py-3 font-mono tabular-nums`}
            />
          </div>
          {errors.cardNumber && (
            <p className="mt-1 text-sm text-danger-500">
              {errors.cardNumber}
            </p>
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
              className={`${inputBase(!!errors.cardExpiry)} px-4 py-3 font-mono tabular-nums`}
            />
            {errors.cardExpiry && (
              <p className="mt-1 text-sm text-danger-500">
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
                value={cardCvv}
                onChange={(e) =>
                  setCardCvv(e.target.value.replace(/\D/g, ''))
                }
                placeholder="123"
                maxLength={4}
                className={`${inputBase(!!errors.cardCvv)} px-4 py-3 pr-10 font-mono tabular-nums`}
              />
              <button
                type="button"
                onClick={() => setShowCvv(!showCvv)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus-ring rounded"
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
              <p className="mt-1 text-sm text-danger-500">
                {errors.cardCvv}
              </p>
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
            className={`${inputBase(!!errors.cardHolder)} px-4 py-3`}
          />
          {errors.cardHolder && (
            <p className="mt-1 text-sm text-danger-500">
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
            <Smartphone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) =>
                setMobileNumber(e.target.value.replace(/\D/g, ''))
              }
              placeholder="0712345678"
              className={`${inputBase(!!errors.mobileNumber)} pl-10 pr-4 py-3 font-mono tabular-nums`}
            />
          </div>
          {errors.mobileNumber && (
            <p className="mt-1 text-sm text-danger-500">
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
            className={`${inputBase(false)} px-4 py-3`}
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
              className={`${inputBase(!!errors.giftCardCode)} pl-10 pr-4 py-3 font-mono uppercase`}
            />
          </div>
          {errors.giftCardCode && (
            <p className="mt-1 text-sm text-danger-500">
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
            <Star className="w-6 h-6 text-warning-500 fill-current" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                Available Points: {customerLoyaltyPoints}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                {maxLoyaltyPointsAsPayment} points can be used for this order
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
              const val = parseInt(e.target.value, 10) || 0;
              setLoyaltyPointsToUse(
                Math.min(Math.max(val, 0), maxLoyaltyPointsAsPayment),
              );
            }}
            min={0}
            max={maxLoyaltyPointsAsPayment}
            className={`${inputBase(!!errors.loyaltyPoints)} px-4 py-3 tabular-nums`}
          />
          {errors.loyaltyPoints && (
            <p className="mt-1 text-sm text-danger-500">
              {errors.loyaltyPoints}
            </p>
          )}
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            Discount: {formatCurrency(activeLoyaltyDiscount)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="useMaxPoints"
            checked={loyaltyPointsToUse === maxLoyaltyPointsAsPayment}
            onChange={(e) => {
              setLoyaltyPointsToUse(
                e.target.checked ? maxLoyaltyPointsAsPayment : 0,
              );
            }}
            className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 focus:outline-none"
          />
          <label
            htmlFor="useMaxPoints"
            className="text-sm text-gray-700 dark:text-gray-300"
          >
            Use maximum points for this order
          </label>
        </div>
      </div>
    );

    const renderBankTransferForm = () => (
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Please make a bank transfer to the following account:
          </p>
          <div className="mt-2 p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
            <p className="font-mono text-sm text-gray-900 dark:text-white tabular-nums">
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
            className={`${inputBase(false)} px-4 py-3 font-mono`}
          />
        </div>
      </div>
    );

    return (
      <div className="space-y-6">
        {selectedMethod === 'CREDIT_CARD' ||
        selectedMethod === 'DEBIT_CARD'
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

        {renderLoyaltyDiscountToggle()}

        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setStep('select')}
            className="flex-1 btn-secondary focus-ring"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 bg-brand-gradient hover:shadow-brand-lg text-white rounded-lg shadow-brand transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
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

  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative">
        <div className="w-20 h-20 border-4 border-gray-200 dark:border-gray-700 rounded-full" />
        <div className="absolute top-0 left-0 w-20 h-20 border-4 border-brand-500 rounded-full animate-spin border-t-transparent" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
        Processing Payment
      </h3>
      <p className="text-sm mt-2 text-gray-500 dark:text-gray-400">
        Please wait while we process your payment...
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
        Payment Successful!
      </h3>
      <p className="text-sm mt-2 text-gray-500 dark:text-gray-400">
        Your payment has been processed successfully.
      </p>
      <p className="text-sm font-medium mt-1 text-gray-900 dark:text-white tabular-nums">
        Amount: {formatCurrency(finalTotal)}
      </p>
      {activeLoyaltyDiscount > 0 && (
        <p className="text-xs text-success-600 dark:text-success-400 tabular-nums mt-0.5">
          Paid with{' '}
          {selectedMethod === 'LOYALTY_POINTS'
            ? loyaltyPointsToUse || maxLoyaltyPointsAsPayment
            : loyaltyDiscountPoints}{' '}
          loyalty points
        </p>
      )}
      <button
        onClick={() => onPaymentCancel?.()}
        className="mt-6 px-6 py-2 bg-brand-gradient hover:shadow-brand-lg text-white rounded-lg shadow-brand transition-all focus-ring"
      >
        Continue
      </button>
    </div>
  );

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
        {activeLoyaltyDiscount > 0 && (
          <div className="flex justify-between items-center mt-1">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Loyalty Discount
            </span>
            <span className="text-sm text-success-600 dark:text-success-400 tabular-nums">
              -{formatCurrency(activeLoyaltyDiscount)}
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
          transition={{ duration: 0.3 }}
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
