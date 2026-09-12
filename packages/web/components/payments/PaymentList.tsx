// src/components/payments/PaymentList.tsx
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Search, Filter, Eye, RefreshCw, CreditCard,
  DollarSign, Banknote, Smartphone, Wallet,
  CheckCircle, XCircle, Clock, AlertCircle,
  Download, TrendingUp, Globe, Landmark, Gift, Star,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { paymentService } from '../../services/paymentService';
import { Table } from '../common/Table';
import { Pagination } from '../common/Pagination';
import { Modal } from '../common/Modal';
import { toast } from '../../utils/toast-manager';
import { PaymentMethod, PaymentStatus } from '../../types/enums';

// ============================================
// TYPES
// ============================================

interface Payment {
  id: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  reference?: string;
  notes?: string;
  processedAt: string;
  saleId?: string;
  sale?: {
    receiptNumber: string;
  };
  userId: string;
  provider?: string;
  gatewayId?: string;
}

// ✅ FIXED: Aligned with service PaymentSummary
interface PaymentSummary {
  totalAmount: number;
  byMethod: Record<string, number>;
  count: number;
  averageAmount: number;
  totalRefunds: number;
  refundCount: number;
  netAmount: number;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

// ============================================
// CONSTANTS - EXACT PROVIDER IMAGE URLs
// ============================================

const PROVIDER_IMAGE_URLS: Record<string, string> = {
  STRIPE: 'https://stripe.com/img/v3/home/social.png',
  PAYPAL: 'https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg',
  FLUTTERWAVE: 'https://flutterwave.com/images/logo/flyer.svg',
  PAYSTACK: 'https://paystack.com/assets/images/logo.png',
  SQUARE: 'https://squareup.com/icons/square_logo.svg',
  MTN: 'https://www.mtn.co.ug/wp-content/uploads/2023/05/mtn-logo.png',
  AIRTEL: 'https://www.airtel.in/static-assets/new-home/img/airtel-red-logo.svg',
  TIGO: 'https://www.tigo.com.tz/sites/default/files/tigo-logo.png',
  VODAFONE: 'https://www.vodafone.com/content/dam/vodcom/Images/Logo/vodafone_logo_red.png',
  CASH: 'https://cdn-icons-png.flaticon.com/512/2331/2331970.png',
  MOBILE_MONEY: 'https://cdn-icons-png.flaticon.com/512/545/545245.png',
  BANK_TRANSFER: 'https://cdn-icons-png.flaticon.com/512/2845/2845813.png',
  GIFT_CARD: 'https://cdn-icons-png.flaticon.com/512/3144/3144456.png',
  LOYALTY_POINTS: 'https://cdn-icons-png.flaticon.com/512/1828/1828665.png',
};

const PROVIDER_DARK_IMAGE_URLS: Record<string, string> = {
  STRIPE: 'https://stripe.com/img/v3/home/social.png',
  PAYPAL: 'https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg',
  FLUTTERWAVE: 'https://flutterwave.com/images/logo/flyer.svg',
  PAYSTACK: 'https://paystack.com/assets/images/logo-white.png',
  SQUARE: 'https://squareup.com/icons/square_logo.svg',
  MTN: 'https://www.mtn.co.ug/wp-content/uploads/2023/05/mtn-logo.png',
  AIRTEL: 'https://www.airtel.in/static-assets/new-home/img/airtel-red-logo.svg',
  TIGO: 'https://www.tigo.com.tz/sites/default/files/tigo-logo.png',
  VODAFONE: 'https://www.vodafone.com/content/dam/vodcom/Images/Logo/vodafone_logo_red.png',
  CASH: 'https://cdn-icons-png.flaticon.com/512/2331/2331970.png',
  MOBILE_MONEY: 'https://cdn-icons-png.flaticon.com/512/545/545245.png',
  BANK_TRANSFER: 'https://cdn-icons-png.flaticon.com/512/2845/2845813.png',
  GIFT_CARD: 'https://cdn-icons-png.flaticon.com/512/3144/3144456.png',
  LOYALTY_POINTS: 'https://cdn-icons-png.flaticon.com/512/1828/1828665.png',
};

const PAYMENT_METHOD_ICONS: Record<string, any> = {
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
  PAYSTACK: CreditCard,
  SQUARE: CreditCard,
};

const PAYMENT_METHOD_EMOJIS: Record<string, string> = {
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
  PAYSTACK: '🔷',
  SQUARE: '⬜',
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
  MTN: 'MTN Mobile Money',
  AIRTEL: 'Airtel Money',
  TIGO: 'Tigo Pesa',
  VODAFONE: 'Vodafone Cash',
};

// ============================================
// MAIN COMPONENT
// ============================================

export function PaymentList() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    method: '',
    status: '',
    provider: '',
    startDate: '',
    endDate: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 20,
  });
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [refundData, setRefundData] = useState({ amount: 0, reason: '' });
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [isDark, setIsDark] = useState(false);

  // Detect theme
  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  useEffect(() => {
    loadPayments();
    loadSummary();
  }, [filters, pagination.page]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search,
      };

      if (filters.method) {
        params.method = filters.method as PaymentMethod;
      }

      if (filters.status) {
        params.status = filters.status as PaymentStatus;
      }

      if (filters.provider) {
        params.provider = filters.provider;
      }

      if (filters.startDate) {
        params.startDate = filters.startDate;
      }
      if (filters.endDate) {
        params.endDate = filters.endDate;
      }

      const result = await paymentService.getPayments(params);
      setPayments(result.data || []);
      setPagination({
        ...pagination,
        total: result.total || 0,
        totalPages: result.totalPages || 1,
      });
    } catch (error) {
      console.error('Failed to load payments:', error);
      toast.error('Failed to load payments');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const data = await paymentService.getPaymentSummary({
        startDate: filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: filters.endDate || new Date().toISOString().split('T')[0],
      });
      // ✅ FIXED: Map the response to match the local PaymentSummary interface
      setSummary({
        totalAmount: data.totalAmount || 0,
        byMethod: data.byMethod || {},
        count: data.count || 0,
        averageAmount: data.averageAmount || 0,
        totalRefunds: data.totalRefunds || 0,
        refundCount: data.refundCount || 0,
        netAmount: data.netAmount || 0,
      });
    } catch (error) {
      console.error('Failed to load summary:', error);
    }
  };

  const handleRefund = async () => {
    if (!selectedPayment) return;
    try {
      // ✅ FIXED: refundPayment expects 2 arguments (id and data object)
      const result = await paymentService.refundPayment(selectedPayment.id, {
        amount: refundData.amount || selectedPayment.amount,
        reason: refundData.reason || 'Refund requested',
      });
      toast.success(`Refund of ${result.refundedAmount} processed successfully`);
      setShowRefundModal(false);
      loadPayments();
      loadSummary();
    } catch (error) {
      console.error('Refund failed:', error);
      toast.error('Failed to refund payment');
    }
  };

  const getMethodIcon = (method: string) => {
    const Icon = PAYMENT_METHOD_ICONS[method] || DollarSign;
    return Icon;
  };

  const getMethodEmoji = (method: string) => {
    return PAYMENT_METHOD_EMOJIS[method] || '💳';
  };

  const getProviderName = (provider?: string): string => {
    if (!provider) return 'N/A';
    return PROVIDER_NAMES[provider] || provider;
  };

  const getProviderImageUrl = (provider?: string): string => {
    if (!provider) return '';
    return isDark && PROVIDER_DARK_IMAGE_URLS[provider]
      ? PROVIDER_DARK_IMAGE_URLS[provider]
      : PROVIDER_IMAGE_URLS[provider] || '';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'green';
      case 'PENDING': return 'yellow';
      case 'FAILED': return 'red';
      case 'REFUNDED': return 'purple';
      case 'PARTIAL': return 'orange';
      case 'PROCESSING': return 'blue';
      case 'AUTHORIZED': return 'indigo';
      case 'DECLINED': return 'red';
      case 'DISPUTED': return 'orange';
      case 'CANCELLED': return 'gray';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PAID': return CheckCircle;
      case 'PENDING': return Clock;
      case 'FAILED': return XCircle;
      case 'REFUNDED': return AlertCircle;
      case 'PROCESSING': return RefreshCw;
      default: return AlertCircle;
    }
  };

  const columns = [
    {
      key: 'payment',
      header: 'Payment',
      render: (payment: Payment) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">#{payment.id.slice(0, 8)}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {new Date(payment.processedAt).toLocaleString()}
          </p>
        </div>
      ),
    },
    {
      key: 'method',
      header: 'Method / Provider',
      render: (payment: Payment) => {
        const imageUrl = getProviderImageUrl(payment.provider || payment.gatewayId);
        const Icon = getMethodIcon(payment.paymentMethod);

        return (
          <div className="flex items-center gap-3">
            {imageUrl ? (
              <div className="relative w-8 h-8 flex-shrink-0">
                <Image
                  src={imageUrl}
                  alt={getProviderName(payment.provider || payment.gatewayId)}
                  width={32}
                  height={32}
                  style={{ width: 'auto', height: 'auto' }}
                  className="rounded object-contain max-w-[32px] max-h-[32px]"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      const fallback = document.createElement('span');
                      fallback.className = 'text-lg';
                      fallback.textContent = getMethodEmoji(payment.paymentMethod);
                      parent.appendChild(fallback);
                    }
                  }}
                />
              </div>
            ) : (
              <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {payment.paymentMethod}
              </p>
              {payment.provider && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {getProviderName(payment.provider)}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (payment: Payment) => (
        <span className="font-bold text-gray-900 dark:text-white">
          ${payment.amount.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'sale',
      header: 'Sale',
      render: (payment: Payment) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {payment.sale?.receiptNumber || 'N/A'}
        </span>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (payment: Payment) => (
        <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
          {payment.reference || payment.transactionId || 'N/A'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (payment: Payment) => {
        const StatusIcon = getStatusIcon(payment.status);
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 bg-${getStatusColor(payment.status)}-100 text-${getStatusColor(payment.status)}-700 dark:bg-${getStatusColor(payment.status)}-900/30 dark:text-${getStatusColor(payment.status)}-300`}>
            <StatusIcon className="w-3 h-3" />
            {payment.status}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (payment: Payment) => (
        <div className="flex items-center gap-2">
          {payment.status === 'PAID' && (
            <button
              onClick={() => {
                setSelectedPayment(payment);
                setRefundData({ amount: payment.amount, reason: '' });
                setShowRefundModal(true);
              }}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
              title="Refund"
            >
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            </button>
          )}
          <button
            className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
        </div>
      ),
    },
  ];

  // Get unique providers for filter
  const providerOptions = Array.from(
    new Set(payments.map(p => p.provider).filter(Boolean))
  );

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-950 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payments</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage all payment transactions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${summary.totalAmount?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Transactions</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary.count || 0}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Cash</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              ${(summary.byMethod?.CASH || 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Card</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              ${((summary.byMethod?.CREDIT_CARD || 0) + (summary.byMethod?.DEBIT_CARD || 0)).toFixed(2)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Mobile Money</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              ${(summary.byMethod?.MOBILE_MONEY || 0).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by reference..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
          <select
            value={filters.method}
            onChange={(e) => setFilters({ ...filters, method: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="">All Methods</option>
            <option value="CASH">Cash</option>
            <option value="CREDIT_CARD">Credit Card</option>
            <option value="DEBIT_CARD">Debit Card</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="GIFT_CARD">Gift Card</option>
            <option value="LOYALTY_POINTS">Loyalty Points</option>
            <option value="PAYPAL">PayPal</option>
            <option value="FLUTTERWAVE">Flutterwave</option>
            <option value="PAYSTACK">Paystack</option>
            <option value="SQUARE">Square</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="">All Status</option>
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
          {providerOptions.length > 0 && (
            <select
              value={filters.provider}
              onChange={(e) => setFilters({ ...filters, provider: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Providers</option>
              {providerOptions.map((provider) => (
                <option key={provider} value={provider}>
                  {getProviderName(provider)}
                </option>
              ))}
            </select>
          )}
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <span className="text-gray-500 dark:text-gray-400">to</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <button
            onClick={() => {
              setFilters({
                search: '',
                method: '',
                status: '',
                provider: '',
                startDate: '',
                endDate: '',
              });
            }}
            className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
        <Table
          columns={columns}
          data={payments}
          loading={loading}
        />
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(page) => setPagination({ ...pagination, page })}
          />
        </div>
      </div>

      {/* Refund Modal */}
      <Modal
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        title="Refund Payment"
      >
        <div className="p-6">
          {selectedPayment && (
            <div className="mb-4 space-y-2">
              <p className="font-medium text-gray-900 dark:text-white">Payment: #{selectedPayment.id.slice(0, 8)}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Amount: ${selectedPayment.amount.toFixed(2)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Method: {selectedPayment.paymentMethod}
              </p>
              {selectedPayment.provider && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Provider: {getProviderName(selectedPayment.provider)}
                </p>
              )}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Refund Amount
              </label>
              <input
                type="number"
                value={refundData.amount}
                onChange={(e) => setRefundData({ ...refundData, amount: parseFloat(e.target.value) || 0 })}
                step="0.01"
                min="0"
                max={selectedPayment?.amount}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reason
              </label>
              <textarea
                value={refundData.reason}
                onChange={(e) => setRefundData({ ...refundData, reason: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Reason for refund..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowRefundModal(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleRefund}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Process Refund
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
