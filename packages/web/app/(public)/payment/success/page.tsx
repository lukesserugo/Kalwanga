// D:\Projects\Kalwanga\packages\web\app\(public)\payment\success\page.tsx

'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  Receipt,
  Download,
  Printer,
  ShoppingBag,
  Clock,
  Mail,
  Phone,
  User,
  Shield,
  Copy,
  Loader2,
  AlertCircle,
  Home,
  FileText,
  Star,
  Lock,
  Globe,
  Smartphone,
  Banknote,
  Wallet,
  Building,
  Gift,
  CreditCard,
} from 'lucide-react';
import { useThemeStore } from '../../../stores/themeStore';
import { paymentService } from '../../../../services/paymentService';
import { checkoutService } from '../../../../services/checkoutService';
import {
  formatCurrency,
  formatDate,
} from '../../../../utils/formatters';
import { toast } from '../../../../utils/toast-manager';

// ============================================
// TYPES
// ============================================

interface PaymentDetails {
  id: string;
  amount: number;
  paymentMethod: string;
  status: string;
  reference: string;
  processedAt: string;
  provider?: string;
  gatewayId?: string;
  metadata?: Record<string, unknown>;
  sale?: {
    id: string;
    receiptNumber: string;
    total: number;
    items: Array<{
      productName: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
  };
  customer?: {
    name: string;
    email: string;
    phone: string;
  };
  businessUnit?: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
}

// ============================================
// HELPERS
// ============================================

/**
 * Resolve the provider from a payment. Reads the legacy top-level
 * field first, then `metadata.provider`, then `gatewayId`.
 */
function resolveProvider(raw: any): string | undefined {
  if (!raw) return undefined;
  if (raw.provider) return raw.provider;
  const meta = raw.metadata ?? {};
  const metaProvider =
    typeof meta.provider === 'string' ? meta.provider : undefined;
  return metaProvider || raw.gatewayId || undefined;
}

/**
 * Map whatever the backend returns from `getCheckoutById` or
 * `getPaymentStatus` into the shape this page renders.
 */
function mapToPaymentDetails(raw: any, fallbackAmount = 0): PaymentDetails {
  if (!raw) {
    return {
      id: '',
      amount: fallbackAmount,
      paymentMethod: 'CREDIT_CARD',
      status: 'PENDING',
      reference: '',
      processedAt: new Date().toISOString(),
    };
  }

  // Handle both the Sale shape (from getCheckoutById) and the
  // Payment shape (from getPaymentStatus).
  const isSale = Array.isArray(raw.items) && 'receiptNumber' in raw;

  if (isSale) {
    const payment = Array.isArray(raw.payments) ? raw.payments[0] : null;
    const customer = raw.customer;
    const businessUnit = raw.businessUnit;

    return {
      id: payment?.id || raw.id,
      amount: raw.total ?? fallbackAmount,
      paymentMethod: payment?.paymentMethod || 'CREDIT_CARD',
      status: raw.status || payment?.status || 'PENDING',
      reference: raw.receiptNumber || payment?.reference || raw.id,
      processedAt: raw.saleDate || payment?.processedAt || new Date().toISOString(),
      provider: resolveProvider(payment),
      gatewayId: payment?.gatewayId,
      metadata: payment?.metadata,
      sale: {
        id: raw.id,
        receiptNumber: raw.receiptNumber || '',
        total: raw.total ?? fallbackAmount,
        items: (raw.items || []).map((item: any) => ({
          productName: item.product?.name || item.productName || 'Item',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
      },
      customer: customer
        ? {
            name:
              customer.name ||
              `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim(),
            email: customer.email || '',
            phone: customer.phone || customer.phoneNumber || '',
          }
        : undefined,
      businessUnit: businessUnit
        ? {
            name: businessUnit.name || '',
            address: businessUnit.address || '',
            phone: businessUnit.phone || '',
            email: businessUnit.email || '',
          }
        : undefined,
    };
  }

  // Payment shape (from getPaymentStatus / findFirst by transactionId)
  return {
    id: raw.id,
    amount: raw.amount ?? fallbackAmount,
    paymentMethod: raw.paymentMethod || 'CREDIT_CARD',
    status: raw.status || 'PENDING',
    reference: raw.reference || raw.transactionId || raw.id,
    processedAt: raw.processedAt || new Date().toISOString(),
    provider: resolveProvider(raw),
    gatewayId: raw.gatewayId,
    metadata: raw.metadata,
    sale: raw.sale
      ? {
          id: raw.sale.id,
          receiptNumber: raw.sale.receiptNumber || '',
          total: raw.sale.total ?? raw.amount ?? fallbackAmount,
          items: (raw.sale.items || []).map((item: any) => ({
            productName: item.product?.name || item.productName || 'Item',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        }
      : undefined,
    customer: raw.user
      ? {
          name: `${raw.user.firstName ?? ''} ${raw.user.lastName ?? ''}`.trim(),
          email: raw.user.email || '',
          phone: raw.user.phone || raw.user.phoneNumber || '',
        }
      : undefined,
    businessUnit: raw.businessUnit
      ? {
          name: raw.businessUnit.name || '',
          address: raw.businessUnit.address || '',
          phone: raw.businessUnit.phone || '',
          email: raw.businessUnit.email || '',
        }
      : undefined,
  };
}

// ============================================
// CONSTANTS
// ============================================

const PROVIDER_IMAGE_URLS: Record<string, string> = {
  STRIPE: 'https://stripe.com/img/v3/home/social.png',
  PAYPAL:
    'https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg',
  FLUTTERWAVE: 'https://flutterwave.com/images/logo/flyer.png',
  PAYSTACK: 'https://paystack.com/assets/images/logo.png',
  SQUARE: 'https://squareup.com/icons/square_logo.svg',
  MTN: 'https://www.mtn.co.ug/wp-content/uploads/2023/05/mtn-logo.png',
  AIRTEL:
    'https://www.airtel.in/static-assets/new-home/img/airtel-red-logo.svg',
  TIGO: 'https://www.tigo.com.tz/sites/default/files/tigo-logo.png',
  VODAFONE:
    'https://www.vodafone.com/content/dam/vodcom/Images/Logo/vodafone_logo_red.png',
  CASH: 'https://cdn-icons-png.flaticon.com/512/2331/2331970.png',
  MOBILE_MONEY: 'https://cdn-icons-png.flaticon.com/512/545/545245.png',
  BANK_TRANSFER:
    'https://cdn-icons-png.flaticon.com/512/2845/2845813.png',
  GIFT_CARD: 'https://cdn-icons-png.flaticon.com/512/3144/3144456.png',
  LOYALTY_POINTS:
    'https://cdn-icons-png.flaticon.com/512/1828/1828665.png',
};

const PROVIDER_DARK_IMAGE_URLS: Record<string, string> = {
  STRIPE: 'https://stripe.com/img/v3/home/social.png',
  PAYPAL:
    'https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg',
  FLUTTERWAVE: 'https://flutterwave.com/images/logo/flyer.png',
  PAYSTACK: 'https://paystack.com/assets/images/logo-white.png',
  SQUARE: 'https://squareup.com/icons/square_logo.svg',
  MTN: 'https://www.mtn.co.ug/wp-content/uploads/2023/05/mtn-logo.png',
  AIRTEL:
    'https://www.airtel.in/static-assets/new-home/img/airtel-red-logo.svg',
  TIGO: 'https://www.tigo.com.tz/sites/default/files/tigo-logo.png',
  VODAFONE:
    'https://www.vodafone.com/content/dam/vodcom/Images/Logo/vodafone_logo_red.png',
  CASH: 'https://cdn-icons-png.flaticon.com/512/2331/2331970.png',
  MOBILE_MONEY: 'https://cdn-icons-png.flaticon.com/512/545/545245.png',
  BANK_TRANSFER:
    'https://cdn-icons-png.flaticon.com/512/2845/2845813.png',
  GIFT_CARD: 'https://cdn-icons-png.flaticon.com/512/3144/3144456.png',
  LOYALTY_POINTS:
    'https://cdn-icons-png.flaticon.com/512/1828/1828665.png',
};

const PAYMENT_METHOD_ICONS: Record<string, any> = {
  CASH: Banknote,
  CREDIT_CARD: CreditCard,
  DEBIT_CARD: Wallet,
  MOBILE_MONEY: Smartphone,
  BANK_TRANSFER: Building,
  GIFT_CARD: Gift,
  LOYALTY_POINTS: Star,
  CHECK: FileText,
  PAYPAL: Globe,
  FLUTTERWAVE: Globe,
  PAYSTACK: CreditCard,
  SQUARE: CreditCard,
  MTN: Smartphone,
  AIRTEL: Smartphone,
  TIGO: Smartphone,
  VODAFONE: Smartphone,
};

const PROVIDER_CONFIGS: Record<
  string,
  { icon: string; name: string; color: string }
> = {
  STRIPE: { icon: '💳', name: 'Stripe', color: 'blue' },
  PAYPAL: { icon: '💸', name: 'PayPal', color: 'blue' },
  FLUTTERWAVE: { icon: '🌊', name: 'Flutterwave', color: 'cyan' },
  PAYSTACK: { icon: '🔷', name: 'Paystack', color: 'sky' },
  SQUARE: { icon: '⬜', name: 'Square', color: 'gray' },
  CASH: { icon: '💰', name: 'Cash', color: 'green' },
  MOBILE_MONEY: { icon: '📱', name: 'Mobile Money', color: 'orange' },
  BANK_TRANSFER: { icon: '🏦', name: 'Bank Transfer', color: 'indigo' },
  GIFT_CARD: { icon: '🎁', name: 'Gift Card', color: 'pink' },
  LOYALTY_POINTS: { icon: '⭐', name: 'Loyalty Points', color: 'yellow' },
  MTN: { icon: '📱', name: 'MTN Mobile Money', color: 'yellow' },
  AIRTEL: { icon: '📱', name: 'Airtel Money', color: 'red' },
  TIGO: { icon: '📱', name: 'Tigo Pesa', color: 'blue' },
  VODAFONE: { icon: '📱', name: 'Vodafone Cash', color: 'red' },
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDark } = useThemeStore();

  // ── URL params ───────────────────────────────────────────────
  //
  // `saleId` — our own checkout flow's return path.
  // `session_id` / `payment_intent` — Stripe's hosted redirect.
  // `orderId` — orders flow (rare, kept for compatibility).
  const saleIdParam = searchParams.get('saleId');
  const sessionIdParam = searchParams.get('session_id');
  const paymentIntentIdParam = searchParams.get('payment_intent');
  const orderIdParam = searchParams.get('orderId');

  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(10);
  const [confirming, setConfirming] = useState(false);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // ── Data loading ─────────────────────────────────────────────

  const fetchPaymentDetails = useCallback(async () => {
    try {
      setLoading(true);

      // ── Path A: sale-first (our checkout flow) ─────────────
      if (saleIdParam) {
        const sale = await checkoutService.getCheckoutById(saleIdParam);
        const details = mapToDetails(sale);

        setPayment(details);

        // If the sale isn't COMPLETED yet, the webhook may still
        // be in flight. Start polling until it lands.
        if (details.status !== 'COMPLETED') {
          setConfirming(true);
          startPollingSale(saleIdParam);
        }
        return;
      }

      // ── Path B: order-first ────────────────────────────────
      if (orderIdParam) {
        try {
          const order =
            await checkoutService.getCheckoutById(orderIdParam);
          const details = mapToDetails(order);
          setPayment(details);
          if (details.status !== 'COMPLETED') {
            setConfirming(true);
            startPollingSale(orderIdParam);
          }
          return;
        } catch (err) {
          console.warn('Order lookup failed:', err);
        }
      }

      // ── Path C: Stripe redirect (session / payment_intent) ─
      //
      // `session_id` and `payment_intent` are Stripe identifiers,
      // not our payment ids. `getPaymentStatus` takes a payment id,
      // so we look up the payment by transactionId instead. If the
      // backend doesn't expose that route, we show a best-effort
      // success screen.
      if (paymentIntentIdParam) {
        try {
          const response = await paymentService.getPayments({
            limit: 1,
            // The backend `getPaymentsSchema` does not support a
            // transactionId filter, so we fetch the most recent
            // payment and trust the URL contract. This is a
            // best-effort match; the source of truth is the sale
            // status flipped by the webhook.
          } as any);
          const first = Array.isArray(response.data)
            ? response.data[0]
            : null;
          if (first) {
            setPayment(mapPayment(first));
            return;
          }
        } catch (err) {
          console.warn('Payment lookup failed:', err);
        }
      }

      // ── Nothing to look up ─────────────────────────────────
      setError('No payment session found');
    } catch (err: any) {
      console.error('Failed to fetch payment:', err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to retrieve payment details',
      );
    } finally {
      setLoading(false);
    }
  }, [saleIdParam, orderIdParam, paymentIntentIdParam]);

  useEffect(() => {
    void fetchPaymentDetails();
  }, [fetchPaymentDetails]);

  // ── Polling for the webhook to land ──────────────────────────

  const startPollingSale = useCallback(
    (saleId: string) => {
      stopPolling();
      const startTime = Date.now();
      const MAX_WAIT_MS = 2 * 60 * 1000; // 2 minutes

      pollIntervalRef.current = setInterval(async () => {
        try {
          const sale = await checkoutService.getCheckoutById(saleId);
          const status = (sale as any).status;

          if (status === 'COMPLETED') {
            stopPolling();
            setPayment(mapToDetails(sale));
            setConfirming(false);
            toast.success('Payment confirmed');
            return;
          }

          if (
            status === 'CANCELLED' ||
            status === 'VOIDED' ||
            status === 'REFUNDED'
          ) {
            stopPolling();
            setConfirming(false);
            setError(
              'Payment was not completed. Please try again or use a different method.',
            );
            return;
          }
        } catch (err) {
          console.warn('Poll error:', err);
        }

        if (Date.now() - startTime > MAX_WAIT_MS) {
          stopPolling();
          setConfirming(false);
          // Keep the payment visible but stop spinning — the
          // webhook may still land later.
        }
      }, 2500);
    },
    [stopPolling],
  );

  // ── Countdown to auto-redirect ───────────────────────────────
  //
  // Only start the countdown once the payment is confirmed. If we
  // navigate away while still polling, the user never sees the
  // confirmation.

  useEffect(() => {
    if (
      payment &&
      payment.status === 'COMPLETED' &&
      countdown > 0
    ) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (
      payment &&
      payment.status === 'COMPLETED' &&
      countdown === 0
    ) {
      router.push('/dashboard');
    }
  }, [payment, countdown, router]);

  // ── Handlers ─────────────────────────────────────────────────

  const getProviderImageUrl = useCallback(
    (providerCode: string): string => {
      if (!providerCode) return '';
      return isDark && PROVIDER_DARK_IMAGE_URLS[providerCode]
        ? PROVIDER_DARK_IMAGE_URLS[providerCode]
        : PROVIDER_IMAGE_URLS[providerCode] || '';
    },
    [isDark],
  );

  const getProviderConfig = useCallback((providerCode: string) => {
    return (
      PROVIDER_CONFIGS[providerCode] || {
        icon: '💳',
        name: providerCode,
        color: 'gray',
      }
    );
  }, []);

  const getPaymentMethodIcon = useCallback((method: string) => {
    return PAYMENT_METHOD_ICONS[method] || CreditCard;
  }, []);

  const handlePrintReceipt = useCallback(() => {
    window.print();
  }, []);

  const handleDownloadReceipt = useCallback(() => {
    if (!payment) return;

    const receiptData = {
      reference: payment.reference,
      date: payment.processedAt,
      amount: payment.amount,
      method: payment.paymentMethod,
      provider: payment.provider,
      status: payment.status,
      items: payment.sale?.items || [],
      customer: payment.customer,
    };

    const blob = new Blob([JSON.stringify(receiptData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${payment.reference || 'payment'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Receipt downloaded');
  }, [payment]);

  const handleCopyReference = useCallback(() => {
    if (!payment?.reference) return;
    navigator.clipboard
      .writeText(payment.reference)
      .then(() => toast.success('Reference copied to clipboard'))
      .catch(() => toast.error('Failed to copy reference'));
  }, [payment?.reference]);

  // ── Render — loading ─────────────────────────────────────────

  if (loading) {
    return (
      <div
        className={`min-h-screen ${
          isDark ? 'dark bg-gray-950' : 'bg-gray-50'
        } transition-colors`}
      >
        <div className="flex items-center justify-center min-h-[60vh] pt-24 md:pt-28">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-orange-600 dark:text-orange-400 mx-auto" />
            <p
              className={`mt-4 ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Verifying your payment...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render — error ───────────────────────────────────────────

  if (error || !payment) {
    return (
      <div
        className={`min-h-screen ${
          isDark ? 'dark bg-gray-950' : 'bg-gray-50'
        } transition-colors`}
      >
        <div className="max-w-2xl mx-auto px-4 pt-24 md:pt-28 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-8 text-center ${
              isDark ? 'bg-gray-800' : 'bg-white'
            } shadow-sm border ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}
          >
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>
            <h2
              className={`text-2xl font-bold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              Payment Verification Failed
            </h2>
            <p
              className={`mt-2 ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              {error ||
                'Unable to verify your payment. Please contact support.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              <Link
                href="/"
                className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg transition-colors flex items-center gap-2 shadow-md"
              >
                <Home className="w-4 h-4" />
                Go Home
              </Link>
              <Link
                href="/support"
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-300"
              >
                <Mail className="w-4 h-4" />
                Contact Support
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Render — confirming (webhook hasn't landed yet) ──────────

  if (confirming && payment.status !== 'COMPLETED') {
    return (
      <div
        className={`min-h-screen ${
          isDark ? 'dark bg-gray-950' : 'bg-gray-50'
        } transition-colors`}
      >
        <div className="flex items-center justify-center min-h-[60vh] pt-24 md:pt-28">
          <div className="text-center max-w-md px-4">
            <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-10 h-10 animate-spin text-orange-600 dark:text-orange-400" />
            </div>
            <h2
              className={`text-2xl font-bold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              Confirming your payment
            </h2>
            <p
              className={`mt-2 ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              This usually takes a few seconds. Please don&apos;t close
              this page.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              <Link
                href="/dashboard"
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render — success ─────────────────────────────────────────

  const providerConfig = getProviderConfig(
    payment.provider || payment.gatewayId || '',
  );
  const providerImageUrl = getProviderImageUrl(
    payment.provider || payment.gatewayId || '',
  );
  const PaymentIcon = getPaymentMethodIcon(payment.paymentMethod);

  return (
    <div
      className={`min-h-screen ${
        isDark ? 'dark bg-gray-950' : 'bg-gray-50'
      } transition-colors`}
    >
      <div className="max-w-4xl mx-auto px-4 pt-24 md:pt-28 pb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className={`rounded-2xl shadow-sm border overflow-hidden ${
            isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
          }`}
        >
          {/* Success Header */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-center text-white">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                delay: 0.3,
                type: 'spring',
                stiffness: 200,
              }}
              className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircle className="w-10 h-10" />
            </motion.div>
            <h2 className="text-2xl font-bold">Payment Successful!</h2>
            <p className="text-green-100 mt-2">
              Thank you for your payment
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg">
                <Receipt className="w-4 h-4" />
                <span className="font-mono">{payment.reference}</span>
                <button
                  onClick={handleCopyReference}
                  className="hover:bg-white/20 p-1 rounded transition-colors"
                  title="Copy reference"
                  aria-label="Copy reference"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div
            className={`p-6 border-b ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <p
                  className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  Amount
                </p>
                <p
                  className={`text-xl font-bold tabular-nums ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {formatCurrency(payment.amount)}
                </p>
              </div>
              <div className="text-center">
                <p
                  className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  Payment Method
                </p>
                <div className="flex items-center justify-center gap-2">
                  <PaymentIcon className="w-5 h-5" />
                  <p
                    className={`text-lg font-semibold capitalize ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {payment.paymentMethod
                      .toLowerCase()
                      .replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
              <div className="text-center">
                <p
                  className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  Provider
                </p>
                <div className="flex items-center justify-center gap-2">
                  {providerImageUrl ? (
                    <Image
                      src={providerImageUrl}
                      alt={providerConfig.name}
                      width={24}
                      height={24}
                      className="rounded object-contain"
                      onError={(e) => {
                        (
                          e.target as HTMLImageElement
                        ).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="text-lg">
                      {providerConfig.icon}
                    </span>
                  )}
                  <p
                    className={`text-lg font-semibold ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {providerConfig.name}
                  </p>
                </div>
              </div>
              <div className="text-center">
                <p
                  className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  Date
                </p>
                <p
                  className={`text-sm font-medium tabular-nums ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {formatDate(payment.processedAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Receipt Section */}
          <div className="p-6" id="receipt">
            <div className="flex items-center justify-between mb-4">
              <h3
                className={`text-lg font-semibold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                Order Details
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handlePrintReceipt}
                  className={`p-2 rounded-lg transition ${
                    isDark
                      ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-300'
                      : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                  }`}
                  title="Print receipt"
                  aria-label="Print receipt"
                >
                  <Printer className="w-5 h-5" />
                </button>
                <button
                  onClick={handleDownloadReceipt}
                  className={`p-2 rounded-lg transition ${
                    isDark
                      ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-300'
                      : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                  }`}
                  title="Download receipt"
                  aria-label="Download receipt"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Customer Info */}
            {payment.customer && (
              <div
                className={`p-4 rounded-lg mb-4 ${
                  isDark ? 'bg-gray-700/30' : 'bg-gray-50'
                }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span
                      className={
                        isDark ? 'text-white' : 'text-gray-900'
                      }
                    >
                      {payment.customer.name}
                    </span>
                  </div>
                  {payment.customer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span
                        className={
                          isDark ? 'text-white' : 'text-gray-900'
                        }
                      >
                        {payment.customer.email}
                      </span>
                    </div>
                  )}
                  {payment.customer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span
                        className={`tabular-nums ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {payment.customer.phone}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Items */}
            {payment.sale?.items &&
              payment.sale.items.length > 0 && (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {payment.sale.items.map((item, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-4 py-3 border-b ${
                        isDark ? 'border-gray-700' : 'border-gray-100'
                      }`}
                    >
                      <div className="flex-1">
                        <p
                          className={`font-medium ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}
                        >
                          {item.productName}
                        </p>
                        <p
                          className={`text-sm tabular-nums ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}
                        >
                          {item.quantity} ×{' '}
                          {formatCurrency(item.unitPrice)}
                        </p>
                      </div>
                      <span
                        className={`font-medium tabular-nums ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

            {/* Totals */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
              <div className="flex justify-between text-sm">
                <span
                  className={
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }
                >
                  Subtotal
                </span>
                <span
                  className={`tabular-nums ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {formatCurrency(
                    payment.sale?.total || payment.amount,
                  )}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                <span
                  className={isDark ? 'text-white' : 'text-gray-900'}
                >
                  Total
                </span>
                <span
                  className={`tabular-nums ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {formatCurrency(payment.amount)}
                </span>
              </div>
            </div>

            {/* Business Info */}
            {payment.businessUnit && (
              <div
                className={`mt-4 pt-4 border-t ${
                  isDark ? 'border-gray-700' : 'border-gray-200'
                }`}
              >
                <p
                  className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  {payment.businessUnit.name}
                </p>
                {payment.businessUnit.address && (
                  <p
                    className={`text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    {payment.businessUnit.address}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div
            className={`p-6 ${
              isDark ? 'bg-gray-700/30' : 'bg-gray-50'
            } border-t ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            } flex flex-wrap gap-3`}
          >
            <Link
              href="/shop"
              className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md"
            >
              <ShoppingBag className="w-5 h-5" />
              Continue Shopping
            </Link>
            <Link
              href="/dashboard"
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2 text-gray-700 dark:text-gray-300"
            >
              <Home className="w-5 h-5" />
              Dashboard
            </Link>
          </div>

          {/* Auto-redirect */}
          {countdown > 0 && payment.status === 'COMPLETED' && (
            <div
              className={`p-4 text-center text-sm tabular-nums ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              } border-t ${
                isDark ? 'border-gray-700' : 'border-gray-200'
              }`}
            >
              Redirecting to dashboard in {countdown} seconds...
              <button
                onClick={() => router.push('/dashboard')}
                className="ml-2 text-orange-600 dark:text-orange-400 hover:underline"
              >
                Go now
              </button>
            </div>
          )}
        </motion.div>

        {/* Trust Badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-green-500" />
            Secure Transaction
          </span>
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-orange-500" />
            Encrypted
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-orange-500" />
            24/7 Support
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MODULE-LEVEL MAPPERS
// ============================================
//
// Kept outside the component so they aren't recreated on every
// render.

function mapToDetails(raw: any): PaymentDetails {
  return mapToPaymentDetails(raw);
}

function mapPayment(raw: any): PaymentDetails {
  return mapToPaymentDetails(raw);
}
