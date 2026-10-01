// packages/web/components/payments/PaymentForm.tsx

'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Gift,
  Star,
  Eye,
  EyeOff,
  Smartphone,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Shield,
  Lock,
  Zap,
  Globe,
  ChevronDown,
  ExternalLink,
  Phone,
} from 'lucide-react';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';

import { useThemeStore } from '../../app/stores/themeStore';
import { formatCurrency } from '../../utils/formatters';
import { toast } from '../../utils/toast-manager';
import { paymentService } from '../../services/paymentService';
import { checkoutService } from '../../services/checkoutService';
import type {
  NextAction,
  OnlineCheckoutResponse,
} from '../../services/checkoutService';
import {
  MobileMoneyProviderPicker,
  validatePhoneForProvider,
  MOBILE_PROVIDERS,
  type MobileProvider,
} from './MobileMoneyProviderPicker';
import { getProviderLogo } from './ProviderLogos';

// ============================================
// STRIPE BOOTSTRAP
// ============================================

const stripePublishableKey =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

let stripePromise: Promise<Stripe | null> | null = null;

function getStripePromise(): Promise<Stripe | null> {
  if (!stripePromise) {
    if (!stripePublishableKey) {
      console.warn(
        '⚠️ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. ' +
          'Card payments will not work.',
      );
    }
    stripePromise = loadStripe(stripePublishableKey);
  }
  return stripePromise;
}

// ============================================
// MOBILE-MONEY ROUTING
// ============================================

type MobileRouting = 'mpesa' | 'generic';

function getMobileRouting(provider: MobileProvider): MobileRouting {
  return provider === 'MPESA' ? 'mpesa' : 'generic';
}

// ============================================
// PROPS
// ============================================

export interface PaymentFormProps {
  amount: number;
  currency?: string;
  paymentMethod: string;
  provider?: string;
  customerId?: string;
  customerLoyaltyPoints?: number;
  saleId?: string;
  cartId?: string;
  businessUnitId?: string;
  cashRegisterId?: string;
  cashRegisterSessionId?: string;
  defaultMobileProvider?: MobileProvider;
  defaultPhoneNumber?: string;
  returnUrl?: string;
  cancelUrl?: string;
  stripeClientSecret?: string | null;
  onSuccess?: (payment: any) => void;
  onError?: (error: any) => void;
  onCancel?: () => void;
  onAwaitingConfirmation?: (saleId: string) => void;
  className?: string;
}

// ============================================
// PROVIDER METADATA
// ============================================
//
// Text metadata only — artwork is now served by
// `ProviderLogos.tsx` as inline React SVGs. There is no image
// URL map anymore, and no runtime fetch to `/icons/payments/`.

const PROVIDER_CONFIGS: Record<
  string,
  { icon: string; name: string; color: string; description: string }
> = {
  STRIPE: {
    icon: '💳',
    name: 'Stripe',
    color: 'blue',
    description: 'Credit and debit card payments',
  },
  PAYPAL: {
    icon: '💸',
    name: 'PayPal',
    color: 'blue',
    description: 'PayPal wallet payments',
  },
  FLUTTERWAVE: {
    icon: '🌊',
    name: 'Flutterwave',
    color: 'cyan',
    description: 'Cards, Mobile Money, Bank Transfer',
  },
  SQUARE: {
    icon: '⬜',
    name: 'Square',
    color: 'gray',
    description: 'Cards, Digital Wallet',
  },
  MPESA: {
    icon: '📱',
    name: 'M-Pesa',
    color: 'green',
    description: 'Safaricom STK push',
  },
  MTN: {
    icon: '📱',
    name: 'MTN Mobile Money',
    color: 'yellow',
    description: 'MTN MoMo prompt',
  },
  AIRTEL: {
    icon: '📱',
    name: 'Airtel Money',
    color: 'red',
    description: 'Airtel Money prompt',
  },
  CASH: {
    icon: '💰',
    name: 'Cash',
    color: 'green',
    description: 'Cash payment at the counter',
  },
  MOBILE_MONEY: {
    icon: '📱',
    name: 'Mobile Money',
    color: 'purple',
    description: 'Mobile money payment',
  },
  BANK_TRANSFER: {
    icon: '🏦',
    name: 'Bank Transfer',
    color: 'indigo',
    description: 'Direct bank transfer',
  },
  GIFT_CARD: {
    icon: '🎁',
    name: 'Gift Card',
    color: 'pink',
    description: 'Gift card redemption',
  },
  LOYALTY_POINTS: {
    icon: '⭐',
    name: 'Loyalty Points',
    color: 'yellow',
    description: 'Loyalty points redemption',
  },
};

// ============================================
// STRIPE CARD SUB-FORM
// ============================================

interface StripeCardSubFormProps {
  clientSecret: string;
  isDark: boolean;
  onSuccess: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

function StripeCardSubForm({
  clientSecret,
  isDark,
  onSuccess,
  onError,
  onCancel,
}: StripeCardSubFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (!stripe || !elements) return;

    const card = elements.getElement(CardElement);
    if (!card) {
      onError('Card element is not mounted');
      return;
    }

    setSubmitting(true);
    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        { payment_method: { card } },
      );

      if (error) {
        onError(error.message || 'Card was declined');
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        onSuccess();
        return;
      }

      if (paymentIntent?.status === 'processing') {
        onError(
          'Your bank is still processing this payment. You will receive a confirmation shortly.',
        );
        return;
      }

      onError(`Unexpected payment status: ${paymentIntent?.status}`);
    } catch (err: any) {
      onError(err?.message || 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  }, [stripe, elements, clientSecret, onSuccess, onError]);

  return (
    <div className="space-y-4">
      <div
        className={`p-4 border rounded-lg ${
          isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'
        }`}
      >
        <CardElement
          onReady={() => setReady(true)}
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: isDark ? '#f3f4f6' : '#111827',
                fontFamily:
                  'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
                '::placeholder': { color: isDark ? '#9ca3af' : '#6b7280' },
                iconColor: isDark ? '#f3f4f6' : '#111827',
              },
              invalid: { color: '#ef4444', iconColor: '#ef4444' },
            },
            hidePostalCode: false,
          }}
        />
      </div>

      {!ready && (
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading secure card form…
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting || !stripe || !ready}
          className="flex-1 min-w-[200px] px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md focus-ring"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              Pay Now
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-6 py-3 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300 disabled:opacity-50 focus-ring"
        >
          Cancel
        </button>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
        <Shield className="w-3 h-3 text-green-500" />
        Your card details are sent directly to Stripe. We never see them.
      </p>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function PaymentForm(props: PaymentFormProps): JSX.Element {
  const {
    amount,
    currency,
    paymentMethod,
    provider,
    customerId,
    customerLoyaltyPoints = 0,
    saleId,
    cartId,
    businessUnitId,
    cashRegisterId,
    cashRegisterSessionId,
    defaultMobileProvider = 'MPESA',
    defaultPhoneNumber = '',
    returnUrl,
    cancelUrl,
    stripeClientSecret,
    onSuccess,
    onError,
    onCancel,
    onAwaitingConfirmation,
    className = '',
  } = props;

  const { isDark } = useThemeStore();

  const [step, setStep] = useState<
    'form' | 'processing' | 'awaiting' | 'complete' | 'error'
  >('form');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);

  // ── Provider selection ──────────────────────────────────────
  const [selectedProvider, setSelectedProvider] = useState<string>(
    provider ?? 'STRIPE',
  );
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);

  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardHolder, setCardHolder] = useState('');

  const [phoneNumber, setPhoneNumber] = useState(defaultPhoneNumber);
  const [mobileProvider, setMobileProvider] = useState<MobileProvider>(
    defaultMobileProvider,
  );

  const [giftCardCode, setGiftCardCode] = useState('');
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [bankReference, setBankReference] = useState('');

  // ── Gateway-driven state ────────────────────────────────────
  const [localStripeClientSecret, setLocalStripeClientSecret] =
    useState<string | null>(stripeClientSecret ?? null);
  const [awaitingSaleId, setAwaitingSaleId] = useState<string | null>(null);
  const [awaitingMessage, setAwaitingMessage] = useState<string>('');

  // ── Idempotency key ─────────────────────────────────────────
  const idempotencyKeyRef = useRef<string | null>(null);
  const ensureIdempotencyKey = useCallback((): string => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `pf_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
    return idempotencyKeyRef.current;
  }, []);
  const resetIdempotencyKey = useCallback((): void => {
    idempotencyKeyRef.current = null;
  }, []);

  // ── Currency-aware formatter ────────────────────────────────
  const renderCurrency =
    currency || process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || 'UGX';

  const fmt = useCallback(
    (value: number): string => formatCurrency(value, renderCurrency),
    [renderCurrency],
  );

  useEffect(() => {
    if (!stripeClientSecret) return;
    if (stripeClientSecret === localStripeClientSecret) return;
    setLocalStripeClientSecret(stripeClientSecret);
    setStep('form');
    setProcessing(false);
  }, [stripeClientSecret, localStripeClientSecret]);

  const maxPoints = Math.min(
    customerLoyaltyPoints,
    Math.floor(amount * 10),
  );
  const loyaltyDiscount = (loyaltyPoints || 0) * 0.1;
  const finalAmount = amount - loyaltyDiscount;

  useEffect(() => {
    if (!phoneNumber && defaultPhoneNumber) {
      setPhoneNumber(defaultPhoneNumber);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultPhoneNumber]);

  // ── Provider lookups ─────────────────────────────────────────

  const getProviderConfig = (providerCode: string) => {
    return PROVIDER_CONFIGS[providerCode] || PROVIDER_CONFIGS.STRIPE;
  };

  /**
   * Resolve the inline logo component for a provider code. The
   * `ProviderLogos` module does the case-insensitive lookup;
   * this wrapper exists only so call sites read the same as
   * before.
   */
  const getProviderLogoComponent = (providerCode: string) =>
    getProviderLogo(providerCode);

  const getAvailableProviders = (): string[] => {
    const methodProviders: Record<string, string[]> = {
      CREDIT_CARD: ['STRIPE', 'FLUTTERWAVE', 'SQUARE'],
      DEBIT_CARD: ['STRIPE', 'FLUTTERWAVE', 'SQUARE'],
      PAYPAL: ['PAYPAL'],
      BANK_TRANSFER: ['FLUTTERWAVE'],
      GIFT_CARD: ['STRIPE'],
      LOYALTY_POINTS: ['STRIPE'],
      MTN: ['MTN'],
      AIRTEL: ['AIRTEL'],
    };
    return methodProviders[paymentMethod] || ['STRIPE'];
  };

  const isInlineCardProvider = (providerCode: string): boolean =>
    providerCode === 'STRIPE';

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

  // ── Validation ───────────────────────────────────────────────

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (paymentMethod === 'MOBILE_MONEY') {
      const phoneError = validatePhoneForProvider(
        phoneNumber,
        mobileProvider,
      );
      if (phoneError) {
        newErrors.phoneNumber = phoneError;
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

    if (paymentMethod === 'SQUARE') {
      newErrors.square =
        'Square requires the Square Web SDK card form. Please use Stripe for card payments.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [
    paymentMethod,
    phoneNumber,
    mobileProvider,
    giftCardCode,
    loyaltyPoints,
    maxPoints,
  ]);

  // ── Handle gateway nextAction ────────────────────────────────

  const handleNextAction = useCallback(
    (action: NextAction, result: OnlineCheckoutResponse): void => {
      switch (action.type) {
        case 'CONFIRM_STRIPE': {
          setLocalStripeClientSecret(action.clientSecret);
          setStep('form');
          setProcessing(false);
          return;
        }

        case 'REDIRECT': {
          setAwaitingMessage('Redirecting to payment provider…');
          setStep('awaiting');
          window.setTimeout(() => {
            window.location.href = action.url;
          }, 150);
          return;
        }

        case 'AWAIT_STK_PUSH': {
          setAwaitingSaleId(result.sale.id);
          setAwaitingMessage(
            action.message ||
              `Check your phone to approve the ${mobileProvider} request.`,
          );
          setStep('awaiting');
          setProcessing(false);
          onAwaitingConfirmation?.(result.sale.id);
          return;
        }

        case 'OFFLINE': {
          setAwaitingSaleId(result.sale.id);
          setAwaitingMessage(action.message);
          setStep('awaiting');
          setProcessing(false);
          onAwaitingConfirmation?.(result.sale.id);
          onSuccess?.(result.payment);
          return;
        }

        case 'NONE': {
          setStep('complete');
          setProcessing(false);
          onSuccess?.(result.payment);
          toast.success('Payment confirmed');
          return;
        }

        default: {
          const _exhaustive: never = action;
          void _exhaustive;
          setStep('error');
          setProcessing(false);
          onError?.(new Error('Unexpected gateway response'));
        }
      }
    },
    [
      onAwaitingConfirmation,
      onSuccess,
      onError,
      mobileProvider,
    ],
  );

  // ── Submit ───────────────────────────────────────────────────

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!validate()) return;

    if (localStripeClientSecret && selectedProvider === 'STRIPE') {
      return;
    }

    setProcessing(true);
    setStep('processing');

    try {
      const idempotencyKey = ensureIdempotencyKey();

      if (cartId) {
        const result = await checkoutService.processOnlineCheckout({
          cartId,
          customerId,
          paymentMethod,
          notes: undefined,
          applyLoyaltyPoints: loyaltyPoints > 0,
          businessUnitId,
          customerPhone:
            paymentMethod === 'MOBILE_MONEY' ? phoneNumber : undefined,
          mobileMoneyProvider:
            paymentMethod === 'MOBILE_MONEY' ? mobileProvider : undefined,
          idempotencyKey,
          returnUrl,
          cancelUrl,
          promotionDiscount: undefined,
        });

        handleNextAction(result.nextAction, result);
        return;
      }

      if (saleId) {
        if (paymentMethod === 'MOBILE_MONEY') {
          const routing: MobileRouting = getMobileRouting(mobileProvider);

          if (routing === 'mpesa') {
            const response = await paymentService.initiateMpesaSTKPush({
              phoneNumber,
              amount: finalAmount || amount,
              saleId,
              customerId,
              businessUnitId,
              idempotencyKey,
              accountReference: `SALE-${saleId}`,
              transactionDesc: `Payment for sale ${saleId}`,
              currency,
            });

            setAwaitingSaleId(saleId);
            setAwaitingMessage(
              response?.data?.CustomerMessage ||
                'Check your phone to approve the M-Pesa request.',
            );
            setStep('awaiting');
            setProcessing(false);
            onAwaitingConfirmation?.(saleId);
            return;
          }

          const response = await paymentService.initiateMobileMoneyPayment({
            provider: mobileProvider as 'MTN' | 'AIRTEL',
            phoneNumber,
            amount: finalAmount || amount,
            currency,
            saleId,
            customerId,
            businessUnitId,
            idempotencyKey,
            reference: `SALE-${saleId}`,
            description: `Payment for sale ${saleId}`,
          });

          setAwaitingSaleId(saleId);
          setAwaitingMessage(
            response?.data?.message ||
              response?.message ||
              `Check your phone to approve the ${mobileProvider} request.`,
          );
          setStep('awaiting');
          setProcessing(false);
          onAwaitingConfirmation?.(saleId);
          return;
        }

        const isCardMethod =
          paymentMethod === 'CREDIT_CARD' ||
          paymentMethod === 'DEBIT_CARD' ||
          paymentMethod === 'SQUARE';

        if (isCardMethod && selectedProvider === 'STRIPE') {
          const intent = await paymentService.createPaymentIntent({
            amount: finalAmount || amount,
            currency,
            description: `Payment for sale ${saleId}`,
            metadata: {
              saleId,
              userId: customerId ?? '',
              paymentMethod,
              idempotencyKey,
            },
            idempotencyKey,
          });

          setLocalStripeClientSecret(intent.clientSecret);
          setStep('form');
          setProcessing(false);
          return;
        }

        const payment = await paymentService.processOrderPayment({
          saleId,
          amount: finalAmount || amount,
          paymentMethod: paymentMethod as any,
          customerId,
          cashRegisterId,
          cashRegisterSessionId,
          currency,
          businessUnitId,
          idempotencyKey,
          description: `Payment for sale ${saleId}`,
          metadata: {
            provider: selectedProvider,
            pointsToUse:
              paymentMethod === 'LOYALTY_POINTS'
                ? loyaltyPoints
                : undefined,
            bankReference:
              paymentMethod === 'BANK_TRANSFER'
                ? bankReference || `BT-${Date.now()}`
                : undefined,
          },
          tipAmount: undefined,
          source: 'payment_form',
          gatewayId:
            paymentMethod === 'GIFT_CARD' ? giftCardCode : undefined,
        });

        setStep('complete');
        setProcessing(false);
        resetIdempotencyKey();
        onSuccess?.(payment);
        toast.success('Payment processed successfully');
        return;
      }

      // ── No saleId, no cartId: direct payment endpoint ──────
      const paymentData: Record<string, unknown> = {
        amount: finalAmount || amount,
        paymentMethod,
        customerId,
        businessUnitId,
        idempotencyKey,
        metadata: {
          provider: selectedProvider,
        } as Record<string, unknown>,
      };

      if (currency) {
        paymentData.currency = currency;
      }

      if (
        paymentMethod === 'CREDIT_CARD' ||
        paymentMethod === 'DEBIT_CARD'
      ) {
        paymentData.source = 'card';
        (paymentData.metadata as Record<string, unknown>).cardLast4 =
          cardNumber.replace(/\s/g, '').slice(-4);
        (paymentData.metadata as Record<string, unknown>).cardBrand =
          'unknown';
      }

      if (paymentMethod === 'GIFT_CARD') {
        paymentData.gatewayId = giftCardCode;
      }

      if (paymentMethod === 'LOYALTY_POINTS') {
        (paymentData.metadata as Record<string, unknown>).pointsToUse =
          loyaltyPoints;
      }

      if (paymentMethod === 'BANK_TRANSFER') {
        (paymentData.metadata as Record<string, unknown>).bankReference =
          bankReference || `BT-${Date.now()}`;
      }

      const payment = await paymentService.processPayment(
        paymentData as any,
      );

      setStep('complete');
      setProcessing(false);
      resetIdempotencyKey();
      onSuccess?.(payment);
      toast.success('Payment processed successfully');
    } catch (error: any) {
      console.error('Payment form submit error:', error);
      setStep('error');
      setProcessing(false);
      onError?.(error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          'Payment failed. Please try again.',
      );
    }
  }, [
    amount,
    finalAmount,
    paymentMethod,
    currency,
    customerId,
    businessUnitId,
    cashRegisterId,
    cashRegisterSessionId,
    returnUrl,
    cancelUrl,
    saleId,
    cartId,
    selectedProvider,
    loyaltyPoints,
    phoneNumber,
    mobileProvider,
    giftCardCode,
    bankReference,
    cardNumber,
    localStripeClientSecret,
    validate,
    handleNextAction,
    ensureIdempotencyKey,
    resetIdempotencyKey,
    onSuccess,
    onError,
    onAwaitingConfirmation,
  ]);

  // ── Stripe callbacks ─────────────────────────────────────────

  const handleStripeSuccess = useCallback((): void => {
    setLocalStripeClientSecret(null);
    setAwaitingMessage('Card approved. Confirming with your bank…');
    setStep('awaiting');
    setProcessing(false);
    resetIdempotencyKey();

    const confirmId = saleId ?? awaitingSaleId ?? null;
    if (confirmId) {
      onAwaitingConfirmation?.(confirmId);
    } else {
      setStep('complete');
      onSuccess?.({ status: 'PAID', provider: 'STRIPE' });
    }
    toast.success('Card approved');
  }, [
    saleId,
    awaitingSaleId,
    onAwaitingConfirmation,
    onSuccess,
    resetIdempotencyKey,
  ]);

  const handleStripeError = useCallback((message: string): void => {
    toast.error(message);
  }, []);

  const handleStripeCancel = useCallback((): void => {
    setLocalStripeClientSecret(null);
    resetIdempotencyKey();
  }, [resetIdempotencyKey]);

  // ── Render helpers ───────────────────────────────────────────

  const renderProviderSelector = () => {
    const availableProviders = getAvailableProviders();
    if (availableProviders.length <= 1) return null;

    const config = getProviderConfig(selectedProvider);
    const Logo = getProviderLogoComponent(selectedProvider);

    return (
      <div className="mb-4">
        <label
          className={`block text-sm font-medium mb-2 ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
          Payment Provider
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setShowProviderDropdown(!showProviderDropdown)
            }
            className={`w-full flex items-center gap-3 px-4 py-3 border rounded-lg transition duration-250 focus-ring ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600'
                : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'
            } ${showProviderDropdown ? 'ring-2 ring-brand-500' : ''}`}
          >
            {Logo ? (
              <div className="relative w-8 h-8 flex-shrink-0">
                <Logo className="w-8 h-8 rounded object-contain" />
              </div>
            ) : (
              <span className="text-xl">{config.icon}</span>
            )}
            <span className="flex-1 text-left">{config.name}</span>
            <span
              className={`text-xs ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              {config.description}
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-250 ${
                showProviderDropdown ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showProviderDropdown && (
            <div
              className={`absolute top-full left-0 right-0 mt-1 rounded-xl shadow-card border z-modal overflow-hidden custom-scrollbar animate-slide-down ${
                isDark
                  ? 'bg-gray-800 border-gray-700'
                  : 'bg-white border-gray-200'
              }`}
            >
              {availableProviders.map((providerCode) => {
                const providerConfig = getProviderConfig(providerCode);
                const ProviderLogo = getProviderLogoComponent(providerCode);
                const isSelected = selectedProvider === providerCode;

                return (
                  <button
                    key={providerCode}
                    type="button"
                    onClick={() => {
                      setSelectedProvider(providerCode);
                      setShowProviderDropdown(false);
                      setLocalStripeClientSecret(null);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 transition duration-250 focus-ring ${
                      isSelected
                        ? isDark
                          ? 'bg-brand-900/30 text-white'
                          : 'bg-brand-50 text-brand-700'
                        : isDark
                          ? 'hover:bg-gray-700 text-gray-300'
                          : 'hover:bg-gray-50 text-gray-700'
                    } ${isSelected ? 'border-l-4 border-brand-500' : ''}`}
                  >
                    {ProviderLogo ? (
                      <div className="relative w-8 h-8 flex-shrink-0">
                        <ProviderLogo className="w-8 h-8 rounded object-contain" />
                      </div>
                    ) : (
                      <span className="text-xl">{providerConfig.icon}</span>
                    )}
                    <span className="flex-1 text-left">
                      {providerConfig.name}
                    </span>
                    <span
                      className={`text-xs ${
                        isDark ? 'text-gray-500' : 'text-gray-400'
                      }`}
                    >
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

  const renderCardForm = () => {
    const isStripe = isInlineCardProvider(selectedProvider);

    if (!isStripe) {
      const config = getProviderConfig(selectedProvider);
      return (
        <div className="space-y-4">
          {renderProviderSelector()}
          <div
            className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-cyan-50'}`}
          >
            <div className="flex items-start gap-3">
              <ExternalLink className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p
                  className={`font-medium ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {config.name} Hosted Checkout
                </p>
                <p
                  className={isDark ? 'text-gray-400' : 'text-gray-500'}
                >
                  You will be redirected to {config.name} to enter your
                  card.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {renderProviderSelector()}

        <div
          className={`p-4 rounded-lg ${
            isDark ? 'bg-gray-700/40' : 'bg-primary-50'
          }`}
        >
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p
                className={`font-medium ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                Secure Stripe Checkout
              </p>
              <p
                className={isDark ? 'text-gray-400' : 'text-gray-500'}
              >
                Your card is entered directly into a Stripe-hosted
                iframe. It never touches our servers.
              </p>
            </div>
          </div>
        </div>

        {isStripe && localStripeClientSecret && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <Elements stripe={getStripePromise()}>
              <StripeCardSubForm
                clientSecret={localStripeClientSecret}
                isDark={isDark}
                onSuccess={handleStripeSuccess}
                onError={handleStripeError}
                onCancel={handleStripeCancel}
              />
            </Elements>
          </div>
        )}
      </div>
    );
  };

  const renderPayPalForm = () => (
    <div className="space-y-4">
      <div
        className={`p-4 rounded-lg ${
          isDark ? 'bg-gray-700' : 'bg-primary-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-primary-500" />
          <div>
            <p
              className={`font-medium ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              PayPal Checkout
            </p>
            <p
              className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              You will be redirected to PayPal to complete your payment
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFlutterwaveForm = () => (
    <div className="space-y-4">
      <div
        className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-cyan-50'}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌊</span>
          <div>
            <p
              className={`font-medium ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              Flutterwave Payment
            </p>
            <p
              className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              Pay with Cards, Mobile Money, or Bank Transfer
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMobileMoneyForm = () => {
    const spec = MOBILE_PROVIDERS.find((p) => p.id === mobileProvider);
    const validationError = phoneNumber
      ? validatePhoneForProvider(phoneNumber, mobileProvider)
      : null;
    const isValid = phoneNumber && !validationError;

    return (
      <div className="space-y-4">
        <MobileMoneyProviderPicker
          selected={mobileProvider}
          onSelect={setMobileProvider}
        />

        <div>
          <label
            className={`block text-sm font-medium mb-1 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            Phone Number <span className="text-danger-500">*</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder={spec?.phonePlaceholder || '+256 700 000 000'}
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent transition duration-250 tabular-nums ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } ${
                errors.phoneNumber || validationError
                  ? 'border-danger-500'
                  : isValid
                    ? 'border-success-500'
                    : ''
              }`}
            />
            {isValid && (
              <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-success-500 pointer-events-none" />
            )}
          </div>
          {(errors.phoneNumber || validationError) && (
            <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.phoneNumber || validationError}
            </p>
          )}
          {isValid && spec && (
            <p className="mt-1 text-xs text-success-600 dark:text-success-400 tabular-nums">
              ✓ We will send the {spec.name} prompt to {phoneNumber}
            </p>
          )}
        </div>

        <div
          className={`p-3 rounded-lg ${
            isDark
              ? 'bg-blue-900/20 border border-blue-800'
              : 'bg-blue-50 border border-blue-200'
          }`}
        >
          <p className="text-xs text-blue-700 dark:text-blue-300">
            You will receive a prompt on your phone. Approve it to
            complete the payment. Do not close this page.
          </p>
        </div>
      </div>
    );
  };

  const renderGiftCardForm = () => (
    <div className="space-y-4">
      <div>
        <label
          className={`block text-sm font-medium mb-1 ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
          Gift Card Code
        </label>
        <div className="relative">
          <Gift className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={giftCardCode}
            onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
            placeholder="GIFT-XXXX-XXXX"
            className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent transition duration-250 font-mono ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } ${errors.giftCardCode ? 'border-danger-500' : ''}`}
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
      <div
        className={`p-4 rounded-lg ${
          isDark ? 'bg-gray-700' : 'bg-primary-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <Star className="w-6 h-6 text-warning-500 fill-current" />
          <div>
            <p
              className={`font-medium ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              Available Points: {customerLoyaltyPoints}
            </p>
            <p
              className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              {maxPoints} points can be used for this order
            </p>
          </div>
        </div>
      </div>

      <div>
        <label
          className={`block text-sm font-medium mb-1 ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
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
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent transition duration-250 tabular-nums ${
            isDark
              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
          } ${errors.loyaltyPoints ? 'border-danger-500' : ''}`}
        />
        {errors.loyaltyPoints && (
          <p className="mt-1 text-sm text-danger-500">
            {errors.loyaltyPoints}
          </p>
        )}
        <p
          className={`mt-1 text-sm tabular-nums ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          Discount: {fmt(loyaltyDiscount)}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="useMaxPoints"
          checked={loyaltyPoints === maxPoints && maxPoints > 0}
          onChange={(e) =>
            setLoyaltyPoints(e.target.checked ? maxPoints : 0)
          }
          className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 transition duration-250"
        />
        <label
          htmlFor="useMaxPoints"
          className={`text-sm ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
          Use maximum points for this order
        </label>
      </div>
    </div>
  );

  const renderBankTransferForm = () => (
    <div className="space-y-4">
      <div
        className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}
      >
        <p
          className={`text-sm ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
          Please make a bank transfer to the following account:
        </p>
        <div className="mt-2 p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <p
            className={`font-mono text-sm ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            Bank: Kalwanga Bank
          </p>
          <p
            className={`font-mono text-sm tabular-nums ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            Account: 1234567890
          </p>
        </div>
      </div>

      <div>
        <label
          className={`block text-sm font-medium mb-1 ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
          Bank Reference Number
        </label>
        <input
          type="text"
          value={bankReference}
          onChange={(e) => setBankReference(e.target.value)}
          placeholder="Enter bank reference"
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent transition duration-250 ${
            isDark
              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
          }`}
        />
      </div>
    </div>
  );

  const renderForm = () => {
    switch (paymentMethod) {
      case 'CREDIT_CARD':
      case 'DEBIT_CARD':
      case 'SQUARE':
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

  const renderProcessing = () => {
    const config = getProviderConfig(selectedProvider);

    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-gray-200 dark:border-gray-700 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-brand-600 rounded-full animate-spin border-t-transparent"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
          </div>
        </div>
        <h3
          className={`mt-4 text-lg font-semibold ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          Processing Payment
        </h3>
        <p
          className={`text-sm mt-2 ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          Please wait while we process your payment via {config.name}…
        </p>
        <div className="mt-4 flex items-center gap-2 text-sm text-brand-600 dark:text-brand-400">
          <Shield className="w-4 h-4" />
          <span>Secure transaction</span>
        </div>
      </div>
    );
  };

  const renderAwaiting = () => {
    const spec = MOBILE_PROVIDERS.find((p) => p.id === mobileProvider);
    const providerName = spec?.name || 'your provider';

    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-20 h-20 bg-warning-100 dark:bg-warning-900/30 rounded-full flex items-center justify-center">
          <Smartphone className="w-12 h-12 text-warning-600 dark:text-warning-400" />
        </div>
        <h3
          className={`mt-4 text-lg font-semibold ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          Check your phone
        </h3>
        <p
          className={`text-sm mt-2 text-center max-w-sm ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          {awaitingMessage ||
            `Approve the ${providerName} request on your phone to complete the payment.`}
        </p>

        <div className="mt-4 flex items-center gap-2 text-sm text-brand-600 dark:text-brand-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Waiting for confirmation…</span>
        </div>

        {awaitingSaleId && (
          <p
            className={`mt-4 text-xs font-mono ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            Ref: {awaitingSaleId.slice(0, 8)}
          </p>
        )}

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-6 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline focus-ring rounded"
          >
            Cancel and go back
          </button>
        )}
      </div>
    );
  };

  const renderComplete = () => {
    const config = getProviderConfig(selectedProvider);

    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-20 h-20 bg-success-100 dark:bg-success-900/30 rounded-full flex items-center justify-center">
          <CheckCircle className="w-12 h-12 text-success-600 dark:text-success-400" />
        </div>
        <h3
          className={`mt-4 text-lg font-semibold ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          Payment Successful!
        </h3>
        <p
          className={`text-sm mt-2 ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          Your payment has been processed successfully via {config.name}.
        </p>
        <p
          className={`text-sm font-medium mt-2 tabular-nums ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          Amount: {fmt(finalAmount || amount)}
        </p>
        {onCancel && (
          <button onClick={onCancel} className="mt-6 btn-brand">
            Continue
          </button>
        )}
      </div>
    );
  };

  const renderError = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-20 h-20 bg-danger-100 dark:bg-danger-900/30 rounded-full flex items-center justify-center">
        <XCircle className="w-12 h-12 text-danger-600 dark:text-danger-400" />
      </div>
      <h3
        className={`mt-4 text-lg font-semibold ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}
      >
        Payment Failed
      </h3>
      <p
        className={`text-sm mt-2 ${
          isDark ? 'text-gray-400' : 'text-gray-500'
        }`}
      >
        There was an error processing your payment. Please try again.
      </p>
      <div className="mt-6 flex gap-3">
        <button onClick={() => setStep('form')} className="btn-brand">
          Try Again
        </button>
        {onCancel && (
          <button onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        )}
      </div>
    </div>
  );

  const payButtonLabel = (() => {
    if (paymentMethod === 'MOBILE_MONEY') {
      return `Send Payment Prompt — ${fmt(finalAmount || amount)}`;
    }
    if (paymentMethod === 'PAYPAL') {
      return `Continue to PayPal — ${fmt(finalAmount || amount)}`;
    }
    if (paymentMethod === 'FLUTTERWAVE') {
      return `Continue to Flutterwave — ${fmt(finalAmount || amount)}`;
    }
    if (paymentMethod === 'SQUARE') {
      return `Pay ${fmt(finalAmount || amount)}`;
    }
    if (
      (paymentMethod === 'CREDIT_CARD' ||
        paymentMethod === 'DEBIT_CARD') &&
      !isInlineCardProvider(selectedProvider)
    ) {
      const config = getProviderConfig(selectedProvider);
      return `Continue to ${config.name} — ${fmt(finalAmount || amount)}`;
    }
    return `Pay ${fmt(finalAmount || amount)}`;
  })();

  return (
    <div className={`space-y-6 ${className} animate-fade-in`}>
      {step === 'form' && (
        <div
          className={`p-4 rounded-2xl ${
            isDark ? 'bg-gray-700/30' : 'bg-gray-50'
          }`}
        >
          <div className="flex justify-between items-center">
            <span
              className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              Amount to Pay
            </span>
            <span
              className={`text-xl font-bold tabular-nums ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              {fmt(finalAmount || amount)}
            </span>
          </div>
          {loyaltyDiscount > 0 && (
            <div className="flex justify-between items-center mt-1">
              <span
                className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                Loyalty Discount
              </span>
              <span className="text-sm tabular-nums text-success-600 dark:text-success-400">
                -{fmt(loyaltyDiscount)}
              </span>
            </div>
          )}
        </div>
      )}

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
          {step === 'awaiting' && renderAwaiting()}
          {step === 'complete' && renderComplete()}
          {step === 'error' && renderError()}
        </motion.div>
      </AnimatePresence>

      {step === 'form' && !localStripeClientSecret && (
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          {onCancel && (
            <button onClick={onCancel} className="flex-1 btn-secondary">
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={processing}
            className="flex-1 btn-brand disabled:opacity-50"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                {payButtonLabel}
              </>
            )}
          </button>
        </div>
      )}

      {step === 'form' && (
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
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
        </div>
      )}
    </div>
  );
}

export default PaymentForm;
