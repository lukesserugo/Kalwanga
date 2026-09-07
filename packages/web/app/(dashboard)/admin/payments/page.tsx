'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  CreditCard, Banknote, Wallet, Building, QrCode, Gift, Star,
  Search, Filter, RefreshCw, Loader2, Eye, Download,
  ChevronLeft, ChevronRight, Calendar, Clock, User,
  DollarSign, TrendingUp, TrendingDown, PieChart,
  BarChart3, FileText, Printer, Copy, CheckCircle,
  XCircle, AlertCircle, MoreVertical, ArrowUpRight,
  ArrowDownRight, Receipt, Shield, Lock, Zap,
  Sparkles, Users, ShoppingBag, Percent, Tag,
  Smartphone, Landmark, Settings, PlusCircle,
  ToggleLeft, ToggleRight, Globe, Check, X,
  Edit, Trash2, Save, RefreshCw as RefreshIcon,
  Power, PowerOff, HeartPulse, AlertTriangle
} from 'lucide-react';
import { usePermission } from '../../../../hooks/usePermission';
import { PermissionResource } from '../../../../types/enums';
import { paymentService, PaymentProvider, PaymentProviderStatus } from '../../../../services/paymentService';
import { formatCurrency, formatDate, formatDateTime } from '../../../../utils/formatters';
import { toast } from '../../../../utils/toast-manager';
import { useThemeStore } from '../../../stores/themeStore';
import { PaymentReceipt } from '../../../../components/payments/PaymentReceipt';

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
  cashRegisterId?: string;
  gatewayId?: string;
  provider?: string;
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

interface PaymentSummary {
  totalAmount: number;
  byMethod: Record<string, number>;
  count: number;
  averageAmount: number;
  totalRefunds: number;
  refundCount: number;
  netAmount: number;
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

// Provider status display helper
interface ProviderDisplay {
  id: string;
  name: string;
  code: string;
  icon: string;
  isActive: boolean;
  isHealthy: boolean;
  configured: boolean;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  description: string;
  transactionStats: {
    transactions24h: number;
    volume24h: number;
    transactions7d: number;
    volume7d: number;
    transactions30d: number;
    volume30d: number;
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
  PAYPAL: CreditCard,
  FLUTTERWAVE: Globe,
  PAYSTACK: CreditCard,
  SQUARE: CreditCard,
};

// EXACT PROVIDER LOGO URLs
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

// Dark mode versions
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

const PROVIDER_CONFIGS: Record<string, { icon: string; color: string; bgColor: string; borderColor: string; textColor: string; description: string }> = {
  STRIPE: {
    icon: '💳',
    color: 'blue',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-600 dark:text-blue-400',
    description: 'Credit and debit card payments via Stripe'
  },
  CASH: {
    icon: '💰',
    color: 'green',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    textColor: 'text-green-600 dark:text-green-400',
    description: 'Cash payments at the counter'
  },
  MOBILE_MONEY: {
    icon: '📱',
    color: 'purple',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    textColor: 'text-purple-600 dark:text-purple-400',
    description: 'Mobile money payments (M-Pesa, Airtel Money, etc.)'
  },
  BANK_TRANSFER: {
    icon: '🏦',
    color: 'indigo',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    description: 'Direct bank transfer payments'
  },
  GIFT_CARD: {
    icon: '🎁',
    color: 'pink',
    bgColor: 'bg-pink-50 dark:bg-pink-900/20',
    borderColor: 'border-pink-200 dark:border-pink-800',
    textColor: 'text-pink-600 dark:text-pink-400',
    description: 'Gift card redemptions'
  },
  LOYALTY_POINTS: {
    icon: '⭐',
    color: 'yellow',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    textColor: 'text-yellow-600 dark:text-yellow-400',
    description: 'Loyalty points redemptions'
  },
  PAYPAL: {
    icon: '💸',
    color: 'blue',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-600 dark:text-blue-400',
    description: 'PayPal wallet payments'
  },
  FLUTTERWAVE: {
    icon: '🌊',
    color: 'cyan',
    bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
    borderColor: 'border-cyan-200 dark:border-cyan-800',
    textColor: 'text-cyan-600 dark:text-cyan-400',
    description: 'Flutterwave payments (Cards, Mobile Money, Bank Transfer)'
  },
  PAYSTACK: {
    icon: '🔷',
    color: 'sky',
    bgColor: 'bg-sky-50 dark:bg-sky-900/20',
    borderColor: 'border-sky-200 dark:border-sky-800',
    textColor: 'text-sky-600 dark:text-sky-400',
    description: 'Paystack payments (Cards, Bank Transfer, USSD)'
  },
  SQUARE: {
    icon: '⬜',
    color: 'gray',
    bgColor: 'bg-gray-50 dark:bg-gray-800/50',
    borderColor: 'border-gray-200 dark:border-gray-700',
    textColor: 'text-gray-600 dark:text-gray-400',
    description: 'Square payments (Cards, Digital Wallet)'
  },
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminPaymentsPage() {
  const router = useRouter();
  const { canView, canManage, isLoading: permissionLoading } = usePermission();
  const { isDark } = useThemeStore();

  // State
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
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
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'>('month');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');

  // Provider Management State
  const [providers, setProviders] = useState<PaymentProviderStatus[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<PaymentProviderStatus | null>(null);
  const [providerFormData, setProviderFormData] = useState<Partial<PaymentProviderStatus>>({});
  const [savingProvider, setSavingProvider] = useState(false);
  const [showProviderToggle, setShowProviderToggle] = useState<string | null>(null);
  const [showProviderSettings, setShowProviderSettings] = useState<string | null>(null);

  const canViewPayments = canView(PermissionResource.PAYMENT) || canManage(PermissionResource.PAYMENT);
  const canManagePayments = canManage(PermissionResource.PAYMENT);

  // Load data
  useEffect(() => {
    if (canViewPayments) {
      loadPayments();
      loadSummary();
      loadProviders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewPayments, pagination.page, filters, dateRange, selectedProvider]);

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

      if (selectedProvider !== 'all') params.provider = selectedProvider;

      const response = await paymentService.getPayments(params);
      setPayments(response.data || []);
      setPagination({
        page: response.page || 1,
        total: response.total || 0,
        totalPages: response.totalPages || 1,
        limit: response.limit || 20,
      });
    } catch (error: any) {
      console.error('Failed to load payments:', error);
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadSummary = async () => {
    try {
      setLoadingSummary(true);
      const params: any = {};

      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.status && filters.status !== 'all') params.status = filters.status;
      if (filters.paymentMethod && filters.paymentMethod !== 'all') params.paymentMethod = filters.paymentMethod;
      if (filters.provider && filters.provider !== 'all') params.provider = filters.provider;
      if (filters.businessUnitId) params.businessUnitId = filters.businessUnitId;

      const response = await paymentService.getPaymentSummary(params);
      setSummary(response);
    } catch (error) {
      console.error('Failed to load summary:', error);
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadProviders = async () => {
    try {
      setLoadingProviders(true);
      const response = await paymentService.getPaymentProviders();
      if (response.success && response.data) {
        setProviders(response.data);
      } else {
        setProviders(getDefaultProviders());
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
      setProviders(getDefaultProviders());
    } finally {
      setLoadingProviders(false);
    }
  };

  const getDefaultProviders = (): PaymentProviderStatus[] => {
    return [
      {
        id: 'default_cash',
        provider: 'CASH',
        name: 'Cash',
        code: 'CASH',
        type: 'OFFLINE',
        isActive: true,
        isHealthy: true,
        configured: true,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Cash',
          type: 'OFFLINE',
          supportedCurrencies: ['USD', 'TZS', 'KES', 'UGX'],
          supportedMethods: ['CASH'],
          description: 'Pay with cash at the counter',
          icon: '💰',
          feePercentage: 0,
          feeFixed: 0,
        },
      },
      {
        id: 'default_stripe',
        provider: 'STRIPE',
        name: 'Stripe',
        code: 'STRIPE',
        type: 'ONLINE',
        isActive: true,
        isHealthy: true,
        configured: true,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Stripe',
          type: 'ONLINE',
          supportedCurrencies: ['USD', 'EUR', 'GBP'],
          supportedMethods: ['CREDIT_CARD', 'DEBIT_CARD'],
          description: 'Pay with credit card (Visa, Mastercard, Amex)',
          icon: '💳',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 2.9,
          feeFixed: 0.30,
        },
      },
      {
        id: 'default_mobile_money',
        provider: 'MOBILE_MONEY',
        name: 'Mobile Money',
        code: 'MOBILE_MONEY',
        type: 'ONLINE',
        isActive: true,
        isHealthy: true,
        configured: true,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Mobile Money',
          type: 'ONLINE',
          supportedCurrencies: ['TZS', 'KES', 'UGX', 'USD'],
          supportedMethods: ['MOBILE_MONEY'],
          description: 'M-Pesa, Tigo Pesa, Airtel Money',
          icon: '📱',
          minAmount: 1,
          maxAmount: 10000,
          feePercentage: 1.5,
          feeFixed: 0.10,
        },
      },
      {
        id: 'default_bank_transfer',
        provider: 'BANK_TRANSFER',
        name: 'Bank Transfer',
        code: 'BANK_TRANSFER',
        type: 'ONLINE',
        isActive: true,
        isHealthy: true,
        configured: true,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Bank Transfer',
          type: 'ONLINE',
          supportedCurrencies: ['USD', 'TZS', 'KES', 'UGX'],
          supportedMethods: ['BANK_TRANSFER'],
          description: 'Direct bank transfer',
          icon: '🏦',
          minAmount: 10,
          maxAmount: 1000000,
          feePercentage: 0,
          feeFixed: 0,
        },
      },
      {
        id: 'default_gift_card',
        provider: 'GIFT_CARD',
        name: 'Gift Card',
        code: 'GIFT_CARD',
        type: 'ONLINE',
        isActive: true,
        isHealthy: true,
        configured: true,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Gift Card',
          type: 'ONLINE',
          supportedCurrencies: ['USD'],
          supportedMethods: ['GIFT_CARD'],
          description: 'Redeem your gift card',
          icon: '🎁',
          minAmount: 1,
          maxAmount: 1000,
          feePercentage: 0,
          feeFixed: 0,
        },
      },
      {
        id: 'default_loyalty_points',
        provider: 'LOYALTY_POINTS',
        name: 'Loyalty Points',
        code: 'LOYALTY_POINTS',
        type: 'OFFLINE',
        isActive: true,
        isHealthy: true,
        configured: true,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Loyalty Points',
          type: 'OFFLINE',
          supportedCurrencies: ['USD'],
          supportedMethods: ['LOYALTY_POINTS'],
          description: 'Pay with your loyalty points',
          icon: '⭐',
          minAmount: 1,
          maxAmount: 1000,
          feePercentage: 0,
          feeFixed: 0,
        },
      },
      {
        id: 'default_paypal',
        provider: 'PAYPAL',
        name: 'PayPal',
        code: 'PAYPAL',
        type: 'ONLINE',
        isActive: false,
        isHealthy: true,
        configured: false,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'PayPal',
          type: 'ONLINE',
          supportedCurrencies: ['USD', 'EUR', 'GBP'],
          supportedMethods: ['PAYPAL'],
          description: 'Pay with PayPal',
          icon: '💸',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 3.5,
          feeFixed: 0.30,
        },
      },
      {
        id: 'default_flutterwave',
        provider: 'FLUTTERWAVE',
        name: 'Flutterwave',
        code: 'FLUTTERWAVE',
        type: 'ONLINE',
        isActive: false,
        isHealthy: true,
        configured: false,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Flutterwave',
          type: 'ONLINE',
          supportedCurrencies: ['NGN', 'GHS', 'KES', 'UGX', 'TZS', 'USD'],
          supportedMethods: ['FLUTTERWAVE'],
          description: 'Pay with Flutterwave (Cards, Mobile Money, Bank Transfer)',
          icon: '🌊',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 1.9,
          feeFixed: 0.20,
        },
      },
      {
        id: 'default_paystack',
        provider: 'PAYSTACK',
        name: 'Paystack',
        code: 'PAYSTACK',
        type: 'ONLINE',
        isActive: false,
        isHealthy: true,
        configured: false,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Paystack',
          type: 'ONLINE',
          supportedCurrencies: ['NGN', 'GHS', 'USD'],
          supportedMethods: ['PAYSTACK'],
          description: 'Pay with Paystack (Cards, Bank Transfer, USSD)',
          icon: '🔷',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 1.5,
          feeFixed: 0.20,
        },
      },
      {
        id: 'default_square',
        provider: 'SQUARE',
        name: 'Square',
        code: 'SQUARE',
        type: 'ONLINE',
        isActive: false,
        isHealthy: true,
        configured: false,
        transactions24h: 0,
        volume24h: 0,
        transactions7d: 0,
        volume7d: 0,
        transactions30d: 0,
        volume30d: 0,
        config: {
          name: 'Square',
          type: 'ONLINE',
          supportedCurrencies: ['USD', 'EUR', 'GBP'],
          supportedMethods: ['SQUARE'],
          description: 'Pay with Square (Cards, Digital Wallet)',
          icon: '⬜',
          minAmount: 1,
          maxAmount: 100000,
          feePercentage: 2.6,
          feeFixed: 0.30,
        },
      },
    ];
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPayments();
    await loadSummary();
    await loadProviders();
    toast.success('Data refreshed');
  };

  const handleRefund = async () => {
    if (!selectedPayment) return;

    if (refundAmount <= 0) {
      toast.error('Refund amount must be positive');
      return;
    }

    if (refundAmount > selectedPayment.amount) {
      toast.error('Refund amount cannot exceed payment amount');
      return;
    }

    setRefundLoading(true);
    try {
      const result = await paymentService.refundPayment(selectedPayment.id, {
        amount: refundAmount,
        reason: refundReason || 'Refund requested',
      });

      toast.success(`Refund of ${formatCurrency(refundAmount)} processed successfully`);
      setShowRefundModal(false);
      setSelectedPayment(null);
      await loadPayments();
      await loadSummary();
    } catch (error: any) {
      console.error('Refund failed:', error);
      toast.error(error?.message || 'Failed to process refund');
    } finally {
      setRefundLoading(false);
    }
  };

  // Provider Management Handlers
  const handleToggleProvider = async (providerId: string, currentStatus: boolean) => {
    try {
      const response = await paymentService.togglePaymentProvider(providerId, !currentStatus);
      if (response.success) {
        toast.success(`Provider ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
        await loadProviders();
      } else {
        toast.error(response.message || 'Failed to toggle provider');
      }
    } catch (error: any) {
      console.error('Failed to toggle provider:', error);
      toast.error(error?.message || 'Failed to toggle provider');
    }
  };

  const handleConfigureProvider = async (providerId: string, configData: any) => {
    try {
      const response = await paymentService.configurePaymentProvider(providerId, configData);
      if (response.success) {
        toast.success('Provider configured successfully');
        await loadProviders();
        setShowProviderSettings(null);
      } else {
        toast.error(response.message || 'Failed to configure provider');
      }
    } catch (error: any) {
      console.error('Failed to configure provider:', error);
      toast.error(error?.message || 'Failed to configure provider');
    }
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
    };
    return names[provider] || provider || 'N/A';
  };

  const getProviderConfig = (provider: string) => {
    return PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.STRIPE;
  };

  const getProviderImageUrl = (provider: string): string => {
    return isDark && PROVIDER_DARK_IMAGE_URLS[provider] 
      ? PROVIDER_DARK_IMAGE_URLS[provider] 
      : PROVIDER_IMAGE_URLS[provider] || '';
  };

  const getActiveProviders = () => {
    return providers.filter(p => p.isActive);
  };

  const getVisibleProviders = () => {
    return providers.filter(p => p.isActive && p.isHealthy);
  };

  // Helper functions for building receipt data
  const getCustomerName = (user?: { firstName: string; lastName: string }) => {
    if (!user) return 'N/A';
    return `${user.firstName} ${user.lastName}`;
  };

  const getCustomerEmail = (user?: { email: string }) => {
    return user?.email || '';
  };

  const getCustomerPhone = (user?: { phone?: string }) => {
    return user?.phone || '';
  };

  const getBusinessUnitData = (businessUnit?: Payment['businessUnit']) => {
    if (!businessUnit) return undefined;
    return {
      name: businessUnit.name,
      address: businessUnit.address || '',
      phone: businessUnit.phone || '',
      email: businessUnit.email || '',
    };
  };

  // Permission check
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
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view payments. Please contact your administrator.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Payment Management
          </h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Monitor and manage all payment transactions
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <button
            onClick={() => router.push('/admin/payments/export')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          {canManagePayments && (
            <>
              <button
                onClick={() => router.push('/admin/payments/settings')}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <button
                onClick={() => setShowProviderModal(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                Add Provider
              </button>
            </>
          )}
        </div>
      </div>

      {/* Provider Management Section */}
      {canManagePayments && (
        <div className={`p-4 rounded-xl mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Payment Providers
              </h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Manage available payment providers and their visibility to customers
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {getActiveProviders().length} Active
              </span>
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                / {providers.length} Total
              </span>
            </div>
          </div>

          {loadingProviders ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {providers.map((provider) => {
                const config = getProviderConfig(provider.provider);
                const isActive = provider.isActive && provider.isHealthy && provider.configured;
                const imageUrl = getProviderImageUrl(provider.provider);
                
                return (
                  <div
                    key={provider.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isActive
                        ? `${config.bgColor} ${config.borderColor}`
                        : isDark
                          ? 'bg-gray-700/30 border-gray-700'
                          : 'bg-gray-50 border-gray-200'
                    } ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/50'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {imageUrl ? (
                          <div className="relative w-10 h-10 flex-shrink-0">
                            <Image
                              src={imageUrl}
                              alt={provider.name}
                              width={40}
                              height={40}
                              className="rounded-lg object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const parent = (e.target as HTMLImageElement).parentElement;
                                if (parent) {
                                  const fallback = document.createElement('span');
                                  fallback.className = `text-2xl ${isDark ? 'text-gray-300' : 'text-gray-600'}`;
                                  fallback.textContent = config.icon;
                                  parent.appendChild(fallback);
                                }
                              }}
                            />
                          </div>
                        ) : (
                          <span className="text-2xl">{config.icon}</span>
                        )}
                        <div>
                          <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {provider.name}
                          </p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {provider.provider}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Status indicators */}
                        <div className="flex items-center gap-1">
                          {provider.isActive ? (
                            <span className="w-2 h-2 rounded-full bg-green-500" title="Active" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-gray-400" title="Inactive" />
                          )}
                          {provider.isHealthy ? (
                            <span className="w-2 h-2 rounded-full bg-green-500" title="Healthy" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-red-500" title="Unhealthy" />
                          )}
                          {provider.configured ? (
                            <span className="w-2 h-2 rounded-full bg-green-500" title="Configured" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-yellow-500" title="Not Configured" />
                          )}
                        </div>
                        {/* Toggle button */}
                        <button
                          onClick={() => handleToggleProvider(provider.id, provider.isActive)}
                          className={`p-1 rounded-lg transition ${
                            isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                          }`}
                          title={provider.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {provider.isActive ? (
                            <ToggleRight className="w-5 h-5 text-green-500" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} line-clamp-2`}>
                        {config.description}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          provider.type === 'ONLINE'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : provider.type === 'OFFLINE'
                              ? 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300'
                              : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                        }`}>
                          {provider.type}
                        </span>
                        {provider.isActive && provider.isHealthy && provider.configured ? (
                          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Live
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <X className="w-3 h-3" />
                            {!provider.isActive ? 'Inactive' : !provider.isHealthy ? 'Unhealthy' : 'Not Configured'}
                          </span>
                        )}
                      </div>
                      {canManagePayments && (
                        <button
                          onClick={() => setShowProviderSettings(provider.id)}
                          className={`p-1 rounded-lg transition ${
                            isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                          }`}
                          title="Configure provider"
                        >
                          <Settings className="w-4 h-4 text-gray-500" />
                        </button>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      <div className="text-center">
                        <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>24h</p>
                        <p className={`text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {provider.transactions24h}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>7d</p>
                        <p className={`text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {provider.transactions7d}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>30d</p>
                        <p className={`text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {provider.transactions30d}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: 'Total Revenue',
            value: formatCurrency(summary?.totalAmount || 0),
            icon: DollarSign,
            color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
            change: '+12.5%'
          },
          {
            label: 'Total Payments',
            value: summary?.count || 0,
            icon: CreditCard,
            color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
            change: '+8.3%'
          },
          {
            label: 'Average Amount',
            value: formatCurrency(summary?.averageAmount || 0),
            icon: BarChart3,
            color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
            change: '+5.2%'
          },
          {
            label: 'Net Amount',
            value: formatCurrency(summary?.netAmount || 0),
            icon: TrendingUp,
            color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
            change: summary?.netAmount && summary?.netAmount > 0 ? '+2.1%' : '-0.5%'
          }
        ].map((stat, index) => (
          <div key={index} className={`p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {stat.label}
                </p>
                <p className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {stat.value}
                </p>
                {stat.change && (
                  <div className="flex items-center gap-1 mt-2">
                    {stat.change.startsWith('+') ? (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    )}
                    <span className={`text-sm font-medium ${
                      stat.change.startsWith('+') ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {stat.change}
                    </span>
                    <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      vs previous period
                    </span>
                  </div>
                )}
              </div>
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Payment Methods Breakdown */}
      <div className={`p-4 rounded-xl mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
        <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Payment Methods Breakdown
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {summary?.byMethod && Object.entries(summary.byMethod).map(([method, amount]) => {
            const total = summary.totalAmount || 1;
            const percentage = (amount / total) * 100;
            return (
              <div key={method} className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-2">
                  {getPaymentIcon(method)}
                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {formatMethod(method)}
                  </span>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-sm">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                      {formatCurrency(amount)}
                    </span>
                    <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className={`p-4 rounded-xl mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
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
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className={`px-4 py-2 rounded-lg border text-sm ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
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
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${
              showFilters || (filters.status !== 'all' || filters.paymentMethod !== 'all' || filters.provider !== 'all' || filters.startDate || filters.endDate)
                ? 'bg-blue-600 text-white'
                : isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {(filters.status !== 'all' || filters.paymentMethod !== 'all' || filters.provider !== 'all' || filters.startDate || filters.endDate) && (
              <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">
                {(filters.status !== 'all' ? 1 : 0) + (filters.paymentMethod !== 'all' ? 1 : 0) + (filters.provider !== 'all' ? 1 : 0) + (filters.startDate ? 1 : 0) + (filters.endDate ? 1 : 0)}
              </span>
            )}
          </button>

          <button
            onClick={loadPayments}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
          >
            Apply
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                      ? 'bg-gray-700 text-white border-gray-600'
                      : 'bg-gray-100 text-gray-900 border-gray-300'
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
                  } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
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
                  } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
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
                  } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
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
                  setSelectedProvider('all');
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

      {/* Payments Table */}
      <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`border-b ${isDark ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200 bg-gray-50'}`}>
                  <tr>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Reference
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
                    <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Amount
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Method
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Provider
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
                  {payments.map((payment) => (
                    <tr key={payment.id} className={`transition-colors ${
                      isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                    }`}>
                      <td className="px-4 py-3">
                        <p className={`font-mono text-sm font-medium ${
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
                          {payment.user?.firstName} {payment.user?.lastName}
                        </p>
                        {payment.user?.email && (
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {payment.user.email}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {formatCurrency(payment.amount)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getPaymentIcon(payment.paymentMethod)}
                          <span className={`text-sm capitalize ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {formatMethod(payment.paymentMethod)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                          {getProviderName(payment.provider || payment.gatewayId || '')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 w-fit ${getStatusColor(payment.status)}`}>
                          {getStatusIcon(payment.status)}
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setSelectedPayment(payment);
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
                              setSelectedPayment(payment);
                              setShowReceiptModal(true);
                            }}
                            className={`p-1.5 rounded-lg transition ${
                              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                            }`}
                            title="View receipt"
                          >
                            <Receipt className="w-4 h-4 text-green-500" />
                          </button>
                          {canManagePayments && payment.status === 'PAID' && (
                            <button
                              onClick={() => {
                                setSelectedPayment(payment);
                                setRefundAmount(payment.amount);
                                setRefundReason('');
                                setShowRefundModal(true);
                              }}
                              className={`p-1.5 rounded-lg transition ${
                                isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                              }`}
                              title="Refund payment"
                            >
                              <ArrowDownRight className="w-4 h-4 text-orange-500" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(payment.reference || payment.id);
                              toast.success('Reference copied');
                            }}
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
                  ))}
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
      {showDetailModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-xl shadow-xl ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className={`sticky top-0 z-10 p-4 border-b ${
              isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
            } flex items-center justify-between`}>
              <div>
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Payment Details
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {selectedPayment.reference || `PAY-${selectedPayment.id.slice(0, 8)}`}
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
              {/* Status & Amount */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Amount</p>
                  <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {formatCurrency(selectedPayment.amount)}
                  </p>
                </div>
                <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Status</p>
                  <span className={`px-2 py-1 text-sm font-medium rounded-full inline-flex items-center gap-1 ${getStatusColor(selectedPayment.status)}`}>
                    {getStatusIcon(selectedPayment.status)}
                    {selectedPayment.status}
                  </span>
                </div>
              </div>

              {/* Payment Method & Provider */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Payment Method</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getPaymentIcon(selectedPayment.paymentMethod)}
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {formatMethod(selectedPayment.paymentMethod)}
                    </span>
                  </div>
                </div>
                <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Provider</p>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {getProviderName(selectedPayment.provider || selectedPayment.gatewayId || '')}
                  </p>
                  {selectedPayment.providerTransactionId && (
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      TXN: {selectedPayment.providerTransactionId}
                    </p>
                  )}
                </div>
              </div>

              {/* Customer Info */}
              {selectedPayment.user && (
                <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Customer</p>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {selectedPayment.user.firstName} {selectedPayment.user.lastName}
                  </p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {selectedPayment.user.email}
                  </p>
                </div>
              )}

              {/* Sale Info */}
              {selectedPayment.sale && (
                <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Sale</p>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Receipt: {selectedPayment.sale.receiptNumber}
                  </p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Total: {formatCurrency(selectedPayment.sale.total)}
                  </p>
                </div>
              )}

              {/* Refund Info */}
              {selectedPayment.refundedAt && (
                <div className={`p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800`}>
                  <p className={`text-sm font-medium text-orange-700 dark:text-orange-300`}>
                    Refunded
                  </p>
                  <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Refunded at: {formatDateTime(selectedPayment.refundedAt)}
                  </p>
                  {selectedPayment.refundReason && (
                    <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Reason: {selectedPayment.refundReason}
                    </p>
                  )}
                </div>
              )}

              {/* Notes */}
              {selectedPayment.notes && (
                <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Notes</p>
                  <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {selectedPayment.notes}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                {canManagePayments && selectedPayment.status === 'PAID' && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setRefundAmount(selectedPayment.amount);
                      setRefundReason('');
                      setShowRefundModal(true);
                    }}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <ArrowDownRight className="w-4 h-4" />
                    Refund Payment
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedPayment(selectedPayment);
                    setShowReceiptModal(true);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <Receipt className="w-4 h-4" />
                  View Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`max-w-md w-full rounded-xl shadow-xl ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between`}>
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Refund Payment
              </h3>
              <button
                onClick={() => setShowRefundModal(false)}
                className={`p-2 rounded-lg transition ${
                  isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Refund Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <input
                    type="number"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                    min={0}
                    max={selectedPayment.amount}
                    step={0.01}
                    className={`w-full pl-8 pr-4 py-2 border rounded-lg ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
                <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Max refund: {formatCurrency(selectedPayment.amount)}
                </p>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Reason (Optional)
                </label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  className={`w-full px-4 py-2 border rounded-lg ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder="Enter refund reason..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowRefundModal(false)}
                  className={`flex-1 px-4 py-2 border rounded-lg transition ${
                    isDark
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRefund}
                  disabled={refundLoading || refundAmount <= 0}
                  className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {refundLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ArrowDownRight className="w-4 h-4" />
                      Process Refund
                    </>
                  )}
                </button>
              </div>
            </div>
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
                  items: [],
                } : undefined,
                customer: selectedPayment.user ? {
                  name: getCustomerName(selectedPayment.user),
                  email: getCustomerEmail(selectedPayment.user),
                  phone: getCustomerPhone(selectedPayment.user),
                } : undefined,
                businessUnit: getBusinessUnitData(selectedPayment.businessUnit),
              }}
              onClose={() => setShowReceiptModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
