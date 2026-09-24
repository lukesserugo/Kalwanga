'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  CreditCard,
  Banknote,
  Wallet,
  Building,
  QrCode,
  Gift,
  Star,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Eye,
  Download,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  User,
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
  FileText,
  Printer,
  Copy,
  CheckCircle,
  XCircle,
  AlertCircle,
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Shield,
  Lock,
  Zap,
  Sparkles,
  Users,
  ShoppingBag,
  Percent,
  Tag,
  Smartphone,
  Landmark,
  Settings,
  PlusCircle,
  ToggleLeft,
  ToggleRight,
  Globe,
  Check,
  X,
  Edit,
  Trash2,
  Save,
  Power,
  PowerOff,
  HeartPulse,
  AlertTriangle,
} from 'lucide-react';
import { usePermission } from '../../../../hooks/usePermission';
import { PermissionResource } from '../../../../types/enums';
import {
  paymentService,
  PaymentProvider,
  type PaymentProviderStatus,
} from '../../../../services/paymentService';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from '../../../../utils/formatters';
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
  refundedAmount?: number;
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
  metadata?: Record<string, unknown>;
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

interface PaymentSummaryData {
  totalAmount: number;
  byMethod: Record<string, number>;
  count: number;
  averageAmount: number;
  totalRefunds: number;
  refundCount: number;
  netAmount: number;
}

interface PaymentFiltersState {
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
// CONSTANTS
// ============================================

const PAYMENT_STATUS_COLORS: Record<string, string> = {
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
  SQUARE: CreditCard,
};

// Working provider logo URLs. `FLUTTERWAVE` was pointing at a
// non-existent `.svg`; the `.png` below is the one that actually
// loads (matches every other component in this app).
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

const PROVIDER_CONFIGS: Record<
  string,
  {
    icon: string;
    color: string;
    bgColor: string;
    borderColor: string;
    textColor: string;
    description: string;
  }
> = {
  STRIPE: {
    icon: '💳',
    color: 'primary',
    bgColor: 'bg-primary-50 dark:bg-primary-900/20',
    borderColor: 'border-primary-200 dark:border-primary-800',
    textColor: 'text-primary-600 dark:text-primary-400',
    description: 'Credit and debit card payments via Stripe',
  },
  CASH: {
    icon: '💰',
    color: 'success',
    bgColor: 'bg-success-50 dark:bg-success-900/20',
    borderColor: 'border-success-200 dark:border-success-800',
    textColor: 'text-success-600 dark:text-success-400',
    description: 'Cash payments at the counter',
  },
  MOBILE_MONEY: {
    icon: '📱',
    color: 'secondary',
    bgColor: 'bg-secondary-50 dark:bg-secondary-900/20',
    borderColor: 'border-secondary-200 dark:border-secondary-800',
    textColor: 'text-secondary-600 dark:text-secondary-400',
    description:
      'Mobile money payments (M-Pesa, Airtel Money, etc.)',
  },
  BANK_TRANSFER: {
    icon: '🏦',
    color: 'indigo',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    description: 'Direct bank transfer payments',
  },
  GIFT_CARD: {
    icon: '🎁',
    color: 'brand',
    bgColor: 'bg-brand-50 dark:bg-brand-900/20',
    borderColor: 'border-brand-200 dark:border-brand-800',
    textColor: 'text-brand-600 dark:text-brand-400',
    description: 'Gift card redemptions',
  },
  LOYALTY_POINTS: {
    icon: '⭐',
    color: 'warning',
    bgColor: 'bg-warning-50 dark:bg-warning-900/20',
    borderColor: 'border-warning-200 dark:border-warning-800',
    textColor: 'text-warning-600 dark:text-warning-400',
    description: 'Loyalty points redemptions',
  },
  PAYPAL: {
    icon: '💸',
    color: 'primary',
    bgColor: 'bg-primary-50 dark:bg-primary-900/20',
    borderColor: 'border-primary-200 dark:border-primary-800',
    textColor: 'text-primary-600 dark:text-primary-400',
    description: 'PayPal wallet payments',
  },
  FLUTTERWAVE: {
    icon: '🌊',
    color: 'cyan',
    bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
    borderColor: 'border-cyan-200 dark:border-cyan-800',
    textColor: 'text-cyan-600 dark:text-cyan-400',
    description:
      'Flutterwave payments (Cards, Mobile Money, Bank Transfer)',
  },
  SQUARE: {
    icon: '⬜',
    color: 'gray',
    bgColor: 'bg-gray-50 dark:bg-gray-800/50',
    borderColor: 'border-gray-200 dark:border-gray-700',
    textColor: 'text-gray-600 dark:text-gray-400',
    description: 'Square payments (Cards, Digital Wallet)',
  },
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
  MTN: 'MTN',
  AIRTEL: 'Airtel',
  TIGO: 'Tigo',
  VODAFONE: 'Vodafone',
};

// The backend auto-seeds these on first call, so this list is only a
// fallback for the very first paint (or when the API is unreachable).
const DEFAULT_PROVIDERS: PaymentProviderStatus[] = [
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
      feeFixed: 0.3,
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
      feeFixed: 0.1,
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
      feeFixed: 0.3,
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
      description:
        'Pay with Flutterwave (Cards, Mobile Money, Bank Transfer)',
      icon: '🌊',
      minAmount: 1,
      maxAmount: 100000,
      feePercentage: 1.9,
      feeFixed: 0.2,
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
      feeFixed: 0.3,
    },
  },
];

// ============================================
// HELPERS
// ============================================

/**
 * Resolve the provider name from a payment. Prefers the legacy
 * top-level field, falls back to `metadata.provider` (where the
 * backend actually writes it), then to `gatewayId`.
 */
function resolveProvider(payment: Payment): string | undefined {
  if (payment.provider) return payment.provider;
  const meta = payment.metadata ?? {};
  const metaProvider =
    typeof meta.provider === 'string' ? meta.provider : undefined;
  return metaProvider || payment.gatewayId || undefined;
}

/**
 * Compute the `startDate` / `endDate` params for a named date range.
 * Kept outside the component so it doesn't need `useCallback`.
 */
function buildDateRangeParams(
  range: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom',
): { startDate?: string; endDate?: string } {
  if (range === 'custom') return {};
  const now = new Date();
  const start = new Date(now);

  switch (range) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    case 'week':
      start.setDate(start.getDate() - 7);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    case 'month':
      start.setMonth(start.getMonth() - 1);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    case 'quarter':
      start.setMonth(start.getMonth() - 3);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    default:
      return {};
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminPaymentsPage() {
  const router = useRouter();
  const { canView, canManage, isLoading: permissionLoading } =
    usePermission();
  const { isDark } = useThemeStore();

  // Payments state
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<PaymentSummaryData | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 20,
  });
  const [filters, setFilters] = useState<PaymentFiltersState>({
    status: 'all',
    paymentMethod: 'all',
    provider: 'all',
    startDate: '',
    endDate: '',
  });
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(
    null,
  );
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [dateRange, setDateRange] = useState<
    'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
  >('month');

  // Providers state
  const [providers, setProviders] = useState<PaymentProviderStatus[]>(
    DEFAULT_PROVIDERS,
  );
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [editingProvider, setEditingProvider] =
    useState<PaymentProviderStatus | null>(null);
  const [providerFormData, setProviderFormData] = useState<
    Partial<PaymentProviderStatus>
  >({});
  const [savingProvider, setSavingProvider] = useState(false);
  const [showProviderSettings, setShowProviderSettings] = useState<
    string | null
  >(null);
  const [providerError, setProviderError] = useState<string | null>(null);

  const canViewPayments =
    canView(PermissionResource.PAYMENT) ||
    canManage(PermissionResource.PAYMENT);
  const canManagePayments = canManage(PermissionResource.PAYMENT);

  // ============================================
  // DATA LOADERS
  // ============================================

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
      setProviderError(null);

      const params: Record<string, unknown> = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (filters.status && filters.status !== 'all')
        params.status = filters.status;
      if (filters.paymentMethod && filters.paymentMethod !== 'all')
        params.paymentMethod = filters.paymentMethod;
      if (filters.provider && filters.provider !== 'all')
        params.provider = filters.provider;
      if (filters.businessUnitId)
        params.businessUnitId = filters.businessUnitId;
      if (search) params.search = search;

      // Custom date range overrides the preset range. Only one of
      // the two is ever sent, so the backend sees a single source.
      if (filters.startDate || filters.endDate) {
        if (filters.startDate) params.startDate = filters.startDate;
        if (filters.endDate) params.endDate = filters.endDate;
      } else {
        const range = buildDateRangeParams(dateRange);
        if (range.startDate) params.startDate = range.startDate;
        if (range.endDate) params.endDate = range.endDate;
      }

      const response = await paymentService.getPayments(params);

      // Prefer the canonical `pagination` shape, fall back to the
      // legacy flattened fields.
      const items: Payment[] = Array.isArray(response.data)
        ? (response.data as unknown as Payment[])
        : [];
      setPayments(items);

      const paginationData =
        (response as any).pagination ??
        ({
          total: response.total,
          page: response.page,
          totalPages: response.totalPages,
          limit: response.limit,
        } as const);

      // Functional update so we never clobber a concurrent page
      // change with a stale snapshot.
      setPagination((prev) => ({
        ...prev,
        page: paginationData.page || prev.page,
        total: paginationData.total || 0,
        totalPages: paginationData.totalPages || 1,
        limit: paginationData.limit || prev.limit,
      }));
    } catch (error: any) {
      console.error('Failed to load payments:', error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load payments';
      toast.error(errorMessage);
      setProviderError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    filters.status,
    filters.paymentMethod,
    filters.provider,
    filters.startDate,
    filters.endDate,
    filters.businessUnitId,
    search,
    dateRange,
  ]);

  const loadSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      const params: Record<string, unknown> = {};

      if (filters.startDate || filters.endDate) {
        if (filters.startDate) params.startDate = filters.startDate;
        if (filters.endDate) params.endDate = filters.endDate;
      } else {
        const range = buildDateRangeParams(dateRange);
        if (range.startDate) params.startDate = range.startDate;
        if (range.endDate) params.endDate = range.endDate;
      }

      if (filters.status && filters.status !== 'all')
        params.status = filters.status;
      if (filters.paymentMethod && filters.paymentMethod !== 'all')
        params.paymentMethod = filters.paymentMethod;
      if (filters.provider && filters.provider !== 'all')
        params.provider = filters.provider;
      if (filters.businessUnitId)
        params.businessUnitId = filters.businessUnitId;

      const data = await paymentService.getPaymentSummary(params);
      setSummary(data as PaymentSummaryData);
    } catch (error: any) {
      console.error('Failed to load summary:', error);
      setSummary({
        totalAmount: 0,
        byMethod: {},
        count: 0,
        averageAmount: 0,
        totalRefunds: 0,
        refundCount: 0,
        netAmount: 0,
      });
      if (error?.response?.status !== 404) {
        toast.error('Failed to load payment summary');
      }
    } finally {
      setLoadingSummary(false);
    }
  }, [
    filters.status,
    filters.paymentMethod,
    filters.provider,
    filters.startDate,
    filters.endDate,
    filters.businessUnitId,
    dateRange,
  ]);

  const loadProviders = useCallback(async () => {
    try {
      setLoadingProviders(true);
      const response = await paymentService.getPaymentProviders();
      if (
        response?.success &&
        Array.isArray(response.data) &&
        response.data.length > 0
      ) {
        setProviders(response.data);
      } else {
        setProviders(DEFAULT_PROVIDERS);
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
      setProviders(DEFAULT_PROVIDERS);
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  // Load on mount and whenever a scalar filter changes. Individual
  // dependencies (not the `filters` object) so typing in the search
  // box doesn't trigger a refetch until Enter or Apply.
  useEffect(() => {
    if (!canViewPayments) return;
    void loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canViewPayments,
    pagination.page,
    pagination.limit,
    filters.status,
    filters.paymentMethod,
    filters.provider,
    filters.startDate,
    filters.endDate,
    filters.businessUnitId,
    dateRange,
  ]);

  useEffect(() => {
    if (!canViewPayments) return;
    void loadSummary();
  }, [canViewPayments, loadSummary]);

  useEffect(() => {
    if (!canViewPayments) return;
    void loadProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewPayments]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setProviderError(null);
    await Promise.all([loadPayments(), loadSummary(), loadProviders()]);
    toast.success('Data refreshed successfully');
  }, [loadPayments, loadSummary, loadProviders]);

  const handleRefund = useCallback(async () => {
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
    setProviderError(null);
    try {
      const result = await paymentService.refundPayment(
        selectedPayment.id,
        {
          amount: refundAmount,
          reason: refundReason || 'Refund requested',
        },
      );

      // Use the backend's echoed amount if present, otherwise the
      // local value. They should be equal, but the backend is the
      // source of truth.
      const refunded =
        (result as any)?.refundedAmount ?? refundAmount;
      toast.success(
        `Refund of ${formatCurrency(refunded)} processed successfully`,
      );

      setShowRefundModal(false);
      setSelectedPayment(null);
      setRefundAmount(0);
      setRefundReason('');
      await Promise.all([loadPayments(), loadSummary()]);
    } catch (error: any) {
      console.error('Refund failed:', error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to process refund';
      toast.error(errorMessage);
      setProviderError(errorMessage);
    } finally {
      setRefundLoading(false);
    }
  }, [
    selectedPayment,
    refundAmount,
    refundReason,
    loadPayments,
    loadSummary,
  ]);

  const handleToggleProvider = useCallback(
    async (providerId: string, currentStatus: boolean) => {
      try {
        setProviderError(null);

        if (providerId.startsWith('default_')) {
          toast.info(
            'Default providers cannot be toggled. Please create a provider in the database first.',
          );
          return;
        }

        // Optimistic flip.
        setProviders((prev) =>
          prev.map((p) =>
            p.id === providerId ? { ...p, isActive: !currentStatus } : p,
          ),
        );

        const response = await paymentService.togglePaymentProvider(
          providerId,
          !currentStatus,
        );

        if (response?.success) {
          toast.success(
            `Provider ${
              !currentStatus ? 'activated' : 'deactivated'
            } successfully`,
          );
          await loadProviders();
        } else {
          // Roll back.
          setProviders((prev) =>
            prev.map((p) =>
              p.id === providerId ? { ...p, isActive: currentStatus } : p,
            ),
          );
          toast.error(response?.message || 'Failed to toggle provider');
        }
      } catch (error: any) {
        console.error('Failed to toggle provider:', error);
        setProviders((prev) =>
          prev.map((p) =>
            p.id === providerId ? { ...p, isActive: currentStatus } : p,
          ),
        );
        const errorMessage =
          error?.response?.data?.message ||
          error?.message ||
          'Failed to toggle provider';
        toast.error(errorMessage);
        setProviderError(errorMessage);
      }
    },
    [loadProviders],
  );

  const isProviderConfigurable = useCallback(
    (provider: PaymentProviderStatus) => {
      return (
        !provider.id?.startsWith('default_') &&
        provider.configured !== undefined
      );
    },
    [],
  );

  const handleConfigureProvider = useCallback(
    async (providerId: string, configData: any) => {
      try {
        setProviderError(null);

        if (providerId.startsWith('default_')) {
          toast.info(
            'Default providers cannot be configured. Please create a provider in the database first.',
          );
          return;
        }

        const response = await paymentService.configurePaymentProvider(
          providerId,
          configData,
        );

        if (response?.success) {
          toast.success('Provider configured successfully');
          await loadProviders();
          setShowProviderSettings(null);
        } else {
          toast.error(response?.message || 'Failed to configure provider');
        }
      } catch (error: any) {
        console.error('Failed to configure provider:', error);
        const errorMessage =
          error?.response?.data?.message ||
          error?.message ||
          'Failed to configure provider';
        toast.error(errorMessage);
        setProviderError(errorMessage);
      }
    },
    [loadProviders],
  );

  const clearFilters = useCallback(() => {
    setFilters({
      status: 'all',
      paymentMethod: 'all',
      provider: 'all',
      startDate: '',
      endDate: '',
    });
    setSearch('');
    setDateRange('month');
    setPagination((prev) => ({ ...prev, page: 1 }));
    setShowFilters(false);
  }, []);

  const goToPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  const copyReference = useCallback((reference: string) => {
    navigator.clipboard
      .writeText(reference)
      .then(() => {
        toast.success('Reference copied to clipboard');
      })
      .catch(() => {
        toast.error('Failed to copy reference');
      });
  }, []);

  const handleSearch = useCallback(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  // ============================================
  // UI HELPERS
  // ============================================

  const getStatusColor = useCallback((status: string) => {
    return (
      PAYMENT_STATUS_COLORS[status] ||
      'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300'
    );
  }, []);

  const getPaymentIcon = useCallback((method: string) => {
    const Icon = PAYMENT_METHOD_ICONS[method] || CreditCard;
    return <Icon className="w-5 h-5" />;
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

  const formatMethod = useCallback((method: string) => {
    return method?.toLowerCase().replace(/_/g, ' ') || 'unknown';
  }, []);

  const getProviderName = useCallback((provider?: string): string => {
    if (!provider) return 'N/A';
    return PROVIDER_NAMES[provider] || provider;
  }, []);

  const getProviderConfig = useCallback((provider: string) => {
    return PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.STRIPE;
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

  const getActiveProviders = useCallback(() => {
    return providers.filter((p) => p.isActive);
  }, [providers]);

  const getCustomerName = useCallback(
    (user?: { firstName: string; lastName: string }) => {
      if (!user) return 'N/A';
      return (
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A'
      );
    },
    [],
  );

  const getCustomerEmail = useCallback((user?: { email: string }) => {
    return user?.email || '';
  }, []);

  const getCustomerPhone = useCallback(
    (user?: { phone?: string }) => {
      return user?.phone || '';
    },
    [],
  );

  const getBusinessUnitData = useCallback(
    (businessUnit?: Payment['businessUnit']) => {
      if (!businessUnit) return undefined;
      return {
        name: businessUnit.name || '',
        address: businessUnit.address || '',
        phone: businessUnit.phone || '',
        email: businessUnit.email || '',
      };
    },
    [],
  );

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderMethodBreakdown = useCallback(() => {
    if (
      !summary?.byMethod ||
      Object.keys(summary.byMethod).length === 0
    ) {
      return (
        <div
          className={`text-center py-4 ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          No payment method data available
        </div>
      );
    }

    const total = summary.totalAmount || 1;
    return Object.entries(summary.byMethod).map(([method, amount]) => {
      const numericAmount = typeof amount === 'number' ? amount : 0;
      const percentage = (numericAmount / total) * 100;
      return (
        <div
          key={method}
          className={`p-3 rounded-xl ${
            isDark ? 'bg-gray-700/30' : 'bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2">
            {getPaymentIcon(method)}
            <span
              className={`text-sm font-medium ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              {formatMethod(method)}
            </span>
          </div>
          <div className="mt-2">
            <div className="flex justify-between text-sm">
              <span
                className={isDark ? 'text-gray-400' : 'text-gray-500'}
              >
                {formatCurrency(numericAmount)}
              </span>
              <span
                className={isDark ? 'text-gray-300' : 'text-gray-700'}
              >
                {percentage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
              <div
                className="bg-brand-gradient h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          </div>
        </div>
      );
    });
  }, [summary, isDark, getPaymentIcon, formatMethod]);

  const renderPagination = useCallback(() => {
    if (pagination.totalPages <= 1) return null;

    const pages: number[] = [];
    const maxVisible = 5;
    let startPage = 1;
    let endPage = pagination.totalPages;

    if (pagination.totalPages > maxVisible) {
      if (pagination.page <= 3) {
        startPage = 1;
        endPage = maxVisible;
      } else if (pagination.page >= pagination.totalPages - 2) {
        startPage = pagination.totalPages - maxVisible + 1;
        endPage = pagination.totalPages;
      } else {
        startPage = pagination.page - 2;
        endPage = pagination.page + 2;
      }
    }

    for (let i = startPage; i <= endPage; i++) pages.push(i);

    return (
      <div className="flex gap-1">
        <button
          onClick={() => goToPage(pagination.page - 1)}
          disabled={pagination.page === 1}
          className={`px-3 py-1 rounded-lg text-sm transition duration-250 disabled:opacity-50 disabled:cursor-not-allowed focus-ring ${
            isDark
              ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
              : 'border-gray-300 text-gray-600 hover:bg-gray-100'
          } border`}
        >
          <ChevronLeft className="w-4 h-4 inline" />
          Previous
        </button>
        {pages.map((pageNum) => (
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
        ))}
        <button
          onClick={() => goToPage(pagination.page + 1)}
          disabled={pagination.page === pagination.totalPages}
          className={`px-3 py-1 rounded-lg text-sm transition duration-250 disabled:opacity-50 disabled:cursor-not-allowed focus-ring ${
            isDark
              ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
              : 'border-gray-300 text-gray-600 hover:bg-gray-100'
          } border`}
        >
          Next
          <ChevronRight className="w-4 h-4 inline" />
        </button>
      </div>
    );
  }, [pagination, isDark, goToPage]);

  // ============================================
  // PERMISSION GATE
  // ============================================

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
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view payments. Please contact your
          administrator.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 btn-brand"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div
      className={`min-h-screen p-4 md:p-6 ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}
    >
      {/* Error banner */}
      {providerError && (
        <div className="mb-4 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl flex items-start gap-3 animate-slide-down">
          <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-danger-700 dark:text-danger-300 font-medium">
              Error loading data
            </p>
            <p className="text-sm text-danger-600 dark:text-danger-400">
              {providerError}
            </p>
          </div>
          <button
            onClick={() => setProviderError(null)}
            className="p-1 hover:bg-danger-100 dark:hover:bg-danger-800/30 rounded-lg transition duration-250 focus-ring"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4 text-danger-600 dark:text-danger-400" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1
            className={`text-2xl font-bold ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            Payment Management
          </h1>
          <p
            className={`text-sm ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            Monitor and manage all payment transactions
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`p-2 rounded-lg transition duration-250 focus-ring ${
              isDark
                ? 'bg-gray-800 hover:bg-gray-700 text-white'
                : 'bg-white hover:bg-gray-100 text-gray-700'
            } border ${
              isDark ? 'border-gray-700' : 'border-gray-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            aria-label="Refresh data"
          >
            <RefreshCw
              className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            onClick={() => router.push('/admin/payments/export')}
            className="btn-brand"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          {canManagePayments && (
            <>
              <button
                onClick={() => router.push('/admin/payments/settings')}
                className="btn-secondary"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <button
                onClick={() => setShowProviderModal(true)}
                className="btn-success"
              >
                <PlusCircle className="w-4 h-4" />
                Add Provider
              </button>
            </>
          )}
        </div>
      </div>

      {/* Provider management section */}
      {canManagePayments && (
        <div className="card-brand mb-6 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2
                className={`text-lg font-semibold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                Payment Providers
              </h2>
              <p
                className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                Manage available payment providers and their visibility
                to customers
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                {getActiveProviders().length} Active
              </span>
              <span
                className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                / {providers.length} Total
              </span>
            </div>
          </div>

          {loadingProviders ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {providers.map((provider) => {
                const config = getProviderConfig(provider.provider);
                const isActive =
                  provider.isActive &&
                  provider.isHealthy &&
                  provider.configured;
                const imageUrl = getProviderImageUrl(provider.provider);
                const isDefault = provider.id?.startsWith('default_');

                return (
                  <div
                    key={provider.id ?? provider.provider}
                    className={`p-4 rounded-xl border transition-all duration-250 ${
                      isActive
                        ? `${config.bgColor} ${config.borderColor}`
                        : isDark
                          ? 'bg-gray-700/30 border-gray-700'
                          : 'bg-gray-50 border-gray-200'
                    } ${
                      isDark
                        ? 'hover:bg-gray-700/50'
                        : 'hover:bg-gray-100/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        {imageUrl ? (
                          <div className="relative w-10 h-10 flex-shrink-0">
                            <Image
                              src={imageUrl}
                              alt={
                                provider.name ||
                                provider.provider ||
                                'Payment provider'
                              }
                              width={40}
                              height={40}
                              style={{ width: 'auto', height: 'auto' }}
                              className="rounded-lg object-contain max-w-[40px] max-h-[40px]"
                              onError={(e) => {
                                const target =
                                  e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  const fallback =
                                    document.createElement('span');
                                  fallback.className = `text-2xl ${
                                    isDark
                                      ? 'text-gray-300'
                                      : 'text-gray-600'
                                  }`;
                                  fallback.textContent = config.icon;
                                  parent.appendChild(fallback);
                                }
                              }}
                            />
                          </div>
                        ) : (
                          <span className="text-2xl">{config.icon}</span>
                        )}
                        <div className="min-w-0">
                          <p
                            className={`font-medium ${
                              isDark ? 'text-white' : 'text-gray-900'
                            } truncate`}
                          >
                            {provider.name ||
                              provider.provider ||
                              'Unknown'}
                          </p>
                          <p
                            className={`text-xs ${
                              isDark ? 'text-gray-400' : 'text-gray-500'
                            } truncate`}
                          >
                            {provider.provider || ''}
                            {isDefault && (
                              <span
                                className="ml-1 text-warning-500 dark:text-warning-400"
                                title="Default provider - needs database setup"
                              >
                                ⚠️
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div
                          className="flex items-center gap-1"
                          title={`Active: ${provider.isActive}, Healthy: ${provider.isHealthy}, Configured: ${provider.configured}`}
                        >
                          {provider.isActive ? (
                            <span
                              className="w-2 h-2 rounded-full bg-success-500"
                              title="Active"
                            />
                          ) : (
                            <span
                              className="w-2 h-2 rounded-full bg-gray-400"
                              title="Inactive"
                            />
                          )}
                          {provider.isHealthy ? (
                            <span
                              className="w-2 h-2 rounded-full bg-success-500"
                              title="Healthy"
                            />
                          ) : (
                            <span
                              className="w-2 h-2 rounded-full bg-danger-500"
                              title="Unhealthy"
                            />
                          )}
                          {provider.configured ? (
                            <span
                              className="w-2 h-2 rounded-full bg-success-500"
                              title="Configured"
                            />
                          ) : (
                            <span
                              className="w-2 h-2 rounded-full bg-warning-500"
                              title="Not Configured"
                            />
                          )}
                        </div>
                        <button
                          onClick={() =>
                            handleToggleProvider(
                              provider.id!,
                              provider.isActive,
                            )
                          }
                          className={`p-1 rounded-lg transition duration-250 focus-ring ${
                            isDark
                              ? 'hover:bg-gray-600'
                              : 'hover:bg-gray-200'
                          }`}
                          title={
                            provider.isActive ? 'Deactivate' : 'Activate'
                          }
                          aria-label={
                            provider.isActive
                              ? 'Deactivate provider'
                              : 'Activate provider'
                          }
                          disabled={isDefault}
                        >
                          {provider.isActive ? (
                            <ToggleRight className="w-5 h-5 text-success-500" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p
                        className={`text-xs ${
                          isDark ? 'text-gray-400' : 'text-gray-500'
                        } line-clamp-2`}
                      >
                        {config.description}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-2xs px-2 py-0.5 rounded-full ${
                            provider.type === 'ONLINE'
                              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                              : provider.type === 'OFFLINE'
                                ? 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300'
                                : 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300'
                          }`}
                        >
                          {provider.type}
                        </span>
                        {provider.isActive &&
                        provider.isHealthy &&
                        provider.configured ? (
                          <span className="text-2xs text-success-600 dark:text-success-400 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Live
                          </span>
                        ) : (
                          <span className="text-2xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <X className="w-3 h-3" />
                            {!provider.isActive
                              ? 'Inactive'
                              : !provider.isHealthy
                                ? 'Unhealthy'
                                : 'Not Configured'}
                          </span>
                        )}
                      </div>
                      {canManagePayments &&
                        isProviderConfigurable(provider) && (
                          <button
                            onClick={() =>
                              setShowProviderSettings(
                                provider.id === showProviderSettings
                                  ? null
                                  : provider.id ?? null,
                              )
                            }
                            className={`p-1 rounded-lg transition duration-250 focus-ring ${
                              isDark
                                ? 'hover:bg-gray-600'
                                : 'hover:bg-gray-200'
                            }`}
                            title="Configure provider"
                            aria-label="Configure provider"
                          >
                            <Settings className="w-4 h-4 text-gray-500" />
                          </button>
                        )}
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-1">
                      <div className="text-center">
                        <p
                          className={`text-2xs font-medium ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}
                        >
                          24h
                        </p>
                        <p
                          className={`text-2xs tabular-nums ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}
                        >
                          {provider.transactions24h || 0}
                        </p>
                      </div>
                      <div className="text-center">
                        <p
                          className={`text-2xs font-medium ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}
                        >
                          7d
                        </p>
                        <p
                          className={`text-2xs tabular-nums ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}
                        >
                          {provider.transactions7d || 0}
                        </p>
                      </div>
                      <div className="text-center">
                        <p
                          className={`text-2xs font-medium ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}
                        >
                          30d
                        </p>
                        <p
                          className={`text-2xs tabular-nums ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}
                        >
                          {provider.transactions30d || 0}
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

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: 'Total Revenue',
            value: formatCurrency(summary?.totalAmount || 0),
            icon: DollarSign,
            color:
              'bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-400',
          },
          {
            label: 'Total Payments',
            value: summary?.count || 0,
            icon: CreditCard,
            color:
              'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400',
          },
          {
            label: 'Average Amount',
            value: formatCurrency(summary?.averageAmount || 0),
            icon: BarChart3,
            color:
              'bg-secondary-100 text-secondary-600 dark:bg-secondary-900/30 dark:text-secondary-400',
          },
          {
            label: 'Net Amount',
            value: formatCurrency(summary?.netAmount || 0),
            icon: TrendingUp,
            color:
              'bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400',
          },
        ].map((stat, index) => (
          <div key={index} className="card-brand shadow-soft">
            <div className="flex items-start justify-between">
              <div>
                <p
                  className={`text-sm font-medium ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  {stat.label}
                </p>
                {loadingSummary ? (
                  <div className="mt-2">
                    <div
                      className={`h-8 w-24 rounded animate-pulse ${
                        isDark ? 'bg-gray-700' : 'bg-gray-200'
                      }`}
                    />
                  </div>
                ) : (
                  <p
                    className={`text-xl sm:text-2xl font-bold mt-2 tabular-nums ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {stat.value}
                  </p>
                )}
              </div>
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Payment methods breakdown */}
      <div className="card-brand mb-6">
        <h2
          className={`text-lg font-semibold mb-4 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          Payment Methods Breakdown
        </h2>
        {loadingSummary ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {renderMethodBreakdown()}
          </div>
        )}
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
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
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
            className={`px-3 py-2 rounded-lg border text-sm ${
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
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition duration-250 whitespace-nowrap focus-ring ${
              showFilters ||
              filters.status !== 'all' ||
              filters.paymentMethod !== 'all' ||
              filters.provider !== 'all' ||
              filters.startDate ||
              filters.endDate
                ? 'bg-brand-gradient text-white'
                : isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            aria-expanded={showFilters}
          >
            <Filter className="w-4 h-4" />
            Filters
            {(filters.status !== 'all' ||
              filters.paymentMethod !== 'all' ||
              filters.provider !== 'all' ||
              filters.startDate ||
              filters.endDate) && (
              <span className="w-5 h-5 rounded-full bg-white/20 text-white text-xs flex items-center justify-center">
                {(filters.status !== 'all' ? 1 : 0) +
                  (filters.paymentMethod !== 'all' ? 1 : 0) +
                  (filters.provider !== 'all' ? 1 : 0) +
                  (filters.startDate ? 1 : 0) +
                  (filters.endDate ? 1 : 0)}
              </span>
            )}
          </button>

          <button onClick={handleSearch} className="btn-brand">
            Apply
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 animate-slide-down">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
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
                  <option value="SQUARE">Square</option>
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
                  value={filters.startDate || ''}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                    }))
                  }
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
                  value={filters.endDate || ''}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      endDate: e.target.value,
                    }))
                  }
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
                onClick={clearFilters}
                className="text-sm text-danger-600 dark:text-danger-400 hover:text-danger-800 dark:hover:text-danger-300 transition duration-250 focus-ring"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payments table */}
      <div
        className={`rounded-2xl overflow-hidden ${
          isDark ? 'bg-gray-800' : 'bg-white'
        } shadow-soft`}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3
              className={`text-lg font-medium ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              No payments found
            </h3>
            <p
              className={`text-sm mt-1 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              Try adjusting your filters or search terms
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[800px]">
                <thead
                  className={`border-b ${
                    isDark
                      ? 'border-gray-700 bg-gray-700/30'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <tr>
                    {[
                      'Reference',
                      'Date',
                      'Customer',
                      'Amount',
                      'Method',
                      'Provider',
                      'Status',
                      'Actions',
                    ].map((header, i) => (
                      <th
                        key={header}
                        className={`px-3 py-3 text-${
                          i === 3 || i === 7 ? 'right' : 'left'
                        } text-xs font-medium uppercase tracking-wider eyebrow ${
                          isDark ? 'text-gray-400' : 'text-gray-500'
                        }`}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody
                  className={`divide-y ${
                    isDark ? 'divide-gray-700' : 'divide-gray-200'
                  }`}
                >
                  {payments.map((payment) => {
                    const resolvedProvider = resolveProvider(payment);
                    return (
                      <tr
                        key={payment.id}
                        className={`transition-colors duration-250 ${
                          isDark
                            ? 'hover:bg-gray-700/50'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-3 py-3">
                          <p
                            className={`font-mono text-sm font-medium tabular-nums ${
                              isDark ? 'text-white' : 'text-gray-900'
                            }`}
                          >
                            {payment.reference ||
                              `PAY-${payment.id.slice(0, 8)}`}
                          </p>
                          {payment.sale?.receiptNumber && (
                            <p
                              className={`text-xs ${
                                isDark
                                  ? 'text-gray-400'
                                  : 'text-gray-500'
                              }`}
                            >
                              Sale: {payment.sale.receiptNumber}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <p
                            className={`text-sm ${
                              isDark ? 'text-gray-300' : 'text-gray-700'
                            }`}
                          >
                            {formatDate(payment.processedAt)}
                          </p>
                          <p
                            className={`text-xs ${
                              isDark ? 'text-gray-500' : 'text-gray-400'
                            }`}
                          >
                            {formatDateTime(payment.processedAt)}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <p
                            className={`text-sm ${
                              isDark ? 'text-white' : 'text-gray-900'
                            }`}
                          >
                            {payment.user?.firstName || ''}{' '}
                            {payment.user?.lastName || ''}
                          </p>
                          {payment.user?.email && (
                            <p
                              className={`text-xs ${
                                isDark
                                  ? 'text-gray-400'
                                  : 'text-gray-500'
                              } truncate max-w-[120px]`}
                            >
                              {payment.user.email}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <p
                            className={`text-sm font-bold tabular-nums ${
                              isDark ? 'text-white' : 'text-gray-900'
                            }`}
                          >
                            {formatCurrency(payment.amount)}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            {getPaymentIcon(payment.paymentMethod)}
                            <span
                              className={`text-sm capitalize ${
                                isDark
                                  ? 'text-gray-300'
                                  : 'text-gray-700'
                              }`}
                            >
                              {formatMethod(payment.paymentMethod)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`text-xs ${
                              isDark
                                ? 'text-gray-300'
                                : 'text-gray-600'
                            }`}
                          >
                            {getProviderName(resolvedProvider)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 w-fit ${getStatusColor(
                              payment.status,
                            )}`}
                          >
                            {getStatusIcon(payment.status)}
                            {payment.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setSelectedPayment(payment);
                                setShowDetailModal(true);
                              }}
                              className={`p-1.5 rounded-lg transition duration-250 focus-ring ${
                                isDark
                                  ? 'hover:bg-gray-700'
                                  : 'hover:bg-gray-100'
                              }`}
                              title="View details"
                              aria-label="View payment details"
                            >
                              <Eye className="w-4 h-4 text-primary-500" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedPayment(payment);
                                setShowReceiptModal(true);
                              }}
                              className={`p-1.5 rounded-lg transition duration-250 focus-ring ${
                                isDark
                                  ? 'hover:bg-gray-700'
                                  : 'hover:bg-gray-100'
                              }`}
                              title="View receipt"
                              aria-label="View receipt"
                            >
                              <Receipt className="w-4 h-4 text-success-500" />
                            </button>
                            {canManagePayments &&
                              payment.status === 'PAID' && (
                                <button
                                  onClick={() => {
                                    setSelectedPayment(payment);
                                    setRefundAmount(payment.amount);
                                    setRefundReason('');
                                    setShowRefundModal(true);
                                  }}
                                  className={`p-1.5 rounded-lg transition duration-250 focus-ring ${
                                    isDark
                                      ? 'hover:bg-gray-700'
                                      : 'hover:bg-gray-100'
                                  }`}
                                  title="Refund payment"
                                  aria-label="Refund payment"
                                >
                                  <ArrowDownRight className="w-4 h-4 text-brand-500" />
                                </button>
                              )}
                            <button
                              onClick={() =>
                                copyReference(
                                  payment.reference || payment.id,
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
                {renderPagination()}
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail modal */}
      {showDetailModal && selectedPayment && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div
            className={`max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl ${
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
                  Payment Details
                </h3>
                <p
                  className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  } font-mono tabular-nums`}
                >
                  {selectedPayment.reference ||
                    `PAY-${selectedPayment.id.slice(0, 8)}`}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    {formatCurrency(selectedPayment.amount)}
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
                      selectedPayment.status,
                    )}`}
                  >
                    {getStatusIcon(selectedPayment.status)}
                    {selectedPayment.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    {getPaymentIcon(selectedPayment.paymentMethod)}
                    <span
                      className={`font-medium ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {formatMethod(selectedPayment.paymentMethod)}
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
                  <p
                    className={`font-medium ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {getProviderName(resolveProvider(selectedPayment))}
                  </p>
                  {selectedPayment.providerTransactionId && (
                    <p
                      className={`text-xs ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      } font-mono tabular-nums`}
                    >
                      TXN: {selectedPayment.providerTransactionId}
                    </p>
                  )}
                </div>
              </div>

              {selectedPayment.user && (
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
                    Customer
                  </p>
                  <p
                    className={`font-medium ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {selectedPayment.user.firstName || ''}{' '}
                    {selectedPayment.user.lastName || ''}
                  </p>
                  <p
                    className={`text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    {selectedPayment.user.email || ''}
                  </p>
                </div>
              )}

              {selectedPayment.sale && (
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
                    Sale
                  </p>
                  <p
                    className={`font-medium ${
                      isDark ? 'text-white' : 'text-gray-900'
                    } tabular-nums`}
                  >
                    Receipt: {selectedPayment.sale.receiptNumber}
                  </p>
                  <p
                    className={`text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    } tabular-nums`}
                  >
                    Total: {formatCurrency(selectedPayment.sale.total)}
                  </p>
                </div>
              )}

              {selectedPayment.refundedAt && (
                <div className="p-4 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800">
                  <p className="text-sm font-medium text-brand-700 dark:text-brand-300">
                    Refunded
                  </p>
                  <p
                    className={`text-sm ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Refunded at:{' '}
                    {formatDateTime(selectedPayment.refundedAt)}
                  </p>
                  {selectedPayment.refundReason && (
                    <p
                      className={`text-sm ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      Reason: {selectedPayment.refundReason}
                    </p>
                  )}
                </div>
              )}

              {selectedPayment.notes && (
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
                    Notes
                  </p>
                  <p
                    className={`text-sm ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    {selectedPayment.notes}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                {canManagePayments &&
                  selectedPayment.status === 'PAID' && (
                    <button
                      onClick={() => {
                        setShowDetailModal(false);
                        setRefundAmount(selectedPayment.amount);
                        setRefundReason('');
                        setShowRefundModal(true);
                      }}
                      className="px-4 py-2 bg-brand-gradient hover:bg-brand-gradient-hover text-white rounded-xl transition duration-250 flex items-center gap-2 focus-ring shadow-brand"
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
                  className="btn-secondary"
                >
                  <Receipt className="w-4 h-4" />
                  View Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund modal */}
      {showRefundModal && selectedPayment && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div
            className={`max-w-md w-full rounded-2xl shadow-xl ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <div
              className={`p-4 border-b ${
                isDark ? 'border-gray-700' : 'border-gray-200'
              } flex items-center justify-between`}
            >
              <h3
                className={`text-lg font-bold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                Refund Payment
              </h3>
              <button
                onClick={() => setShowRefundModal(false)}
                className={`p-2 rounded-lg transition duration-250 focus-ring ${
                  isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
                aria-label="Close refund"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Refund Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <input
                    type="number"
                    value={refundAmount}
                    onChange={(e) =>
                      setRefundAmount(parseFloat(e.target.value) || 0)
                    }
                    min={0}
                    max={selectedPayment.amount}
                    step={0.01}
                    className={`w-full pl-8 pr-4 py-2 border rounded-lg ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 tabular-nums`}
                  />
                </div>
                <p
                  className={`text-sm mt-1 ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  Max refund: {formatCurrency(selectedPayment.amount)}
                </p>
              </div>

              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
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
                  } focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                  placeholder="Enter refund reason..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowRefundModal(false)}
                  className={`flex-1 px-4 py-2 border rounded-xl transition duration-250 focus-ring ${
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
                  className="flex-1 px-4 py-2 bg-brand-gradient hover:bg-brand-gradient-hover text-white rounded-xl transition duration-250 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-ring shadow-brand"
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

      {/* Receipt modal */}
      {showReceiptModal && selectedPayment && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
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
                provider: resolveProvider(selectedPayment),
                metadata: selectedPayment.metadata,
                sale: selectedPayment.sale
                  ? {
                      receiptNumber:
                        selectedPayment.sale.receiptNumber,
                      items: [],
                    }
                  : undefined,
                customer: selectedPayment.user
                  ? {
                      name: getCustomerName(selectedPayment.user),
                      email: getCustomerEmail(selectedPayment.user),
                      phone: getCustomerPhone(selectedPayment.user),
                    }
                  : undefined,
                businessUnit: getBusinessUnitData(
                  selectedPayment.businessUnit,
                ),
              }}
              onClose={() => setShowReceiptModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
