// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\payments\refunds\page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Lock,
  ArrowDownRight,
  DollarSign,
  CreditCard,
  User,
  Calendar,
  Clock,
  Search,
  Filter,
  Eye,
  Copy,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Receipt,
  Banknote,
  Wallet,
  Building,
  QrCode,
  Gift,
  Star,
  Smartphone,
  Landmark,
  TrendingDown,
  TrendingUp,
  Globe,
  Shield,
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { paymentService } from '../../../../../services/paymentService';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from '../../../../../utils/formatters';
import { toast } from '../../../../../utils/toast-manager';
import { useThemeStore } from '../../../../stores/themeStore';
import { PaymentReceipt } from '../../../../../components/payments/PaymentReceipt';

// ============================================
// TYPES
// ============================================

interface Refund {
  id: string;
  paymentId: string;
  amount: number;
  reason?: string;
  status: string;
  refundedAt: string;
  refundedBy?: string;
  payment?: {
    id: string;
    reference: string;
    amount: number;
    paymentMethod: string;
    provider?: string;
    gatewayId?: string;
    status?: string;
    metadata?: Record<string, unknown>;
    user?: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  sale?: {
    id: string;
    receiptNumber: string;
  };
}

// ============================================
// HELPERS
// ============================================

/**
 * Resolve the provider name from a payment. Reads the legacy
 * top-level field first, then `metadata.provider` (where the
 * backend actually writes it), then `gatewayId` as a last resort.
 */
function resolvePaymentProvider(payment: any): string | undefined {
  if (!payment) return undefined;
  if (payment.provider) return payment.provider;
  const meta = payment.metadata ?? {};
  const metaProvider =
    typeof meta.provider === 'string' ? meta.provider : undefined;
  return metaProvider || payment.gatewayId || undefined;
}

// ============================================
// CONSTANTS
// ============================================

const PROVIDER_IMAGE_URLS: Record<string, string> = {
  STRIPE: 'https://stripe.com/img/v3/home/social.png',
  PAYPAL:
    'https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg',
  FLUTTERWAVE: 'https://flutterwave.com/images/logo/flyer.png',
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
  BANK_TRANSFER: Landmark,
  GIFT_CARD: Gift,
  LOYALTY_POINTS: Star,
  CHECK: FileText,
  PAYPAL: Globe,
  FLUTTERWAVE: Globe,
  SQUARE: CreditCard,
};

const PAYMENT_METHOD_EMOJI: Record<string, string> = {
  CASH: '💰',
  CREDIT_CARD: '💳',
  DEBIT_CARD: '💳',
  MOBILE_MONEY: '📱',
  BANK_TRANSFER: '🏦',
  GIFT_CARD: '🎁',
  LOYALTY_POINTS: '⭐',
  CHECK: '📝',
  PAYPAL: '💸',
  FLUTTERWAVE: '🌊',
  SQUARE: '⬜',
};

const REFUND_STATUS_COLORS: Record<string, string> = {
  COMPLETED:
    'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
  PENDING:
    'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
  FAILED:
    'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
  APPROVED:
    'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  REJECTED:
    'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
  CANCELLED:
    'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
  PAID: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
  PARTIAL:
    'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  PROCESSING:
    'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300',
  DECLINED:
    'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
  DISPUTED:
    'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
};

const REFUND_STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Completed',
  PENDING: 'Pending',
  FAILED: 'Failed',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  PAID: 'Paid',
  PARTIAL: 'Partial',
  PROCESSING: 'Processing',
  DECLINED: 'Declined',
  DISPUTED: 'Disputed',
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
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminPaymentRefundsPage() {
  const router = useRouter();
  const { canView, canManage, isLoading: permissionLoading } =
    usePermission();
  const { isDark } = useThemeStore();

  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 20,
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const canViewPayments =
    canView(PermissionResource.PAYMENT) ||
    canManage(PermissionResource.PAYMENT);
  const canManagePayments = canManage(PermissionResource.PAYMENT);

  // ── Data loading ─────────────────────────────────────────────

  const loadRefunds = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, unknown> = {
        page: pagination.page,
        limit: pagination.limit,
        // Always filter by refunded status — the backend returns
        // payments, not refunds, so we narrow to REFUNDED and let
        // the mapping step below shape them as refunds.
        status: 'REFUNDED',
      };

      if (dateFrom) params.startDate = dateFrom;
      if (dateTo) params.endDate = dateTo;
      if (search) params.search = search;

      const response = await paymentService.getPayments(params);

      // Shape each refunded payment into the Refund view-model.
      const refundData: Refund[] = (response.data || []).map(
        (payment: any) => ({
          id: payment.id,
          paymentId: payment.id,
          amount: payment.amount,
          reason:
            payment.refundReason ||
            payment.notes ||
            'No reason provided',
          status: payment.status,
          refundedAt: payment.refundedAt || payment.updatedAt,
          refundedBy: payment.refundedBy,
          payment: {
            id: payment.id,
            reference: payment.reference || payment.id,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
            provider: resolvePaymentProvider(payment),
            gatewayId: payment.gatewayId,
            metadata: payment.metadata,
            user: payment.user,
            status: payment.status,
          },
          sale: payment.sale,
        }),
      );

      setRefunds(refundData);

      // Prefer the canonical `pagination` shape, fall back to the
      // legacy flat fields. Functional update so a concurrent page
      // change isn't clobbered by a stale snapshot.
      const paginationData =
        (response as any).pagination ??
        ({
          page: response.page,
          total: response.total,
          totalPages: response.totalPages,
          limit: response.limit,
        } as const);

      setPagination((prev) => ({
        ...prev,
        page: paginationData.page || prev.page,
        total: paginationData.total || 0,
        totalPages: paginationData.totalPages || 1,
        limit: paginationData.limit || prev.limit,
      }));
    } catch (error: any) {
      console.error('Failed to load refunds:', error);
      toast.error('Failed to load refunds');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    statusFilter,
    dateFrom,
    dateTo,
    search,
  ]);

  useEffect(() => {
    if (canViewPayments) {
      void loadRefunds();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canViewPayments,
    pagination.page,
    pagination.limit,
    statusFilter,
    dateFrom,
    dateTo,
  ]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRefunds();
    toast.success('Data refreshed');
  }, [loadRefunds]);

  const handleSearch = useCallback(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    // The effect above will fire when pagination.page changes; if
    // we're already on page 1, call loadRefunds directly.
    if (pagination.page === 1) {
      void loadRefunds();
    }
  }, [pagination.page, loadRefunds]);

  const goToPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  // ── Lookups ──────────────────────────────────────────────────

  const getStatusColor = useCallback((status: string) => {
    return (
      REFUND_STATUS_COLORS[status] ||
      'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300'
    );
  }, []);

  const getStatusLabel = useCallback((status: string) => {
    return REFUND_STATUS_LABELS[status] || status;
  }, []);

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'COMPLETED':
      case 'APPROVED':
      case 'PAID':
        return <CheckCircle className="w-4 h-4" />;
      case 'PENDING':
      case 'PROCESSING':
        return <Clock className="w-4 h-4" />;
      case 'FAILED':
      case 'REJECTED':
      case 'DECLINED':
        return <XCircle className="w-4 h-4" />;
      case 'DISPUTED':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  }, []);

  const getPaymentIcon = useCallback((method: string) => {
    const Icon = PAYMENT_METHOD_ICONS[method] || CreditCard;
    return <Icon className="w-4 h-4" />;
  }, []);

  const getPaymentEmoji = useCallback((method: string): string => {
    return PAYMENT_METHOD_EMOJI[method] || '💳';
  }, []);

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

  const formatMethod = useCallback((method: string) => {
    if (!method) return 'unknown';
    return method.toLowerCase().replace(/_/g, ' ');
  }, []);

  const handleCopyReference = useCallback((reference: string) => {
    navigator.clipboard
      .writeText(reference)
      .then(() => {
        toast.success('Reference copied');
      })
      .catch(() => {
        toast.error('Failed to copy reference');
      });
  }, []);

  // ── Render gates ─────────────────────────────────────────────

  if (permissionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!canViewPayments) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          You don't have permission to view refunds.
        </p>
        <button
          onClick={() => router.push('/admin/payments')}
          className="mt-4 btn-brand"
        >
          Back to Payments
        </button>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────

  return (
    <div
      className={`min-h-screen p-6 ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}
    >
      <div className="max-w-container mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 animate-fade-in">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/payments')}
              className={`p-2 rounded-lg transition duration-250 focus-ring ${
                isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
              }`}
              aria-label="Back to payments"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1
                className={`text-2xl font-bold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                Payment Refunds
              </h1>
              <p
                className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                Manage and track all payment refunds
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`p-2 rounded-lg transition duration-250 focus-ring ${
                isDark
                  ? 'bg-gray-800 hover:bg-gray-700 text-white'
                  : 'bg-white hover:bg-gray-100 text-gray-700'
              } border ${
                isDark ? 'border-gray-700' : 'border-gray-300'
              } disabled:opacity-50`}
              aria-label="Refresh refunds"
            >
              <RefreshCw
                className={`w-5 h-5 ${
                  refreshing ? 'animate-spin' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="card-brand shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p
                  className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  Total Refunds
                </p>
                <p
                  className={`text-2xl font-bold mt-1 tabular-nums ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {refunds.length}
                </p>
              </div>
              <div
                className={`p-3 rounded-lg ${
                  isDark ? 'bg-danger-900/20' : 'bg-danger-100'
                }`}
              >
                <TrendingDown
                  className={`w-6 h-6 ${
                    isDark ? 'text-danger-400' : 'text-danger-600'
                  }`}
                />
              </div>
            </div>
          </div>
          <div className="card-brand shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p
                  className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  Total Refund Amount
                </p>
                <p
                  className={`text-2xl font-bold mt-1 tabular-nums ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {formatCurrency(
                    refunds.reduce((sum, r) => sum + r.amount, 0),
                  )}
                </p>
              </div>
              <div
                className={`p-3 rounded-lg ${
                  isDark ? 'bg-primary-900/20' : 'bg-primary-100'
                }`}
              >
                <DollarSign
                  className={`w-6 h-6 ${
                    isDark ? 'text-primary-400' : 'text-primary-600'
                  }`}
                />
              </div>
            </div>
          </div>
          <div className="card-brand shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p
                  className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  Completed Refunds
                </p>
                <p
                  className={`text-2xl font-bold mt-1 tabular-nums ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {
                    refunds.filter(
                      (r) =>
                        r.status === 'COMPLETED' ||
                        r.status === 'PAID',
                    ).length
                  }
                </p>
              </div>
              <div
                className={`p-3 rounded-lg ${
                  isDark ? 'bg-success-900/20' : 'bg-success-100'
                }`}
              >
                <CheckCircle
                  className={`w-6 h-6 ${
                    isDark ? 'text-success-400' : 'text-success-600'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card-brand mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by payment reference..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm ${
                  isDark
                    ? 'bg-gray-700 text-white placeholder-gray-400'
                    : 'bg-gray-100 text-gray-900 placeholder-gray-500'
                } focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition duration-250 focus-ring ${
                showFilters || statusFilter !== 'all' || dateFrom || dateTo
                  ? 'bg-brand-gradient text-white'
                  : isDark
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              aria-expanded={showFilters}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>

            <button onClick={handleSearch} className="btn-brand">
              Apply
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 animate-slide-down">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${
                      isDark
                        ? 'bg-gray-700 text-white border-gray-600'
                        : 'bg-gray-100 text-gray-900 border-gray-300'
                    } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                  >
                    <option value="all">All Status</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="FAILED">Failed</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="PARTIAL">Partial</option>
                    <option value="PROCESSING">Processing</option>
                    <option value="DISPUTED">Disputed</option>
                  </select>
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Date From
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${
                      isDark
                        ? 'bg-gray-700 text-white border-gray-600'
                        : 'bg-gray-100 text-gray-900 border-gray-300'
                    } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                  />
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Date To
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${
                      isDark
                        ? 'bg-gray-700 text-white border-gray-600'
                        : 'bg-gray-100 text-gray-900 border-gray-300'
                    } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setDateFrom('');
                    setDateTo('');
                    setSearch('');
                    setPagination((prev) => ({
                      ...prev,
                      page: 1,
                    }));
                  }}
                  className="text-sm text-danger-600 dark:text-danger-400 hover:text-danger-800 dark:hover:text-danger-300 transition duration-250 focus-ring"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Refunds Table */}
        <div className="rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow-soft">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            </div>
          ) : refunds.length === 0 ? (
            <div className="text-center py-12">
              <ArrowDownRight className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3
                className={`text-lg font-medium ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                No refunds found
              </h3>
              <p
                className={`text-sm mt-1 ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                No refunds have been processed yet
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full">
                  <thead
                    className={`border-b ${
                      isDark
                        ? 'border-gray-700 bg-gray-700/30'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <tr>
                      {[
                        'Payment Reference',
                        'Date',
                        'Customer',
                        'Method / Provider',
                        'Amount',
                        'Status',
                        'Actions',
                      ].map((label, i) => (
                        <th
                          key={label}
                          className={`px-4 py-3 text-${
                            i === 4 || i === 6 ? 'right' : 'left'
                          } text-2xs font-medium uppercase tracking-wider eyebrow ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody
                    className={`divide-y ${
                      isDark ? 'divide-gray-700' : 'divide-gray-200'
                    }`}
                  >
                    {refunds.map((refund) => {
                      const paymentProvider = refund.payment?.provider;
                      const imageUrl = getProviderImageUrl(paymentProvider);

                      return (
                        <tr
                          key={refund.id}
                          className={`transition-colors duration-250 ${
                            isDark
                              ? 'hover:bg-gray-700/50'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <p
                              className={`font-mono text-sm font-medium tabular-nums ${
                                isDark ? 'text-white' : 'text-gray-900'
                              }`}
                            >
                              {refund.payment?.reference ||
                                refund.paymentId}
                            </p>
                            {refund.sale?.receiptNumber && (
                              <p
                                className={`text-xs ${
                                  isDark
                                    ? 'text-gray-400'
                                    : 'text-gray-500'
                                }`}
                              >
                                Sale: {refund.sale.receiptNumber}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p
                              className={`text-sm ${
                                isDark
                                  ? 'text-gray-300'
                                  : 'text-gray-700'
                              }`}
                            >
                              {formatDate(refund.refundedAt)}
                            </p>
                            <p
                              className={`text-xs ${
                                isDark
                                  ? 'text-gray-500'
                                  : 'text-gray-400'
                              }`}
                            >
                              {formatDateTime(refund.refundedAt)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p
                              className={`text-sm ${
                                isDark ? 'text-white' : 'text-gray-900'
                              }`}
                            >
                              {refund.payment?.user?.firstName}{' '}
                              {refund.payment?.user?.lastName}
                            </p>
                            {refund.payment?.user?.email && (
                              <p
                                className={`text-xs ${
                                  isDark
                                    ? 'text-gray-400'
                                    : 'text-gray-500'
                                }`}
                              >
                                {refund.payment.user.email}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {imageUrl ? (
                                <div className="relative w-6 h-6 flex-shrink-0">
                                  <Image
                                    src={imageUrl}
                                    alt={getProviderName(
                                      paymentProvider,
                                    )}
                                    width={24}
                                    height={24}
                                    className="rounded object-contain"
                                    onError={(e) => {
                                      (
                                        e.target as HTMLImageElement
                                      ).style.display = 'none';
                                      const parent = (
                                        e.target as HTMLImageElement
                                      ).parentElement;
                                      if (parent) {
                                        const fallback =
                                          document.createElement(
                                            'span',
                                          );
                                        fallback.className = `text-sm ${
                                          isDark
                                            ? 'text-gray-300'
                                            : 'text-gray-600'
                                        }`;
                                        fallback.textContent =
                                          getPaymentEmoji(
                                            refund.payment
                                              ?.paymentMethod ||
                                              'CREDIT_CARD',
                                          );
                                        parent.appendChild(fallback);
                                      }
                                    }}
                                  />
                                </div>
                              ) : (
                                <span className="text-sm">
                                  {getPaymentIcon(
                                    refund.payment?.paymentMethod ||
                                      'CREDIT_CARD',
                                  )}
                                </span>
                              )}
                              <div>
                                <p
                                  className={`text-sm capitalize ${
                                    isDark
                                      ? 'text-gray-300'
                                      : 'text-gray-700'
                                  }`}
                                >
                                  {formatMethod(
                                    refund.payment?.paymentMethod || '',
                                  )}
                                </p>
                                <p
                                  className={`text-xs ${
                                    isDark
                                      ? 'text-gray-400'
                                      : 'text-gray-500'
                                  }`}
                                >
                                  {getProviderName(paymentProvider)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p
                              className={`text-sm font-bold tabular-nums text-danger-600 dark:text-danger-400`}
                            >
                              -{formatCurrency(refund.amount)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 text-2xs font-medium rounded-full flex items-center gap-1 w-fit ${getStatusColor(
                                refund.status,
                              )}`}
                            >
                              {getStatusIcon(refund.status)}
                              {getStatusLabel(refund.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setSelectedRefund(refund);
                                  setShowDetailModal(true);
                                }}
                                className={`p-1.5 rounded-lg transition duration-250 focus-ring ${
                                  isDark
                                    ? 'hover:bg-gray-700'
                                    : 'hover:bg-gray-100'
                                }`}
                                title="View details"
                                aria-label="View refund details"
                              >
                                <Eye className="w-4 h-4 text-primary-500" />
                              </button>
                              <button
                                onClick={() => {
                                  if (refund.payment) {
                                    setSelectedRefund(refund);
                                    setShowReceiptModal(true);
                                  }
                                }}
                                className={`p-1.5 rounded-lg transition duration-250 focus-ring ${
                                  isDark
                                    ? 'hover:bg-gray-700'
                                    : 'hover:bg-gray-100'
                                }`}
                                title="View receipt"
                                aria-label="View receipt"
                                disabled={!refund.payment}
                              >
                                <Receipt className="w-4 h-4 text-success-500" />
                              </button>
                              <button
                                onClick={() =>
                                  handleCopyReference(
                                    refund.payment?.reference ||
                                      refund.paymentId,
                                  )
                                }
                                className={`p-1.5 rounded-lg transition duration-250 focus-ring ${
                                  isDark
                                    ? 'hover:bg-gray-700'
                                    : 'hover:bg-gray-100'
                                }`}
                                title="Copy reference"
                                aria-label="Copy reference"
                              >
                                <Copy className="w-4 h-4 text-gray-500" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div
                  className={`px-4 py-3 border-t ${
                    isDark ? 'border-gray-700' : 'border-gray-200'
                  } flex flex-wrap items-center justify-between gap-3`}
                >
                  <p
                    className={`text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    Showing{' '}
                    {(pagination.page - 1) * pagination.limit + 1} to{' '}
                    {Math.min(
                      pagination.page * pagination.limit,
                      pagination.total,
                    )}{' '}
                    of {pagination.total}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => goToPage(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className={`px-3 py-1 rounded-lg text-sm transition duration-250 disabled:opacity-50 focus-ring ${
                        isDark
                          ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                      } border`}
                    >
                      <ChevronLeft className="w-4 h-4 inline" />
                      Previous
                    </button>
                    {Array.from(
                      { length: Math.min(pagination.totalPages, 5) },
                      (_, i) => {
                        let pageNum: number;
                        if (pagination.totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (pagination.page <= 3) {
                          pageNum = i + 1;
                        } else if (
                          pagination.page >=
                          pagination.totalPages - 2
                        ) {
                          pageNum =
                            pagination.totalPages - 4 + i;
                        } else {
                          pageNum = pagination.page - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => goToPage(pageNum)}
                            className={`px-3 py-1 rounded-lg text-sm transition duration-250 focus-ring ${
                              pagination.page === pageNum
                                ? 'bg-brand-gradient text-white'
                                : isDark
                                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                                  : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                            } border`}
                          >
                            {pageNum}
                          </button>
                        );
                      },
                    )}
                    <button
                      onClick={() => goToPage(pagination.page + 1)}
                      disabled={
                        pagination.page === pagination.totalPages
                      }
                      className={`px-3 py-1 rounded-lg text-sm transition duration-250 disabled:opacity-50 focus-ring ${
                        isDark
                          ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                      } border`}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 inline" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail Modal */}
        {showDetailModal && selectedRefund && (
          <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div
              className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl ${
                isDark ? 'bg-gray-800' : 'bg-white'
              }`}
            >
              <div
                className={`sticky top-0 z-10 p-4 border-b ${
                  isDark
                    ? 'border-gray-700 bg-gray-800'
                    : 'border-gray-200 bg-white'
                } flex items-center justify-between`}
              >
                <div>
                  <h3
                    className={`text-lg font-bold ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    Refund Details
                  </h3>
                  <p
                    className={`text-sm font-mono tabular-nums ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    {selectedRefund.payment?.reference ||
                      selectedRefund.paymentId}
                  </p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className={`p-2 rounded-lg transition duration-250 focus-ring ${
                    isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  }`}
                  aria-label="Close details"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      className={`text-2xl font-bold tabular-nums text-danger-600 dark:text-danger-400`}
                    >
                      -{formatCurrency(selectedRefund.amount)}
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
                      className={`px-2 py-1 text-sm font-medium rounded-full inline-flex items-center gap-1 ${getStatusColor(
                        selectedRefund.status,
                      )}`}
                    >
                      {getStatusIcon(selectedRefund.status)}
                      {getStatusLabel(selectedRefund.status)}
                    </span>
                  </div>
                </div>

                {/* Payment Method & Provider */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      Payment Method
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {getPaymentIcon(
                        selectedRefund.payment?.paymentMethod ||
                          'CREDIT_CARD',
                      )}
                      <span
                        className={`font-medium ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {formatMethod(
                          selectedRefund.payment?.paymentMethod || '',
                        )}
                      </span>
                    </div>
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
                      Provider
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {getProviderImageUrl(
                        selectedRefund.payment?.provider,
                      ) ? (
                        <div className="relative w-6 h-6">
                          <Image
                            src={getProviderImageUrl(
                              selectedRefund.payment?.provider,
                            )}
                            alt={getProviderName(
                              selectedRefund.payment?.provider,
                            )}
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
                      ) : null}
                      <span
                        className={`font-medium ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {getProviderName(
                          selectedRefund.payment?.provider,
                        )}
                      </span>
                    </div>
                  </div>
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
                    Reason
                  </p>
                  <p
                    className={`text-sm ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    {selectedRefund.reason || 'No reason provided'}
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
                    Refunded At
                  </p>
                  <p
                    className={`font-medium ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {formatDateTime(selectedRefund.refundedAt)}
                  </p>
                </div>

                {selectedRefund.refundedBy && (
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
                      Refunded By
                    </p>
                    <p
                      className={`font-medium ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {selectedRefund.refundedBy}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Receipt Modal */}
        {showReceiptModal && selectedRefund?.payment && (
          <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
            <div className="max-w-2xl w-full">
              <PaymentReceipt
                payment={{
                  id: selectedRefund.payment.id,
                  reference:
                    selectedRefund.payment.reference ||
                    selectedRefund.payment.id,
                  amount: selectedRefund.payment.amount,
                  paymentMethod: selectedRefund.payment.paymentMethod,
                  status:
                    selectedRefund.payment.status ||
                    selectedRefund.status,
                  processedAt: selectedRefund.refundedAt,
                  provider: selectedRefund.payment.provider,
                  metadata: selectedRefund.payment.metadata,
                  sale: selectedRefund.sale
                    ? {
                        receiptNumber:
                          selectedRefund.sale.receiptNumber,
                        items: [],
                      }
                    : undefined,
                  customer: selectedRefund.payment.user
                    ? {
                        name: `${selectedRefund.payment.user.firstName} ${selectedRefund.payment.user.lastName}`,
                        email: selectedRefund.payment.user.email,
                        phone: '',
                      }
                    : undefined,
                }}
                onClose={() => setShowReceiptModal(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
