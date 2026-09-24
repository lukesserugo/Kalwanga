// D:\Projects\Kalwanga\packages\web\components\payment\PaymentReceipt.tsx

'use client';

import { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  Receipt,
  Printer,
  Download,
  Copy,
  CheckCircle,
  CreditCard,
  User,
  Mail,
  Phone,
  FileText,
  X,
  Globe,
  Smartphone,
  Banknote,
  Wallet,
  Gift,
  Star,
  Landmark,
} from 'lucide-react';
import { useThemeStore } from '../../app/stores/themeStore';
import {
  formatCurrency,
  formatDateTime,
} from '../../utils/formatters';
import { toast } from '../../utils/toast-manager';

// ============================================
// TYPES
// ============================================

export interface ReceiptItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sku?: string;
  variantName?: string;
}

export interface PaymentReceiptData {
  id: string;
  reference: string;
  amount: number;
  paymentMethod: string;
  status: string;
  processedAt: string;
  currency?: string;
  /** Legacy flat provider field. Prefer `metadata.provider`. */
  provider?: string;
  gatewayId?: string;
  metadata?: Record<string, unknown>;
  sale?: {
    receiptNumber: string;
    items?: ReceiptItem[];
    subtotal?: number;
    tax?: number;
    discount?: number;
    changeAmount?: number;
  };
  customer?: {
    name: string;
    email: string;
    phone: string;
  };
  businessUnit?: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
}

interface PaymentReceiptProps {
  payment: PaymentReceiptData;
  onClose?: () => void;
  className?: string;
}

// ============================================
// PROVIDER CONSTANTS
// ============================================

/**
 * Every provider code the backend can write to `metadata.provider`
 * or to the legacy top-level `provider` field. Used to decide
 * whether `gatewayId` is safe to consult — in practice it's a
 * PaymentGateway row FK, not a provider code.
 */
const KNOWN_PROVIDER_CODES = new Set<string>([
  'STRIPE',
  'PAYPAL',
  'FLUTTERWAVE',
  'PAYSTACK',
  'SQUARE',
  'MPESA',
  'MTN',
  'AIRTEL',
  'TIGO',
  'VODAFONE',
  'CASH',
  'BANK_TRANSFER',
  'GIFT_CARD',
  'LOYALTY_POINTS',
  'MOBILE_MONEY',
  'CHECK',
]);

const PROVIDER_IMAGE_URLS: Record<string, string> = {
  STRIPE: 'https://stripe.com/img/v3/home/social.png',
  PAYPAL:
    'https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg',
  FLUTTERWAVE: 'https://flutterwave.com/images/logo/flyer.png',
  PAYSTACK: 'https://paystack.com/assets/images/logo.png',
  SQUARE: 'https://squareup.com/icons/square_logo.svg',
  MPESA: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
  MTN: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
  AIRTEL: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
  TIGO: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
  VODAFONE: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
  CASH: 'https://cdn-icons-png.flaticon.com/512/2331/2331970.png',
  MOBILE_MONEY:
    'https://cdn-icons-png.flaticon.com/512/545/545245.png',
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
  MPESA: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
  MTN: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
  AIRTEL: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
  TIGO: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
  VODAFONE: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
  CASH: 'https://cdn-icons-png.flaticon.com/512/2331/2331970.png',
  MOBILE_MONEY:
    'https://cdn-icons-png.flaticon.com/512/545/545245.png',
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
  BANK_TRANSFER: Landmark,
  GIFT_CARD: Gift,
  LOYALTY_POINTS: Star,
  CHECK: FileText,
  PAYPAL: Globe,
  FLUTTERWAVE: Globe,
  PAYSTACK: CreditCard,
  SQUARE: CreditCard,
  MPESA: Smartphone,
  MTN: Smartphone,
  AIRTEL: Smartphone,
  TIGO: Smartphone,
  VODAFONE: Smartphone,
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card',
  MOBILE_MONEY: 'Mobile Money',
  BANK_TRANSFER: 'Bank Transfer',
  GIFT_CARD: 'Gift Card',
  LOYALTY_POINTS: 'Loyalty Points',
  CHECK: 'Check',
  PAYPAL: 'PayPal',
  FLUTTERWAVE: 'Flutterwave',
  PAYSTACK: 'Paystack',
  SQUARE: 'Square',
  MPESA: 'M-Pesa',
  MTN: 'MTN Mobile Money',
  AIRTEL: 'Airtel Money',
  TIGO: 'Tigo Pesa',
  VODAFONE: 'Vodafone Cash',
};

const PROVIDER_NAMES: Record<string, string> = {
  STRIPE: 'Stripe',
  CASH: 'Cash',
  MOBILE_MONEY: 'Mobile Money',
  BANK_TRANSFER: 'Bank Transfer',
  GIFT_CARD: 'Gift Card',
  LOYALTY_POINTS: 'Loyalty Points',
  PAYPAL: 'PayPal',
  FLUTTERWAVE: 'Flutterwave',
  PAYSTACK: 'Paystack',
  SQUARE: 'Square',
  MPESA: 'M-Pesa',
  MTN: 'MTN Mobile Money',
  AIRTEL: 'Airtel Money',
  TIGO: 'Tigo Pesa',
  VODAFONE: 'Vodafone Cash',
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  PAID: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
  PENDING:
    'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
  FAILED:
    'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
  REFUNDED:
    'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
  PARTIAL:
    'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  PROCESSING:
    'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300',
  AUTHORIZED:
    'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  DECLINED:
    'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
  DISPUTED:
    'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
  CANCELLED:
    'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
};

// ============================================
// HELPERS
// ============================================

/**
 * Resolve the provider name from the receipt. Priority:
 *   1. Top-level `provider` — if it's a known code.
 *   2. `metadata.provider` — the canonical location.
 *   3. `gatewayId` — ONLY if it's a known code.
 */
function resolveProvider(
  payment: PaymentReceiptData,
): string | undefined {
  const meta = payment.metadata ?? {};
  const metaProvider =
    typeof meta.provider === 'string' ? meta.provider : undefined;

  if (payment.provider && KNOWN_PROVIDER_CODES.has(payment.provider)) {
    return payment.provider;
  }
  if (metaProvider && KNOWN_PROVIDER_CODES.has(metaProvider)) {
    return metaProvider;
  }
  if (payment.gatewayId && KNOWN_PROVIDER_CODES.has(payment.gatewayId)) {
    return payment.gatewayId;
  }
  return metaProvider || payment.provider || undefined;
}

/**
 * Pull a provider-side transaction id out of the metadata. The
 * backend writes different keys depending on which gateway handled
 * the payment:
 *
 *   M-Pesa      → metadata.checkoutRequestId
 *   MTN / Airtel → metadata.mobileMoneyResult.transactionId
 *   Stripe      → metadata.gatewayResponse.id
 *   PayPal      → metadata.gatewayResponse.id
 *   Flutterwave → metadata.gatewayResponse.txRef
 *   Paystack    → metadata.gatewayResponse.reference
 *   Square      → metadata.gatewayResponse.payment.id
 */
function resolveProviderReference(
  payment: PaymentReceiptData,
): string | undefined {
  const meta = payment.metadata ?? {};

  const direct =
    (typeof meta.checkoutRequestId === 'string'
      ? meta.checkoutRequestId
      : undefined) ||
    (typeof meta.transactionId === 'string'
      ? meta.transactionId
      : undefined);

  if (direct) return direct;

  const moneyResult = meta.mobileMoneyResult as
    | { transactionId?: unknown }
    | undefined;
  if (
    moneyResult &&
    typeof moneyResult.transactionId === 'string'
  ) {
    return moneyResult.transactionId;
  }

  const gateway = meta.gatewayResponse as
    | Record<string, unknown>
    | undefined;
  if (gateway) {
    for (const key of [
      'id',
      'reference',
      'txRef',
      'transactionId',
    ]) {
      const value = gateway[key];
      if (typeof value === 'string') return value;
    }
  }

  return undefined;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function PaymentReceipt({
  payment,
  onClose,
  className = '',
}: PaymentReceiptProps) {
  const { isDark } = useThemeStore();
  const [copied, setCopied] = useState(false);

  // ── Derived ──────────────────────────────────────────────────

  const providerCode = useMemo(() => resolveProvider(payment), [payment]);
  const providerReference = useMemo(
    () => resolveProviderReference(payment),
    [payment],
  );

  const providerImageUrl = useMemo(() => {
    if (!providerCode) return '';
    return isDark && PROVIDER_DARK_IMAGE_URLS[providerCode]
      ? PROVIDER_DARK_IMAGE_URLS[providerCode]
      : PROVIDER_IMAGE_URLS[providerCode] || '';
  }, [providerCode, isDark]);

  const providerName = useMemo(
    () => (providerCode ? PROVIDER_NAMES[providerCode] || providerCode : ''),
    [providerCode],
  );

  /**
   * The method label. When the method is MOBILE_MONEY and we
   * resolved a specific provider (M-Pesa / MTN / Airtel), show the
   * provider name instead of the generic "Mobile Money" so the
   * "Payment Method" and "Provider" rows don't duplicate.
   */
  const methodLabel = useMemo(() => {
    if (
      payment.paymentMethod === 'MOBILE_MONEY' &&
      providerCode &&
      providerCode !== 'MOBILE_MONEY'
    ) {
      return PROVIDER_NAMES[providerCode] || 'Mobile Money';
    }
    return (
      PAYMENT_METHOD_LABELS[payment.paymentMethod] ||
      payment.paymentMethod
    );
  }, [payment.paymentMethod, providerCode]);

  const PaymentMethodIcon = useMemo(
    () => PAYMENT_METHOD_ICONS[payment.paymentMethod] || CreditCard,
    [payment.paymentMethod],
  );

  const statusBadgeClass = useMemo(
    () =>
      STATUS_BADGE_CLASSES[payment.status] ||
      'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
    [payment.status],
  );

  const hasItems =
    !!payment.sale?.items && payment.sale.items.length > 0;

  const receiptLabel = payment.reference || payment.id;

  // ── Handlers ─────────────────────────────────────────────────

  const handleCopy = useCallback(() => {
    const lines = [
      `Receipt #${receiptLabel}`,
      `Amount: ${formatCurrency(payment.amount)}`,
      `Payment Method: ${methodLabel}`,
      providerName ? `Provider: ${providerName}` : null,
      providerReference ? `Provider Ref: ${providerReference}` : null,
      `Date: ${formatDateTime(payment.processedAt)}`,
      `Status: ${payment.status}`,
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    toast.success('Receipt copied to clipboard');
    setTimeout(() => setCopied(false), 3000);
  }, [
    payment,
    receiptLabel,
    methodLabel,
    providerName,
    providerReference,
  ]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleDownload = useCallback(() => {
    const receiptData = {
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      paymentMethod: payment.paymentMethod,
      provider: providerCode,
      providerReference: providerReference || null,
      status: payment.status,
      date: payment.processedAt,
      items: payment.sale?.items || [],
      customer: payment.customer,
      businessUnit: payment.businessUnit,
      metadata: payment.metadata,
    };

    const blob = new Blob([JSON.stringify(receiptData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${receiptLabel}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Receipt downloaded');
  }, [payment, providerCode, providerReference, receiptLabel]);

  // ── Render ───────────────────────────────────────────────────

  return (
    <div
      className={className}
      id="receipt"
      role="region"
      aria-label={`Payment receipt ${receiptLabel}`}
      data-print-root="receipt"
    >
      <div
        className={`p-6 rounded-2xl card-brand shadow-soft animate-fade-in ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Receipt className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            <div>
              <h3
                className={`text-lg font-bold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                Payment Receipt
              </h3>
              <p
                className={`text-sm tabular-nums ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                #{receiptLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`p-2 rounded-lg transition duration-250 focus-ring ${
                isDark
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
              title="Copy receipt"
              aria-label="Copy receipt"
            >
              {copied ? (
                <CheckCircle className="w-4 h-4 text-success-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={handlePrint}
              className={`p-2 rounded-lg transition duration-250 focus-ring ${
                isDark
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
              title="Print receipt"
              aria-label="Print receipt"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownload}
              className={`p-2 rounded-lg transition duration-250 focus-ring ${
                isDark
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
              title="Download receipt"
              aria-label="Download receipt"
            >
              <Download className="w-4 h-4" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition duration-250 focus-ring ${
                  isDark
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                }`}
                title="Close"
                aria-label="Close receipt"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Status & Amount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div
            className={`p-4 rounded-xl ${
              isDark ? 'bg-gray-700/30' : 'bg-gray-50'
            }`}
          >
            <p
              className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              Amount
            </p>
            <p
              className={`text-2xl font-bold tabular-nums ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              {formatCurrency(payment.amount)}
            </p>
          </div>
          <div
            className={`p-4 rounded-xl ${
              isDark ? 'bg-gray-700/30' : 'bg-gray-50'
            }`}
          >
            <p
              className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              Status
            </p>
            <span
              className={`px-3 py-1 text-2xs font-medium rounded-full inline-flex items-center gap-1 ${statusBadgeClass}`}
            >
              {payment.status}
            </span>
          </div>
        </div>

        {/* Payment Method & Provider */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <p
              className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              Payment Method
            </p>
            <div className="flex items-center gap-2 mt-1">
              <PaymentMethodIcon
                className={`w-5 h-5 ${
                  isDark ? 'text-gray-300' : 'text-gray-600'
                }`}
              />
              <span
                className={`font-medium ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                {methodLabel}
              </span>
            </div>
          </div>
          <div>
            <p
              className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              Provider
            </p>
            <div className="flex items-center gap-2 mt-1">
              {providerImageUrl ? (
                <div className="relative w-6 h-6">
                  <Image
                    src={providerImageUrl}
                    alt={providerName}
                    width={24}
                    height={24}
                    className="rounded object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : null}
              <span
                className={`font-medium ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                {providerName || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Date & Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <p
              className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              Date Processed
            </p>
            <p
              className={`font-medium tabular-nums ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              {formatDateTime(payment.processedAt)}
            </p>
          </div>
          <div>
            <p
              className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              Reference
            </p>
            <p
              className={`font-mono font-medium tabular-nums ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              {receiptLabel}
            </p>
          </div>
        </div>

        {/* Provider reference — M-Pesa CheckoutRequestID, MTN
            transactionId, Stripe pi_xxx, etc. Only shown when the
            backend actually captured one. */}
        {providerReference && (
          <div className="mb-6">
            <p
              className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              Provider Reference
            </p>
            <p
              className={`font-mono text-sm tabular-nums break-all ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              {providerReference}
            </p>
          </div>
        )}

        {/* Customer Info */}
        {payment.customer && (
          <div
            className={`p-4 rounded-xl mb-6 ${
              isDark ? 'bg-gray-700/30' : 'bg-gray-50'
            }`}
          >
            <p
              className={`text-sm font-medium mb-2 eyebrow ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Customer Information
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <span className={isDark ? 'text-white' : 'text-gray-900'}>
                  {payment.customer.name || 'Guest'}
                </span>
              </div>
              {payment.customer.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>
                    {payment.customer.email}
                  </span>
                </div>
              )}
              {payment.customer.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500" />
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
        {hasItems && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p
                className={`text-sm font-medium eyebrow ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                Items
              </p>
              <span
                className={`text-sm tabular-nums ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                Sale: {payment.sale?.receiptNumber}
              </span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
              {payment.sale?.items?.map((item, index) => (
                <div
                  key={`${item.productName}-${index}`}
                  className={`flex items-center justify-between py-2 border-b ${
                    isDark ? 'border-gray-700' : 'border-gray-100'
                  }`}
                >
                  <div>
                    <p
                      className={`font-medium ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {item.productName}
                    </p>
                    {(item.sku || item.variantName) && (
                      <p
                        className={`text-2xs font-mono ${
                          isDark ? 'text-gray-500' : 'text-gray-400'
                        }`}
                      >
                        {item.variantName || item.sku}
                      </p>
                    )}
                    <p
                      className={`text-sm tabular-nums ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}
                    >
                      {item.quantity} × {formatCurrency(item.unitPrice)}
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
          </div>
        )}

        {/* Summary */}
        {hasItems && (
          <div
            className={`p-4 rounded-xl mb-6 ${
              isDark ? 'bg-gray-700/30' : 'bg-gray-50'
            }`}
          >
            <div className="flex justify-between text-sm">
              <span
                className={isDark ? 'text-gray-400' : 'text-gray-500'}
              >
                Subtotal
              </span>
              <span
                className={`tabular-nums ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                {formatCurrency(
                  payment.sale?.subtotal ?? payment.amount,
                )}
              </span>
            </div>
            {typeof payment.sale?.tax === 'number' &&
              payment.sale.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span
                    className={isDark ? 'text-gray-400' : 'text-gray-500'}
                  >
                    Tax
                  </span>
                  <span
                    className={`tabular-nums ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {formatCurrency(payment.sale.tax)}
                  </span>
                </div>
              )}
            {typeof payment.sale?.discount === 'number' &&
              payment.sale.discount > 0 && (
                <div className="flex justify-between text-sm text-success-600 dark:text-success-400">
                  <span>Discount</span>
                  <span className="tabular-nums">
                    -{formatCurrency(payment.sale.discount)}
                  </span>
                </div>
              )}
            <div className="flex justify-between font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className={isDark ? 'text-white' : 'text-gray-900'}>
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
            {typeof payment.sale?.changeAmount === 'number' &&
              payment.sale.changeAmount > 0 && (
                <div className="flex justify-between text-sm text-warning-600 dark:text-warning-400 pt-1">
                  <span>Change</span>
                  <span className="tabular-nums">
                    {formatCurrency(payment.sale.changeAmount)}
                  </span>
                </div>
              )}
          </div>
        )}

        {/* Business Info */}
        {payment.businessUnit && (
          <div
            className={`pt-4 border-t ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}
          >
            <p
              className={`text-sm font-medium ${
                isDark ? 'text-white' : 'text-gray-900'
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
            {payment.businessUnit.phone && (
              <p
                className={`text-sm tabular-nums ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                {payment.businessUnit.phone}
              </p>
            )}
            {payment.businessUnit.email && (
              <p
                className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                {payment.businessUnit.email}
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div
          className={`mt-4 pt-4 border-t ${
            isDark ? 'border-gray-700' : 'border-gray-200'
          } text-center`}
        >
          <p
            className={`text-2xs ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            Thank you for your business!
          </p>
          <p
            className={`text-2xs tabular-nums ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            } mt-1`}
          >
            Receipt generated on {formatDateTime(new Date())}
          </p>
          {providerCode && (
            <p
              className={`text-2xs ${
                isDark ? 'text-gray-500' : 'text-gray-400'
              } mt-1`}
            >
              Payment processed via {providerName}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default PaymentReceipt;
