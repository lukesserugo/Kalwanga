// packages/web/components/payments/PaymentList.tsx

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import {
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Receipt,
  Star,
  Banknote,
  Wallet,
  Gift,
  Smartphone,
  Landmark,
  Globe,
  ArrowDownRight,
  type LucideIcon,
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

interface PaymentListProps {
  userId?: string;
  limit?: number;
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
// CONSTANTS
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

const PROVIDER_IMAGE_URLS: Record<string, string> = {
  STRIPE: '/icons/payments/stripe.svg',
  PAYPAL: '/icons/payments/paypal.svg',
  FLUTTERWAVE: '/icons/payments/flutterwave.svg',
  SQUARE: '/icons/payments/square.svg',
  MPESA: '/icons/payments/mpesa.svg',
  MTN: '/icons/payments/mtn.svg',
  AIRTEL: '/icons/payments/airtel.svg',
  TIGO: '/icons/payments/tigo.svg',
  VODAFONE: '/icons/payments/vodafone.svg',
  CASH: '/icons/payments/cash.svg',
  MOBILE_MONEY: '/icons/payments/mobile-money.svg',
  BANK_TRANSFER: '/icons/payments/bank-transfer.svg',
  GIFT_CARD: '/icons/payments/gift-card.svg',
  LOYALTY_POINTS: '/icons/payments/loyalty-points.svg',
};

const PAYMENT_METHOD_ICONS: Record<string, LucideIcon> = {
  CASH: Banknote,
  CREDIT_CARD: CreditCard,
  DEBIT_CARD: Wallet,
  MOBILE_MONEY: Smartphone,
  BANK_TRANSFER: Landmark,
  GIFT_CARD: Gift,
  LOYALTY_POINTS: Star,
  CHECK: CreditCard,
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
  PENDING: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
  FAILED: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
  REFUNDED: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
  PARTIAL: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  PROCESSING: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300',
  AUTHORIZED: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  DECLINED: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
  DISPUTED: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
  CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
};

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
  if (metaProvider && KNOWN_PROVIDER_CODES.has(metaProvider)) return metaProvider;
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

  const refundedRaw = (payment as any).refundedAmount;
  const refundedAmount =
    typeof refundedRaw === 'number' ? refundedRaw : undefined;

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
    refundedAmount,
    notes: payment.notes,
    metadata: payment.metadata,
    sale: payment.sale
      ? {
          receiptNumber: payment.sale.receiptNumber,
          total: payment.sale.total,
          items: (payment.sale as any).items,
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
// COMPONENT
// ============================================

export function PaymentList({
  userId,
  limit = 20,
  className = '',
  onPaymentSelect,
}: PaymentListProps) {
  const { isDark } = useThemeStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit,
  });
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const latestRequestIdRef = useRef(0);

  const loadPayments = useCallback(async () => {
    const requestId = ++latestRequestIdRef.current;

    try {
      setLoading(true);
      const params: Record<string, unknown> = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (userId) params.userId = userId;

      const response = await paymentService.getPayments(params);

      if (requestId !== latestRequestIdRef.current) return;

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

      setPagination((prev) => {
        const nextPage = paginationData.page || 1;
        const nextTotal = paginationData.total || 0;
        const nextTotalPages = paginationData.totalPages || 1;
        const nextLimit = paginationData.limit || limit;

        if (
          prev.page === nextPage &&
          prev.total === nextTotal &&
          prev.totalPages === nextTotalPages &&
          prev.limit === nextLimit
        ) {
          return prev;
        }

        return {
          page: nextPage,
          total: nextTotal,
          totalPages: nextTotalPages,
          limit: nextLimit,
        };
      });
    } catch (error) {
      if (requestId !== latestRequestIdRef.current) return;
      console.error('Failed to load payments:', error);
      toast.error('Failed to load payments');
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [userId, pagination.page, pagination.limit, limit]);

  useEffect(() => {
    void loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, pagination.page, pagination.limit]);

  const handleRefresh = useCallback(() => {
    void loadPayments();
    toast.success('Payments refreshed');
  }, [loadPayments]);

  const handleViewReceipt = useCallback(
    (payment: Payment) => {
      setSelectedPayment(payment);
      setShowReceiptModal(true);
      onPaymentSelect?.(payment);
    },
    [onPaymentSelect],
  );

  const getProviderImageUrl = useCallback(
    (provider?: string): string => {
      if (!provider) return '';
      return PROVIDER_IMAGE_URLS[provider] || '';
    },
    [],
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

  const getPaymentIcon = useCallback(
    (method: string): JSX.Element => {
      const Icon = PAYMENT_METHOD_ICONS[method] || CreditCard;
      return <Icon className="w-4 h-4" />;
    },
    [],
  );

  const paymentMethodLabel = useCallback((payment: Payment): string => {
    if (payment.provider && PROVIDER_NAMES[payment.provider]) {
      return PROVIDER_NAMES[payment.provider];
    }
    if (payment.paymentMethod === 'MOBILE_MONEY') {
      return 'Mobile Money';
    }
    return payment.paymentMethod.toLowerCase().replace(/_/g, ' ');
  }, []);

  const getStatusIcon = useCallback(
    (status: string): JSX.Element => {
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
    },
    [],
  );

  const summary = useMemo(() => {
    const total = payments.reduce(
      (sum, p) =>
        p.status === 'PAID' ? sum + Math.max(0, p.amount) : sum,
      0,
    );
    return {
      count: payments.length,
      totalPaid: total,
    };
  }, [payments]);

  return (
    <div className={className}>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3
              className={`text-lg font-semibold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              Payments
            </h3>
            <p
              className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
            >
              {summary.count} payment{summary.count === 1 ? '' : 's'} on this page
            </p>
          </div>
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
        </div>

        {/* List */}
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
              const providerImageUrl = getProviderImageUrl(payment.provider);
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
                            {formatCurrency(
                              payment.amount,
                              payment.currency ?? '',
                            )}
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
                              className={`px-2 py-0.5 text-2xs font-medium rounded-full ${
                                isDark
                                  ? 'bg-gray-700 text-gray-300'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                              aria-label={`Provider: ${providerName}`}
                            >
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
                    page: Math.max(1, prev.page - 1),
                  }))
                }
                disabled={pagination.page === 1}
                aria-disabled={pagination.page === 1}
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
                    page: Math.min(prev.totalPages, prev.page + 1),
                  }))
                }
                disabled={pagination.page === pagination.totalPages}
                aria-disabled={pagination.page === pagination.totalPages}
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
              key={selectedPayment.id}
              payment={{
                id: selectedPayment.id,
                reference: selectedPayment.reference || selectedPayment.id,
                amount: selectedPayment.amount,
                currency: selectedPayment.currency,
                paymentMethod: selectedPayment.paymentMethod,
                status: selectedPayment.status,
                processedAt: selectedPayment.processedAt,
                provider: selectedPayment.provider,
                metadata: selectedPayment.metadata,
                sale: selectedPayment.sale
                  ? {
                      receiptNumber: selectedPayment.sale.receiptNumber,
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
                      address: selectedPayment.businessUnit.address || '',
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

export default PaymentList;
