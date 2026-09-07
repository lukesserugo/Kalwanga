// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\payments\refunds\page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft, RefreshCw, Loader2, Lock,
  ArrowDownRight, DollarSign, CreditCard, User,
  Calendar, Clock, Search, Filter, Eye,
  Copy, CheckCircle, XCircle, AlertCircle,
  ChevronLeft, ChevronRight, FileText, Receipt,
  Banknote, Wallet, Building, QrCode, Gift, Star,
  Smartphone, Landmark, TrendingDown, TrendingUp,
  Globe, Shield
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { paymentService } from '../../../../../services/paymentService';
import { formatCurrency, formatDate, formatDateTime } from '../../../../../utils/formatters';
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
// CONSTANTS
// ============================================

// Provider image URLs
const PROVIDER_IMAGE_URLS: Record<string, string> = {
  STRIPE: 'https://stripe.com/img/v3/home/social.png',
  PAYPAL: 'https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg',
  FLUTTERWAVE: 'https://flutterwave.com/images/logo/flyer.png',
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
  FLUTTERWAVE: 'https://flutterwave.com/images/logo/flyer.png',
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
  CHECK: FileText,
  PAYPAL: Globe,
  FLUTTERWAVE: Globe,
  PAYSTACK: CreditCard,
  SQUARE: CreditCard,
};

const REFUND_STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  APPROVED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
  PAID: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  PARTIAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  PROCESSING: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  DECLINED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  DISPUTED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
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

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminPaymentRefundsPage() {
  const router = useRouter();
  const { canView, canManage, isLoading: permissionLoading } = usePermission();
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

  const canViewPayments = canView(PermissionResource.PAYMENT) || canManage(PermissionResource.PAYMENT);
  const canManagePayments = canManage(PermissionResource.PAYMENT);

  useEffect(() => {
    if (canViewPayments) {
      loadRefunds();
    }
  }, [canViewPayments, pagination.page, statusFilter, dateFrom, dateTo]);

  const loadRefunds = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (statusFilter !== 'all') params.status = statusFilter;
      if (dateFrom) params.startDate = dateFrom;
      if (dateTo) params.endDate = dateTo;
      if (search) params.search = search;

      // Fetch payments with refunded status
      const response = await paymentService.getPayments({
        ...params,
        status: 'REFUNDED',
      });

      // Transform payments to refunds
      const refundData = (response.data || []).map((payment: any) => ({
        id: payment.id,
        paymentId: payment.id,
        amount: payment.amount,
        reason: payment.refundReason || payment.notes || 'No reason provided',
        status: payment.status,
        refundedAt: payment.refundedAt || payment.updatedAt,
        refundedBy: payment.refundedBy,
        payment: {
          id: payment.id,
          reference: payment.reference || payment.id,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          provider: payment.provider || payment.gatewayId,
          gatewayId: payment.gatewayId,
          user: payment.user,
        },
        sale: payment.sale,
      }));

      setRefunds(refundData);
      setPagination({
        page: response.page || 1,
        total: response.total || 0,
        totalPages: response.totalPages || 1,
        limit: response.limit || 20,
      });
    } catch (error: any) {
      console.error('Failed to load refunds:', error);
      toast.error('Failed to load refunds');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRefunds();
    toast.success('Data refreshed');
  };

  const getStatusColor = (status: string) => {
    return REFUND_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';
  };

  const getStatusLabel = (status: string) => {
    return REFUND_STATUS_LABELS[status] || status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4" />;
      case 'PENDING':
        return <Clock className="w-4 h-4" />;
      case 'FAILED':
      case 'REJECTED':
      case 'DECLINED':
        return <XCircle className="w-4 h-4" />;
      case 'APPROVED':
        return <CheckCircle className="w-4 h-4" />;
      case 'DISPUTED':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getPaymentIcon = (method: string) => {
    const Icon = PAYMENT_METHOD_ICONS[method] || CreditCard;
    return <Icon className="w-4 h-4" />;
  };

  const getProviderImageUrl = (provider?: string): string => {
    if (!provider) return '';
    return isDark && PROVIDER_DARK_IMAGE_URLS[provider] 
      ? PROVIDER_DARK_IMAGE_URLS[provider] 
      : PROVIDER_IMAGE_URLS[provider] || '';
  };

  const getProviderName = (provider?: string): string => {
    const names: Record<string, string> = {
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
    };
    return names[provider || ''] || provider || 'N/A';
  };

  const formatMethod = (method: string) => {
    return method.toLowerCase().replace(/_/g, ' ');
  };

  const handleCopyReference = (reference: string) => {
    navigator.clipboard.writeText(reference);
    toast.success('Reference copied');
  };

  if (permissionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!canViewPayments) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to view refunds.</p>
        <button
          onClick={() => router.push('/admin/payments')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Back to Payments
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/payments')}
            className={`p-2 rounded-lg transition ${
              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Payment Refunds
            </h1>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Manage and track all payment refunds
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`p-2 rounded-lg transition ${
              isDark
                ? 'bg-gray-800 hover:bg-gray-700 text-white'
                : 'bg-white hover:bg-gray-100 text-gray-700'
            } border ${isDark ? 'border-gray-700' : 'border-gray-300'} disabled:opacity-50`}
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Refunds</p>
              <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {refunds.length}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${isDark ? 'bg-red-900/20' : 'bg-red-100'}`}>
              <TrendingDown className={`w-6 h-6 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
            </div>
          </div>
        </div>
        <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Refund Amount</p>
              <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {formatCurrency(refunds.reduce((sum, r) => sum + r.amount, 0))}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${isDark ? 'bg-blue-900/20' : 'bg-blue-100'}`}>
              <DollarSign className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
          </div>
        </div>
        <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Completed Refunds</p>
              <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {refunds.filter(r => r.status === 'COMPLETED' || r.status === 'PAID').length}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${isDark ? 'bg-green-900/20' : 'bg-green-100'}`}>
              <CheckCircle className={`w-6 h-6 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`p-4 rounded-xl mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by payment reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadRefunds()}
              className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm ${
                isDark
                  ? 'bg-gray-700 text-white placeholder-gray-400'
                  : 'bg-gray-100 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${
              showFilters || statusFilter !== 'all' || dateFrom || dateTo
                ? 'bg-blue-600 text-white'
                : isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>

          <button
            onClick={loadRefunds}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
          >
            Apply
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-sm ${
                    isDark
                      ? 'bg-gray-700 text-white border-gray-600'
                      : 'bg-gray-100 text-gray-900 border-gray-300'
                  } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
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
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
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
                  } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
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
                  } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
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
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Refunds Table */}
      <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : refunds.length === 0 ? (
          <div className="text-center py-12">
            <ArrowDownRight className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              No refunds found
            </h3>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              No refunds have been processed yet
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`border-b ${isDark ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200 bg-gray-50'}`}>
                  <tr>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Payment Reference
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Date
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Customer
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Method / Provider
                    </th>
                    <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Amount
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Status
                    </th>
                    <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {refunds.map((refund) => {
                    const imageUrl = getProviderImageUrl(refund.payment?.provider || refund.payment?.gatewayId);
                    
                    return (
                      <tr key={refund.id} className={`transition-colors ${
                        isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                      }`}>
                        <td className="px-4 py-3">
                          <p className={`font-mono text-sm font-medium ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}>
                            {refund.payment?.reference || refund.paymentId}
                          </p>
                          {refund.sale?.receiptNumber && (
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              Sale: {refund.sale.receiptNumber}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {formatDate(refund.refundedAt)}
                          </p>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {formatDateTime(refund.refundedAt)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {refund.payment?.user?.firstName} {refund.payment?.user?.lastName}
                          </p>
                          {refund.payment?.user?.email && (
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
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
                                  alt={getProviderName(refund.payment?.provider || refund.payment?.gatewayId)}
                                  width={24}
                                  height={24}
                                  className="rounded object-contain"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    const parent = (e.target as HTMLImageElement).parentElement;
                                    if (parent) {
                                      const fallback = document.createElement('span');
                                      fallback.className = `text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`;
                                      fallback.textContent = getPaymentIcon(refund.payment?.paymentMethod || 'CREDIT_CARD');
                                      parent.appendChild(fallback);
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <span className="text-sm">
                                {getPaymentIcon(refund.payment?.paymentMethod || 'CREDIT_CARD')}
                              </span>
                            )}
                            <div>
                              <p className={`text-sm capitalize ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {formatMethod(refund.payment?.paymentMethod || '')}
                              </p>
                              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {getProviderName(refund.payment?.provider || refund.payment?.gatewayId)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className={`text-sm font-bold text-red-600 dark:text-red-400`}>
                            -{formatCurrency(refund.amount)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 w-fit ${getStatusColor(refund.status)}`}>
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
                              className={`p-1.5 rounded-lg transition ${
                                isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                              }`}
                              title="View details"
                            >
                              <Eye className="w-4 h-4 text-blue-500" />
                            </button>
                            <button
                              onClick={() => {
                                if (refund.payment) {
                                  setSelectedRefund(refund);
                                  setShowReceiptModal(true);
                                }
                              }}
                              className={`p-1.5 rounded-lg transition ${
                                isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                              }`}
                              title="View receipt"
                              disabled={!refund.payment}
                            >
                              <Receipt className="w-4 h-4 text-green-500" />
                            </button>
                            <button
                              onClick={() => handleCopyReference(refund.payment?.reference || refund.paymentId)}
                              className={`p-1.5 rounded-lg transition ${
                                isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                              }`}
                              title="Copy reference"
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
              <div className={`px-4 py-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} flex flex-wrap items-center justify-between gap-3`}>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className={`px-3 py-1 rounded-lg text-sm transition disabled:opacity-50 ${
                      isDark
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                    } border`}
                  >
                    <ChevronLeft className="w-4 h-4 inline" />
                    Previous
                  </button>
                  {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                        className={`px-3 py-1 rounded-lg text-sm transition ${
                          pagination.page === pageNum
                            ? 'bg-blue-600 text-white'
                            : isDark
                              ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                              : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                        } border`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                    className={`px-3 py-1 rounded-lg text-sm transition disabled:opacity-50 ${
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-xl shadow-xl ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className={`sticky top-0 z-10 p-4 border-b ${
              isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
            } flex items-center justify-between`}>
              <div>
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Refund Details
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {selectedRefund.payment?.reference || selectedRefund.paymentId}
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className={`p-2 rounded-lg transition ${
                  isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Amount</p>
                  <p className={`text-2xl font-bold text-red-600 dark:text-red-400`}>
                    -{formatCurrency(selectedRefund.amount)}
                  </p>
                </div>
                <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Status</p>
                  <span className={`px-2 py-1 text-sm font-medium rounded-full inline-flex items-center gap-1 ${getStatusColor(selectedRefund.status)}`}>
                    {getStatusIcon(selectedRefund.status)}
                    {getStatusLabel(selectedRefund.status)}
                  </span>
                </div>
              </div>

              {/* Payment Method & Provider */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Payment Method</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getPaymentIcon(selectedRefund.payment?.paymentMethod || 'CREDIT_CARD')}
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {formatMethod(selectedRefund.payment?.paymentMethod || '')}
                    </span>
                  </div>
                </div>
                <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Provider</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getProviderImageUrl(selectedRefund.payment?.provider || selectedRefund.payment?.gatewayId) ? (
                      <div className="relative w-6 h-6">
                        <Image
                          src={getProviderImageUrl(selectedRefund.payment?.provider || selectedRefund.payment?.gatewayId)}
                          alt={getProviderName(selectedRefund.payment?.provider || selectedRefund.payment?.gatewayId)}
                          width={24}
                          height={24}
                          className="rounded object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : null}
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {getProviderName(selectedRefund.payment?.provider || selectedRefund.payment?.gatewayId)}
                    </span>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Reason</p>
                <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {selectedRefund.reason || 'No reason provided'}
                </p>
              </div>

              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Refunded At</p>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {formatDateTime(selectedRefund.refundedAt)}
                </p>
              </div>

              {selectedRefund.refundedBy && (
                <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Refunded By</p>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-2xl w-full">
            <PaymentReceipt
              payment={{
                id: selectedRefund.payment.id,
                reference: selectedRefund.payment.reference || selectedRefund.payment.id,
                amount: selectedRefund.payment.amount,
                paymentMethod: selectedRefund.payment.paymentMethod,
                status: selectedRefund.payment.status,
                processedAt: selectedRefund.refundedAt,
                sale: selectedRefund.sale ? {
                  receiptNumber: selectedRefund.sale.receiptNumber,
                  items: [],
                } : undefined,
                customer: selectedRefund.payment.user ? {
                  name: `${selectedRefund.payment.user.firstName} ${selectedRefund.payment.user.lastName}`,
                  email: selectedRefund.payment.user.email,
                  phone: '',
                } : undefined,
              }}
              onClose={() => setShowReceiptModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
