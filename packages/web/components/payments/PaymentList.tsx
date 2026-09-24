// D:\Projects\Kalwanga\packages\web\components\payments\PaymentHistory.tsx

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  CreditCard,
  Clock,
  Copy,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  RefreshCw,
  FileText,
  ArrowDownRight,
  Receipt,
  Star,
  Banknote,
  Wallet,
  Gift,
  Smartphone,
  Landmark,
  Globe,
} from 'lucide-react';
import { useThemeStore } from '../../app/stores/themeStore';
import { paymentService } from '../../services/paymentService';
import type {
  Payment as ApiPayment,
  PaymentMetadata,
} from '../../types/payment';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { toast } from '../../utils/toast-manager';
import { PaymentReceipt } from './PaymentReceipt';

// ============================================
// TYPES
// ============================================

interface PaymentHistoryProps {
  userId?: string;
  limit?: number;
  showFilters?: boolean;
  className?: string;
  onPaymentSelect?: (payment: Payment) => void;
}

interface Payment {
  id: string;
  amount: number;
  currency?: string;
  paymentMethod: string;
  status: string;
  reference?: string;
  transactionId?: string;
  processedAt: string;
  provider?: string;
  gatewayId?: string;
  refundedAmount?: number;
  notes?: string;
  metadata?: PaymentMetadata;
  sale?: {
    receiptNumber: string;
    total: number;
    items?: any[];
  };
  order?: {
    orderNumber: string;
    total: number;
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

// ============================================
// PROVIDER CONSTANTS
// ============================================

const KNOWN_PROVIDER_CODES = new Set<string>([
  'STRIPE',
  'PAYPAL',
  'FLUTTERWAVE',
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

/**
 * Values that make sense as a *provider* filter. Deliberately a
 * narrower set than `KNOWN_PROVIDER_CODES` — filtering by
 * `MOBILE_MONEY` or `CHECK` is a method-level concern, not a
 * provider-level one, and the backend's `provider` query param
 * is meant for gateway selection.
 */
const PROVIDER_FILTER_OPTIONS: string[] = [
  'STRIPE',
  'PAYPAL',
  'FLUTTERWAVE',
  'SQUARE',
  'MPESA',
  'MTN',
  'AIRTEL',
  'TIGO',
  'VODAFONE',
];

const PROVIDER_IMAGE_URLS: Record<string, string> = {
  STRIPE: 'https://stripe.com/img/v3/home/social.png',
  PAYPAL:
    'https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg',
  FLUTTERWAVE: 'https://flutterwave.com/images/logo/flyer.png',
  SQUARE: 'https://squareup.com/icons/square_logo.svg',
  MPESA: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
  MTN: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
  AIRTEL: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
  TIGO: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
  VODAFONE: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
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
  SQUARE: 'https://squareup.com/icons/square_logo.svg',
  MPESA: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
  MTN: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
  AIRTEL: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
  TIGO: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
  VODAFONE: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
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
  BANK_TRANSFER: Landmark,
  GIFT_CARD: Gift,
  LOYALTY_POINTS: Star,
  CHECK: FileText,
  PAYPAL: Globe,
  FLUTTERWAVE: Globe,
  SQUARE: CreditCard,
  MPESA: Smartphone,
  MTN: Smartphone,
  AIRTEL: Smartphone,
  TIGO: Smartphone,
  VODAFONE: Smartphone,
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

export const PAYMENT_STATUS_COLORS = STATUS_BADGE_CLASSES;

// ============================================
// HELPERS
// ============================================

function resolveProvider(payment: ApiPayment): string | undefined {
  const meta = (payment.metadata ?? {}) as PaymentMetadata;
  const metaProvider =
    typeof meta.provider === 'string' ? meta.provider : undefined;
  const legacy = (payment as any).provider as string | undefined;
  const gateway = payment.gatewayId;

  if (legacy && KNOWN_PROVIDER_CODES.has(legacy)) return legacy;
  if (metaProvider && KNOWN_PROVIDER_CODES.has(metaProvider)) {
    return metaProvider;
  }
  if (gateway && KNOWN_PROVIDER_CODES.has(gateway)) return gateway;

  return metaProvider || legacy || undefined;
}

function resolveMobileProvider(payment: ApiPayment): string | undefined {
  const meta = (payment.metadata ?? {}) as PaymentMetadata;
  const candidate =
    (typeof meta.provider === 'string' ? meta.provider : undefined) ||
    ((payment as any).provider as string | undefined);

  if (!candidate) return undefined;
  if (
    candidate === 'MPESA' ||
    candidate === 'MTN' ||
    candidate === 'AIRTEL' ||
    candidate === 'TIGO' ||
    candidate === 'VODAFONE'
  ) {
    return candidate;
  }
  return undefined;
}

function resolveCustomer(payment: ApiPayment): Payment['customer'] {
  const joined = (payment as any).customer;
  if (joined) {
    const name =
      joined.name ||
      `${joined.firstName ?? ''} ${joined.lastName ?? ''}`.trim() ||
      'Customer';
    return {
      name,
      email: joined.email || '',
      phone: joined.phone || joined.phoneNumber || '',
    };
  }

  const meta = (payment.metadata ?? {}) as PaymentMetadata;
  const metaName =
    typeof meta.customerName === 'string' ? meta.customerName : undefined;
  const metaEmail =
    typeof meta.customerEmail === 'string' ? meta.customerEmail : undefined;
  const metaPhone =
    typeof meta.phoneNumber === 'string' ? meta.phoneNumber : undefined;

  if (metaName || metaEmail || metaPhone) {
    return {
      name: metaName || 'Customer',
      email: metaEmail || '',
      phone: metaPhone || '',
    };
  }

  return undefined;
}

function toViewPayment(payment: ApiPayment): Payment {
  const method = String(payment.paymentMethod);
  const resolvedProvider = resolveProvider(payment);

  const provider =
    method === 'MOBILE_MONEY'
      ? resolveMobileProvider(payment) || resolvedProvider
      : resolvedProvider;

  return {
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    paymentMethod: method,
    status: String(payment.status),
    reference: payment.reference,
    transactionId: payment.transactionId,
    processedAt: payment.processedAt,
    provider,
    gatewayId: payment.gatewayId,
    refundedAmount: (payment as any).refundedAmount,
    notes: payment.notes,
    metadata: payment.metadata,
    sale: payment.sale
      ? {
          receiptNumber: payment.sale.receiptNumber,
          total: payment.sale.total,
          items: (payment.sale as any).items,
        }
      : undefined,
    order: payment.order
      ? {
          orderNumber: payment.order.orderNumber,
          total: payment.order.total,
        }
      : undefined,
    customer: resolveCustomer(payment),
    businessUnit: payment.businessUnit
      ? {
          name: payment.businessUnit.name,
          address: (payment.businessUnit as any).address,
          phone: (payment.businessUnit as any).phone,
          email: (payment.businessUnit as any).email,
        }
      : undefined,
  };
}

// ============================================
// MAIN COMPONENT
// ============================================

export function PaymentHistory({
  userId,
  limit = 10,
  showFilters = true,
  className = '',
  onPaymentSelect,
}: PaymentHistoryProps) {
  const { isDark } = useThemeStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit,
  });
  const [filters, setFilters] = useState({
    status: 'all',
    paymentMethod: 'all',
    provider: 'all',
    startDate: '',
    endDate: '',
  });
  const [search, setSearch] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(
    null,
  );
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // ── Data loading ─────────────────────────────────────────────

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, unknown> = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (userId) params.userId = userId;
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.paymentMethod !== 'all')
        params.paymentMethod = filters.paymentMethod;
      if (filters.provider !== 'all') params.provider = filters.provider;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (search) params.search = search;

      const response = await paymentService.getPayments(params);

      const items: ApiPayment[] = Array.isArray(response.data)
        ? response.data
        : [];

      setPayments(items.map(toViewPayment));

      const paginationData =
        (response as any).pagination ??
        ({
          total: response.total,
          page: response.page,
          totalPages: response.totalPages,
          limit: response.limit,
        } as const);

      setPagination({
        page: paginationData.page || 1,
        total: paginationData.total || 0,
        totalPages: paginationData.totalPages || 1,
        limit: paginationData.limit || limit,
      });
    } catch (error) {
      console.error('Failed to load payment history:', error);
      toast.error('Failed to load payment history');
    } finally {
      setLoading(false);
    }
  }, [
    userId,
    pagination.page,
    pagination.limit,
    filters.status,
    filters.paymentMethod,
    filters.provider,
    filters.startDate,
    filters.endDate,
    search,
    limit,
  ]);

  // Refetch on scalar changes only. The `filters` object identity
  // is deliberately excluded so keystrokes in `search` don't
  // trigger a fetch storm — the user submits with Enter.
  useEffect(() => {
    void loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    userId,
    pagination.page,
    pagination.limit,
    filters.status,
    filters.paymentMethod,
    filters.provider,
    filters.startDate,
    filters.endDate,
  ]);

  // ── Handlers ─────────────────────────────────────────────────

  const handleRefresh = useCallback(() => {
    void loadPayments();
    toast.success('Payments refreshed');
  }, [loadPayments]);

  const handleSearch = useCallback(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    void loadPayments();
  }, [loadPayments]);

  const handleCopyReference = useCallback((reference: string) => {
    navigator.clipboard.writeText(reference);
    toast.success('Reference copied');
  }, []);

  const handleViewReceipt = useCallback(
    (payment: Payment) => {
      setSelectedPayment(payment);
      setShowReceiptModal(true);
      onPaymentSelect?.(payment);
    },
    [onPaymentSelect],
  );

  /**
   * Clear every filter and refetch immediately. Previously this
   * only reset state; the effect loop wouldn't fire because
   * `filters` identity is excluded from the effect deps, so the
   * user saw stale results until they manually hit Refresh.
   */
  const handleClearFilters = useCallback(() => {
    setFilters({
      status: 'all',
      paymentMethod: 'all',
      provider: 'all',
      startDate: '',
      endDate: '',
    });
    setSearch('');
    setPagination((prev) => ({ ...prev, page: 1 }));
    void loadPayments();
  }, [loadPayments]);

  // ── Lookups ──────────────────────────────────────────────────

  const getProviderImageUrl = useCallback(
    (provider?: string): string => {
      if (!provider) return '';
      return isDark && PROVIDER_DARK_IMAGE_URLS[provider]
        ? PROVIDER_DARK_IMAGE_URLS[provider]
        : PROVIDER_IMAGE_URLS[provider] || '';
    },
    [isDark],
  );

  const getProviderName = useCallback((provider?: string): string => {
    if (!provider) return 'N/A';
    return PROVIDER_NAMES[provider] || provider;
  }, []);

  const getStatusColor = useCallback((status: string) => {
    return (
      STATUS_BADGE_CLASSES[status] ||
      'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300'
    );
  }, []);

  const getPaymentIcon = useCallback((method: string) => {
    const Icon = PAYMENT_METHOD_ICONS[method] || CreditCard;
    return <Icon className="w-4 h-4" />;
  }, []);

  /**
   * Human-readable label for the payment method. For MOBILE_MONEY
   * this returns the specific provider name (M-Pesa / MTN / Airtel)
   * when the backend stored one; otherwise the generic method name.
   */
  const paymentMethodLabel = useCallback((payment: Payment): string => {
    if (payment.provider && PROVIDER_NAMES[payment.provider]) {
      return PROVIDER_NAMES[payment.provider];
    }
    if (payment.paymentMethod === 'MOBILE_MONEY') {
      return 'Mobile Money';
    }
    return payment.paymentMethod.toLowerCase().replace(/_/g, ' ');
  }, []);

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'PAID':
        return <CheckCircle className="w-4 h-4" />;
      case 'PENDING':
        return <Clock className="w-4 h-4" />;
      case 'FAILED':
      case 'DECLINED':
        return <XCircle className="w-4 h-4" />;
      case 'REFUNDED':
        return <ArrowDownRight className="w-4 h-4" />;
      case 'DISPUTED':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  }, []);

  // ── Derived ──────────────────────────────────────────────────
  //
  // Provider dropdown is the curated `PROVIDER_FILTER_OPTIONS` set
  // plus any provider actually present on the current page.

  const providerOptions = useMemo(() => {
    const fromPage = payments
      .map((p) => p.provider)
      .filter((v): v is string => !!v);
    return Array.from(
      new Set([...PROVIDER_FILTER_OPTIONS, ...fromPage]),
    ).sort();
  }, [payments]);

  return (
    <div className={className}>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3
            className={`text-lg font-semibold ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            Payment History
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className={`p-2 rounded-lg transition duration-250 focus-ring ${
                isDark
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              } disabled:opacity-50`}
              aria-label="Refresh payments"
              aria-busy={loading}
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
            {showFilters && (
              <button
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className={`p-2 rounded-lg transition duration-250 focus-ring ${
                  showFilterPanel
                    ? 'bg-brand-gradient text-white shadow-brand'
                    : isDark
                      ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                      : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                }`}
                aria-label="Toggle filters"
                aria-expanded={showFilterPanel}
              >
                <Filter className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search by reference, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              aria-label="Search payments"
              className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm ${
                isDark
                  ? 'bg-gray-700 text-white placeholder-gray-400'
                  : 'bg-gray-100 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
            />
          </div>
          <button onClick={handleSearch} className="btn-brand">
            Search
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && showFilterPanel && (
          <div
            className={`p-4 rounded-2xl mb-4 animate-slide-down ${
              isDark ? 'bg-gray-700/30' : 'bg-gray-50'
            }`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      status: e.target.value,
                    }))
                  }
                  className={`w-full px-3 py-2 rounded-lg text-sm ${
                    isDark
                      ? 'bg-gray-600 text-white border-gray-500'
                      : 'bg-white text-gray-900 border-gray-300'
                  } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                >
                  <option value="all">All Status</option>
                  <option value="PAID">Paid</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                  <option value="REFUNDED">Refunded</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="AUTHORIZED">Authorized</option>
                  <option value="DECLINED">Declined</option>
                  <option value="DISPUTED">Disputed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Payment Method
                </label>
                <select
                  value={filters.paymentMethod}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      paymentMethod: e.target.value,
                    }))
                  }
                  className={`w-full px-3 py-2 rounded-lg text-sm ${
                    isDark
                      ? 'bg-gray-600 text-white border-gray-500'
                      : 'bg-white text-gray-900 border-gray-300'
                  } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                >
                  <option value="all">All Methods</option>
                  <option value="CASH">Cash</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="DEBIT_CARD">Debit Card</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="GIFT_CARD">Gift Card</option>
                  <option value="LOYALTY_POINTS">Loyalty Points</option>
                  <option value="CHECK">Check</option>
                  <option value="PAYPAL">PayPal</option>
                  <option value="FLUTTERWAVE">Flutterwave</option>
                  <option value="SQUARE">Square</option>
                </select>
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Provider
                </label>
                <select
                  value={filters.provider}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      provider: e.target.value,
                    }))
                  }
                  className={`w-full px-3 py-2 rounded-lg text-sm ${
                    isDark
                      ? 'bg-gray-600 text-white border-gray-500'
                      : 'bg-white text-gray-900 border-gray-300'
                  } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                >
                  <option value="all">All Providers</option>
                  {providerOptions.map((code) => (
                    <option key={code} value={code}>
                      {getProviderName(code)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Date Range
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                      isDark
                        ? 'bg-gray-600 text-white border-gray-500'
                        : 'bg-white text-gray-900 border-gray-300'
                    } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 tabular-nums`}
                  />
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                    className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                      isDark
                        ? 'bg-gray-600 text-white border-gray-500'
                        : 'bg-white text-gray-900 border-gray-300'
                    } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 tabular-nums`}
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={handleClearFilters}
                className="text-sm text-danger-600 dark:text-danger-400 hover:text-danger-800 dark:hover:text-danger-300 transition duration-250 focus-ring rounded"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Payments List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
          </div>
        ) : payments.length === 0 ? (
          <div
            className={`text-center py-8 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No payments found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => {
              const providerImageUrl = getProviderImageUrl(
                payment.provider,
              );
              const providerName = getProviderName(payment.provider);
              const methodLabel = paymentMethodLabel(payment);

              return (
                <div
                  key={payment.id}
                  className={`p-4 rounded-xl border transition duration-250 ${
                    isDark
                      ? 'border-gray-700 hover:bg-gray-700/30'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Provider Logo or Icon */}
                      <div
                        className={`p-2 rounded-lg ${getStatusColor(
                          payment.status,
                        )} flex items-center justify-center min-w-[40px]`}
                      >
                        {providerImageUrl ? (
                          <div className="relative w-6 h-6">
                            <Image
                              src={providerImageUrl}
                              alt={providerName}
                              width={24}
                              height={24}
                              className="rounded object-contain"
                              onError={(e) => {
                                (
                                  e.target as HTMLImageElement
                                ).style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          getPaymentIcon(payment.paymentMethod)
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p
                            className={`font-medium tabular-nums ${
                              isDark ? 'text-white' : 'text-gray-900'
                            }`}
                          >
                            {formatCurrency(payment.amount)}
                          </p>
                          <span
                            className={`px-2 py-0.5 text-2xs font-medium rounded-full flex items-center gap-1 ${getStatusColor(
                              payment.status,
                            )}`}
                          >
                            {getStatusIcon(payment.status)}
                            {payment.status}
                          </span>
                          {payment.provider && (
                            <span
                              className={`px-2 py-0.5 text-2xs font-medium rounded-full flex items-center gap-1 ${
                                isDark
                                  ? 'bg-gray-700 text-gray-300'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                              aria-label={`Provider: ${providerName}`}
                            >
                              {providerImageUrl && (
                                <span className="relative w-3 h-3">
                                  <Image
                                    src={providerImageUrl}
                                    alt=""
                                    width={12}
                                    height={12}
                                    className="rounded object-contain"
                                    onError={(e) => {
                                      (
                                        e.target as HTMLImageElement
                                      ).style.display = 'none';
                                    }}
                                  />
                                </span>
                              )}
                              {providerName}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-1 text-sm">
                          <span
                            className={`tabular-nums ${
                              isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}
                          >
                            {payment.reference ||
                              `PAY-${payment.id.slice(0, 8)}`}
                          </span>
                          <button
                            onClick={() =>
                              handleCopyReference(
                                payment.reference || payment.id,
                              )
                            }
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition duration-250 focus-ring"
                            title="Copy reference"
                            aria-label="Copy payment reference"
                          >
                            <Copy className="w-3 h-3 text-gray-400" />
                          </button>
                          <span className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
                          <span
                            className={
                              isDark ? 'text-gray-400' : 'text-gray-500'
                            }
                          >
                            {methodLabel}
                          </span>
                          <span className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
                          <span
                            className={`tabular-nums ${
                              isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}
                          >
                            {formatDateTime(payment.processedAt)}
                          </span>
                          {payment.sale?.receiptNumber && (
                            <>
                              <span className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
                              <span
                                className={`tabular-nums ${
                                  isDark
                                    ? 'text-gray-400'
                                    : 'text-gray-500'
                                }`}
                              >
                                Sale: {payment.sale.receiptNumber}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleViewReceipt(payment)}
                        className={`p-1.5 rounded-lg transition duration-250 focus-ring ${
                          isDark
                            ? 'hover:bg-gray-700'
                            : 'hover:bg-gray-100'
                        }`}
                        title="View receipt"
                        aria-label="View receipt"
                      >
                        <Receipt className="w-4 h-4 text-brand-500 dark:text-brand-400" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p
              className={`text-sm tabular-nums ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(
                pagination.page * pagination.limit,
                pagination.total,
              )}{' '}
              of {pagination.total}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    page: prev.page - 1,
                  }))
                }
                disabled={pagination.page === 1}
                className={`px-3 py-1 rounded-lg text-sm transition duration-250 disabled:opacity-50 focus-ring ${
                  isDark
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                } border`}
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    page: prev.page + 1,
                  }))
                }
                disabled={pagination.page === pagination.totalPages}
                className={`px-3 py-1 rounded-lg text-sm transition duration-250 disabled:opacity-50 focus-ring ${
                  isDark
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                } border`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      {showReceiptModal && selectedPayment && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto custom-scrollbar animate-fade-in">
          <div className="max-w-2xl w-full">
            <PaymentReceipt
              payment={{
                id: selectedPayment.id,
                reference:
                  selectedPayment.reference || selectedPayment.id,
                amount: selectedPayment.amount,
                paymentMethod: selectedPayment.paymentMethod,
                status: selectedPayment.status,
                processedAt: selectedPayment.processedAt,
                provider: selectedPayment.provider,
                metadata: selectedPayment.metadata,
                sale: selectedPayment.sale
                  ? {
                      receiptNumber:
                        selectedPayment.sale.receiptNumber,
                      items: selectedPayment.sale.items || [],
                    }
                  : undefined,
                customer: selectedPayment.customer
                  ? {
                      name: selectedPayment.customer.name,
                      email: selectedPayment.customer.email,
                      phone: selectedPayment.customer.phone || '',
                    }
                  : undefined,
                businessUnit: selectedPayment.businessUnit
                  ? {
                      name: selectedPayment.businessUnit.name,
                      address:
                        selectedPayment.businessUnit.address || '',
                      phone: selectedPayment.businessUnit.phone || '',
                      email: selectedPayment.businessUnit.email || '',
                    }
                  : undefined,
              }}
              onClose={() => setShowReceiptModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default PaymentHistory;
