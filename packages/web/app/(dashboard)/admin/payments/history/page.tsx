'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, Search, Filter, RefreshCw, Loader2,
  Eye, Download, Printer, ChevronLeft, ChevronRight,
  Calendar, Clock, User, Mail, Phone, DollarSign,
  CreditCard, CheckCircle, XCircle, AlertCircle,
  FileText, Trash2, MoreVertical, Copy, Receipt,
  Banknote, Wallet, Building, QrCode, Gift, Star,
  Smartphone, Landmark, ArrowUpRight, ArrowDownRight, Lock,
  Globe
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

interface Payment {
  id: string;
  amount: number;
  paymentMethod: string;
  status: string;
  reference?: string;
  notes?: string;
  processedAt: string;
  refundedAt?: string;
  refundReason?: string;
  refundedBy?: string;
  saleId?: string;
  sale?: {
    id: string;
    receiptNumber: string;
    total: number;
  };
  orderId?: string;
  order?: {
    id: string;
    orderNumber: string;
    total: number;
  };
  userId: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  provider?: string;
  gatewayId?: string;
  providerTransactionId?: string;
  businessUnitId?: string;
  businessUnit?: {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PaymentFilters {
  status?: string;
  paymentMethod?: string;
  provider?: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
  saleId?: string;
  orderId?: string;
  businessUnitId?: string;
}

// ============================================
// CONSTANTS - EXACT PROVIDER IMAGE URLs
// ============================================

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

const PAYMENT_STATUS_COLORS: Record<string, string> = {
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

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminPaymentHistoryPage() {
  const router = useRouter();
  const { canView, isLoading: permissionLoading } = usePermission();
  const { isDark } = useThemeStore();

  // State
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 20,
  });
  const [filters, setFilters] = useState<PaymentFilters>({
    status: 'all',
    paymentMethod: 'all',
    provider: 'all',
    startDate: '',
    endDate: '',
  });
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'>('month');

  const canViewPayments = canView(PermissionResource.PAYMENT) || canView(PermissionResource.PAYMENT);

  useEffect(() => {
    if (canViewPayments) {
      loadPayments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewPayments, pagination.page, filters, dateRange]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (filters.status && filters.status !== 'all') params.status = filters.status;
      if (filters.paymentMethod && filters.paymentMethod !== 'all') params.paymentMethod = filters.paymentMethod;
      if (filters.provider && filters.provider !== 'all') params.provider = filters.provider;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.businessUnitId) params.businessUnitId = filters.businessUnitId;
      if (search) params.search = search;

      // Handle date range
      const now = new Date();
      if (dateRange === 'today') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        params.startDate = start.toISOString();
        params.endDate = end.toISOString();
      } else if (dateRange === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        params.startDate = weekAgo.toISOString();
        params.endDate = now.toISOString();
      } else if (dateRange === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        params.startDate = monthAgo.toISOString();
        params.endDate = now.toISOString();
      } else if (dateRange === 'quarter') {
        const quarterAgo = new Date(now);
        quarterAgo.setMonth(quarterAgo.getMonth() - 3);
        params.startDate = quarterAgo.toISOString();
        params.endDate = now.toISOString();
      } else if (dateRange === 'year') {
        const yearAgo = new Date(now);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        params.startDate = yearAgo.toISOString();
        params.endDate = now.toISOString();
      }

      const response = await paymentService.getPayments(params);
      setPayments(response.data || []);
      setPagination({
        page: response.page || 1,
        total: response.total || 0,
        totalPages: response.totalPages || 1,
        limit: response.limit || 20,
      });
    } catch (error: any) {
      console.error('Failed to load payment history:', error);
      toast.error('Failed to load payment history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPayments();
    toast.success('Data refreshed');
  };

  const getStatusColor = (status: string) => {
    return PAYMENT_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';
  };

  const getPaymentIcon = (method: string) => {
    const Icon = PAYMENT_METHOD_ICONS[method] || CreditCard;
    return <Icon className="w-5 h-5" />;
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

  const formatMethod = (method: string) => {
    return method.toLowerCase().replace(/_/g, ' ');
  };

  const getProviderName = (provider: string) => {
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
      MTN: 'MTN Mobile Money',
      AIRTEL: 'Airtel Money',
      TIGO: 'Tigo Pesa',
      VODAFONE: 'Vodafone Cash',
    };
    return names[provider] || provider || 'N/A';
  };

  const getProviderImageUrl = (provider: string): string => {
    if (!provider) return '';
    return isDark && PROVIDER_DARK_IMAGE_URLS[provider]
      ? PROVIDER_DARK_IMAGE_URLS[provider]
      : PROVIDER_IMAGE_URLS[provider] || '';
  };

  const handleCopyReference = (reference: string) => {
    navigator.clipboard.writeText(reference);
    toast.success('Reference copied');
  };

  const handleViewReceipt = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowReceiptModal(true);
  };

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
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view payment history.
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

  // Helper to get customer name
  const getCustomerName = (user?: { firstName: string; lastName: string }) => {
    if (!user) return 'N/A';
    return `${user.firstName} ${user.lastName}`;
  };

  // Helper to get customer email
  const getCustomerEmail = (user?: { email: string }) => {
    return user?.email || '';
  };

  // Helper to get business unit data
  const getBusinessUnitData = (businessUnit?: Payment['businessUnit']) => {
    if (!businessUnit) return undefined;
    return {
      name: businessUnit.name,
      address: businessUnit.address || '',
      phone: businessUnit.phone || '',
      email: businessUnit.email || '',
    };
  };

  return (
    <div className={`min-h-screen p-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
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
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Payment History
              </h1>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                View all payment transactions across all providers
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
              } border ${isDark ? 'border-gray-700' : 'border-gray-300'} disabled:opacity-50`}
              aria-label="Refresh payment history"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => router.push('/admin/payments/export')}
              className="btn-brand"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card-brand mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by reference, customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadPayments()}
                className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm ${
                  isDark
                    ? 'bg-gray-700 text-white placeholder-gray-400'
                    : 'bg-gray-100 text-gray-900 placeholder-gray-500'
                } focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
              />
            </div>

            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className={`px-4 py-2 rounded-lg border text-sm ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="quarter">Last 90 Days</option>
              <option value="year">Last 365 Days</option>
              <option value="custom">Custom Range</option>
            </select>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition duration-250 focus-ring ${
                showFilters || (filters.status !== 'all' || filters.paymentMethod !== 'all' || filters.provider !== 'all' || filters.startDate || filters.endDate)
                  ? 'bg-brand-gradient text-white'
                  : isDark
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {(filters.status !== 'all' || filters.paymentMethod !== 'all' || filters.provider !== 'all' || filters.startDate || filters.endDate) && (
                <span className="w-5 h-5 rounded-full bg-white/20 text-white text-xs flex items-center justify-center tabular-nums">
                  {(filters.status !== 'all' ? 1 : 0) + (filters.paymentMethod !== 'all' ? 1 : 0) + (filters.provider !== 'all' ? 1 : 0) + (filters.startDate ? 1 : 0) + (filters.endDate ? 1 : 0)}
                </span>
              )}
            </button>

            <button
              onClick={loadPayments}
              className="btn-brand"
            >
              Apply
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 animate-slide-down">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${
                      isDark
                        ? 'bg-gray-700 text-white border-gray-600'
                        : 'bg-gray-100 text-gray-900 border-gray-300'
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
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Payment Method
                  </label>
                  <select
                    value={filters.paymentMethod}
                    onChange={(e) => setFilters(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${
                      isDark
                        ? 'bg-gray-700 text-white border-gray-600'
                        : 'bg-gray-100 text-gray-900 border-gray-300'
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
                    <option value="PAYSTACK">Paystack</option>
                    <option value="SQUARE">Square</option>
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
                        ? 'bg-gray-700 text-white border-gray-600'
                        : 'bg-gray-100 text-gray-900 border-gray-300'
                    } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                  >
                    <option value="all">All Providers</option>
                    <option value="STRIPE">Stripe</option>
                    <option value="CASH">Cash</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="GIFT_CARD">Gift Card</option>
                    <option value="LOYALTY_POINTS">Loyalty Points</option>
                    <option value="PAYPAL">PayPal</option>
                    <option value="FLUTTERWAVE">Flutterwave</option>
                    <option value="PAYSTACK">Paystack</option>
                    <option value="SQUARE">Square</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Date From
                    </label>
                    <input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-lg text-sm ${
                        isDark
                          ? 'bg-gray-700 text-white border-gray-600'
                          : 'bg-gray-100 text-gray-900 border-gray-300'
                      } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Date To
                    </label>
                    <input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-lg text-sm ${
                        isDark
                          ? 'bg-gray-700 text-white border-gray-600'
                          : 'bg-gray-100 text-gray-900 border-gray-300'
                      } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
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
                    setDateRange('month');
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="text-sm text-danger-600 dark:text-danger-400 hover:text-danger-800 dark:hover:text-danger-300 transition duration-250 focus-ring"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow-soft">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                No payments found
              </h3>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Try adjusting your filters or search terms
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full">
                  <thead className={`border-b ${isDark ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200 bg-gray-50'}`}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-2xs font-medium uppercase tracking-wider eyebrow ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        Reference
                      </th>
                      <th className={`px-4 py-3 text-left text-2xs font-medium uppercase tracking-wider eyebrow ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        Date
                      </th>
                      <th className={`px-4 py-3 text-left text-2xs font-medium uppercase tracking-wider eyebrow ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        Customer
                      </th>
                      <th className={`px-4 py-3 text-right text-2xs font-medium uppercase tracking-wider eyebrow ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        Amount
                      </th>
                      <th className={`px-4 py-3 text-left text-2xs font-medium uppercase tracking-wider eyebrow ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        Method / Provider
                      </th>
                      <th className={`px-4 py-3 text-left text-2xs font-medium uppercase tracking-wider eyebrow ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        Status
                      </th>
                      <th className={`px-4 py-3 text-right text-2xs font-medium uppercase tracking-wider eyebrow ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                    {payments.map((payment) => {
                      const imageUrl = getProviderImageUrl(payment.provider || payment.gatewayId || '');

                      return (
                        <tr key={payment.id} className={`transition-colors duration-250 ${
                          isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                        }`}>
                          <td className="px-4 py-3">
                            <p className={`font-mono text-sm font-medium tabular-nums ${
                              isDark ? 'text-white' : 'text-gray-900'
                            }`}>
                              {payment.reference || `PAY-${payment.id.slice(0, 8)}`}
                            </p>
                            {payment.sale?.receiptNumber && (
                              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                Sale: {payment.sale.receiptNumber}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              {formatDate(payment.processedAt)}
                            </p>
                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                              {formatDateTime(payment.processedAt)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {getCustomerName(payment.user)}
                            </p>
                            {payment.user?.email && (
                              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {payment.user.email}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className={`text-sm font-bold tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {formatCurrency(payment.amount)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {imageUrl ? (
                                <div className="relative w-7 h-7 flex-shrink-0">
                                  <Image
                                    src={imageUrl}
                                    alt={getProviderName(payment.provider || payment.gatewayId || '')}
                                    width={28}
                                    height={28}
                                    className="rounded object-contain"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                      const parent = (e.target as HTMLImageElement).parentElement;
                                      if (parent) {
                                        const fallback = document.createElement('span');
                                        fallback.className = `text-base ${isDark ? 'text-gray-300' : 'text-gray-600'}`;
                                        fallback.textContent = '💳';
                                        parent.appendChild(fallback);
                                      }
                                    }}
                                  />
                                </div>
                              ) : (
                                getPaymentIcon(payment.paymentMethod)
                              )}
                              <div>
                                <span className={`text-sm capitalize ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {formatMethod(payment.paymentMethod)}
                                </span>
                                {payment.provider && (
                                  <span className={`text-xs block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {getProviderName(payment.provider)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-2xs font-medium rounded-full flex items-center gap-1 w-fit ${getStatusColor(payment.status)}`}>
                              {getStatusIcon(payment.status)}
                              {payment.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleViewReceipt(payment)}
                                className={`p-1.5 rounded-lg transition duration-250 focus-ring ${
                                  isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                                }`}
                                title="View receipt"
                                aria-label="View receipt"
                              >
                                <Receipt className="w-4 h-4 text-primary-500" />
                              </button>
                              <button
                                onClick={() => handleCopyReference(payment.reference || payment.id)}
                                className={`p-1.5 rounded-lg transition duration-250 focus-ring ${
                                  isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
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
                <div className={`px-4 py-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} flex flex-wrap items-center justify-between gap-3`}>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
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
                    })}
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
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

        {/* Receipt Modal */}
        {showReceiptModal && selectedPayment && (
          <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
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
                    items: [],
                  } : undefined,
                  customer: selectedPayment.user ? {
                    name: getCustomerName(selectedPayment.user),
                    email: getCustomerEmail(selectedPayment.user),
                    phone: selectedPayment.user.phone || '',
                  } : undefined,
                  businessUnit: getBusinessUnitData(selectedPayment.businessUnit),
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
