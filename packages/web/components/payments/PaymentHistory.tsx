'use client';

import { useState, useEffect } from 'react';
import {
  CreditCard, DollarSign, Calendar, Clock, Eye,
  Download, Printer, Copy, CheckCircle, XCircle,
  AlertCircle, Loader2, ChevronDown, ChevronUp,
  Search, Filter, RefreshCw, FileText, ArrowUpRight,
  ArrowDownRight, Receipt, Shield, Lock, Star,
  Banknote, Wallet, Building, QrCode, Gift, Smartphone, Landmark
} from 'lucide-react';
import { useThemeStore } from '../../app/stores/themeStore';
import { paymentService } from '../../services/paymentService';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
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
  onPaymentSelect?: (payment: any) => void;
}

// ✅ FIXED: Match the imported type exactly
interface Payment {
  id: string;
  amount: number;
  paymentMethod: string;
  status: string;
  reference?: string;
  processedAt: string;
  provider?: string;
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
  // ✅ FIXED: Make address optional to match imported type
  businessUnit?: {
    name: string;
    address?: string; // Made optional
    phone?: string;
    email?: string;
  };
}

// ============================================
// CONSTANTS
// ============================================

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PAID: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  REFUNDED: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
  PARTIAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  PROCESSING: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  AUTHORIZED: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  DECLINED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  DISPUTED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
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
};

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
    limit: limit,
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
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  useEffect(() => {
    loadPayments();
  }, [userId, pagination.page, filters]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (userId) params.userId = userId;
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.paymentMethod !== 'all') params.paymentMethod = filters.paymentMethod;
      if (filters.provider !== 'all') params.provider = filters.provider;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (search) params.search = search;

      const response = await paymentService.getPayments(params);
      setPayments(response.data || []);
      setPagination({
        page: response.page || 1,
        total: response.total || 0,
        totalPages: response.totalPages || 1,
        limit: response.limit || limit,
      });
    } catch (error) {
      console.error('Failed to load payment history:', error);
      toast.error('Failed to load payment history');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadPayments();
    toast.success('Payments refreshed');
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadPayments();
  };

  const getStatusColor = (status: string) => {
    return PAYMENT_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';
  };

  const getPaymentIcon = (method: string) => {
    const Icon = PAYMENT_METHOD_ICONS[method] || CreditCard;
    return <Icon className="w-4 h-4" />;
  };

  const formatMethod = (method: string) => {
    return method.toLowerCase().replace(/_/g, ' ');
  };

  const getStatusIcon = (status: string) => {
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
  };

  const handleCopyReference = (reference: string) => {
    navigator.clipboard.writeText(reference);
    toast.success('Reference copied');
  };

  const handleViewReceipt = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowReceiptModal(true);
    onPaymentSelect?.(payment);
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Payment History
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className={`p-2 rounded-lg transition ${
              isDark
                ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
            } disabled:opacity-50`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {showFilters && (
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`p-2 rounded-lg transition ${
                isDark
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by reference, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm ${
              isDark
                ? 'bg-gray-700 text-white placeholder-gray-400'
                : 'bg-gray-100 text-gray-900 placeholder-gray-500'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
        >
          Search
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && showFilterPanel && (
        <div className={`p-4 rounded-lg mb-4 ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  isDark
                    ? 'bg-gray-600 text-white border-gray-500'
                    : 'bg-white text-gray-900 border-gray-300'
                } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
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
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Payment Method
              </label>
              <select
                value={filters.paymentMethod}
                onChange={(e) => setFilters(prev => ({ ...prev, paymentMethod: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  isDark
                    ? 'bg-gray-600 text-white border-gray-500'
                    : 'bg-white text-gray-900 border-gray-300'
                } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
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
              </select>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Provider
              </label>
              <select
                value={filters.provider}
                onChange={(e) => setFilters(prev => ({ ...prev, provider: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  isDark
                    ? 'bg-gray-600 text-white border-gray-500'
                    : 'bg-white text-gray-900 border-gray-300'
                } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                <option value="all">All Providers</option>
                <option value="STRIPE">Stripe</option>
                <option value="CASH">Cash</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="GIFT_CARD">Gift Card</option>
                <option value="LOYALTY_POINTS">Loyalty Points</option>
              </select>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Date Range
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                    isDark
                      ? 'bg-gray-600 text-white border-gray-500'
                      : 'bg-white text-gray-900 border-gray-300'
                  } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                setFilters({
                  status: 'all',
                  paymentMethod: 'all',
                  provider: 'all',
                  startDate: '',
                  endDate: '',
                });
                setSearch('');
                setPagination(prev => ({ ...prev, page: 1 }));
                loadPayments();
              }}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Payments List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : payments.length === 0 ? (
        <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No payments found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className={`p-4 rounded-lg border transition ${
                isDark
                  ? 'border-gray-700 hover:bg-gray-700/30'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${getStatusColor(payment.status)}`}>
                    {getPaymentIcon(payment.paymentMethod)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {formatCurrency(payment.amount)}
                      </p>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1 ${getStatusColor(payment.status)}`}>
                        {getStatusIcon(payment.status)}
                        {payment.status}
                      </span>
                      {payment.provider && (
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {payment.provider}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-sm">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                        {payment.reference || `PAY-${payment.id.slice(0, 8)}`}
                      </span>
                      <button
                        onClick={() => handleCopyReference(payment.reference || payment.id)}
                        className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition`}
                        title="Copy reference"
                      >
                        <Copy className="w-3 h-3 text-gray-400" />
                      </button>
                      <span className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
                      <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                        {formatMethod(payment.paymentMethod)}
                      </span>
                      <span className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
                      <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                        {formatDateTime(payment.processedAt)}
                      </span>
                      {payment.sale?.receiptNumber && (
                        <>
                          <span className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
                          <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
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
                    className={`p-1.5 rounded-lg transition ${
                      isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    }`}
                    title="View receipt"
                  >
                    <Receipt className="w-4 h-4 text-blue-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
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
              Previous
            </button>
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
            </button>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-2xl w-full">
            <PaymentReceipt
              payment={{
                id: selectedPayment.id,
                reference: selectedPayment.reference || selectedPayment.id,
                amount: selectedPayment.amount,
                paymentMethod: selectedPayment.paymentMethod,
                status: selectedPayment.status,
                processedAt: selectedPayment.processedAt,
                sale: selectedPayment.sale ? {
                  receiptNumber: selectedPayment.sale.receiptNumber,
                  items: selectedPayment.sale.items || [],
                } : undefined,
                customer: selectedPayment.customer ? {
                  name: selectedPayment.customer.name,
                  email: selectedPayment.customer.email,
                  phone: selectedPayment.customer.phone || '',
                } : undefined,
                businessUnit: selectedPayment.businessUnit ? {
                  name: selectedPayment.businessUnit.name,
                  address: selectedPayment.businessUnit.address || '',
                  phone: selectedPayment.businessUnit.phone || '',
                  email: selectedPayment.businessUnit.email || '',
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
