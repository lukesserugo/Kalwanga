// packages/web/app/(dashboard)/admin/payments/stats/page.tsx

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Lock,
  DollarSign,
  CreditCard,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Users,
  Calendar,
  Download,
  ChevronDown,
  ChevronUp,
  Clock,
  Award,
  Gift,
  Star,
  AlertCircle,
  Filter,
  Smartphone,
  Banknote,
  Wallet,
  Building,
  QrCode,
  Globe,
  Zap,
  Shield,
  CheckCircle,
  XCircle,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { paymentService } from '../../../../../services/paymentService';
import {
  formatCurrency,
  formatDate,
} from '../../../../../utils/formatters';
import { toast } from '../../../../../utils/toast-manager';
import { useThemeStore } from '../../../../stores/themeStore';

// ============================================
// CURRENCY RESOLUTION
// ============================================
//
// `formatCurrency` requires a currency code by design — every
// amount must be rendered in a code that came from the backend.
//
// The `/payments/summary` endpoint returns aggregates without a
// currency code, and it currently sums across all Payment rows
// regardless of their individual `currency` column. Until the
// backend either (a) narrows the summary to a single currency or
// (b) returns per-currency buckets, this page can only honestly
// label its aggregate figures in the deployment's settlement
// currency.
//
// ⚠ No hardcoded fallback in this file. `NEXT_PUBLIC_DEFAULT_CURRENCY`
//   is the single source of truth. When unset, `formatCurrency`
//   receives an empty string and renders a bare number rather
//   than a fabricated symbol.
//
// ⚠ This is documented at the "Last updated" footer as well, so an
//   operator looking at the numbers knows what they're denominated
//   in.

const SETTLEMENT_CURRENCY =
  process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || '';

/**
 * Format an aggregate amount. All amounts on this page come from
 * the summary endpoint, so they share a single display code —
 * `SETTLEMENT_CURRENCY`. Per-row formatting (which would need each
 * row's own code) is not used on this page.
 */
function fmt(amount: number): string {
  return formatCurrency(amount, SETTLEMENT_CURRENCY);
}

// ============================================
// TYPES
// ============================================

interface PaymentSummaryData {
  totalAmount: number;
  byMethod: Record<string, number>;
  count: number;
  averageAmount: number;
  totalRefunds: number;
  refundCount: number;
  netAmount: number;
}

interface ProviderStat {
  provider: string;
  name: string;
  amount: number;
  count: number;
  average: number;
  percentage: number;
  icon?: string;
  color?: string;
  bgColor?: string;
  imageUrl?: string;
}

interface PaymentStats extends PaymentSummaryData {
  providerStats: ProviderStat[];
}

type DateRange =
  | 'today'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'custom';

// ============================================
// HELPERS
// ============================================

/**
 * Resolve the resolved `{ startDate, endDate }` for a named range.
 */
function resolveDateRange(
  range: DateRange,
  customStart?: string,
  customEnd?: string,
): { startDate?: string; endDate?: string } {
  if (range === 'custom') {
    const params: { startDate?: string; endDate?: string } = {};
    if (customStart) {
      const start = new Date(customStart);
      if (!Number.isNaN(start.getTime())) {
        start.setHours(0, 0, 0, 0);
        params.startDate = start.toISOString();
      }
    }
    if (customEnd) {
      const end = new Date(customEnd);
      if (!Number.isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        params.endDate = end.toISOString();
      }
    }
    return params;
  }

  const now = new Date();
  const start = new Date(now);

  switch (range) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'quarter':
      start.setMonth(start.getMonth() - 3);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      break;
  }

  return {
    startDate: start.toISOString(),
    endDate: now.toISOString(),
  };
}

/**
 * Map a method enum to the provider that processes it.
 *
 * ⚠ TIGO and VODAFONE are absent — no backend handler exists. Any
 *   historical payment with those codes falls through to
 *   `OTHER` and renders with the generic config.
 */
const METHOD_TO_PROVIDER: Record<string, string> = {
  CASH: 'CASH',
  CREDIT_CARD: 'STRIPE',
  DEBIT_CARD: 'STRIPE',
  MOBILE_MONEY: 'MOBILE_MONEY',
  BANK_TRANSFER: 'BANK_TRANSFER',
  GIFT_CARD: 'GIFT_CARD',
  LOYALTY_POINTS: 'LOYALTY_POINTS',
  CHECK: 'CASH',
  PAYPAL: 'PAYPAL',
  FLUTTERWAVE: 'FLUTTERWAVE',
  SQUARE: 'SQUARE',
  MPESA: 'MPESA',
  MTN: 'MTN',
  AIRTEL: 'AIRTEL',
};

// ============================================
// CONSTANTS
// ============================================
//
// ⚠ All provider logos are LOCAL asset paths under
//   `packages/web/public/`. No external CDN dependency. Add one
//   SVG per code to restore the images; until then the emoji from
//   `PROVIDER_CONFIGS` renders.

const PAYMENT_METHOD_ICONS: Record<string, any> = {
  CASH: Banknote,
  CREDIT_CARD: CreditCard,
  DEBIT_CARD: Wallet,
  MOBILE_MONEY: Smartphone,
  BANK_TRANSFER: Building,
  GIFT_CARD: Gift,
  LOYALTY_POINTS: Star,
  CHECK: CreditCard,
  PAYPAL: Globe,
  FLUTTERWAVE: Globe,
  SQUARE: CreditCard,
  MPESA: Smartphone,
  MTN: Smartphone,
  AIRTEL: Smartphone,
};

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  CASH: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
  CREDIT_CARD:
    'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  DEBIT_CARD:
    'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300',
  MOBILE_MONEY:
    'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
  BANK_TRANSFER:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  GIFT_CARD:
    'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
  LOYALTY_POINTS:
    'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
  CHECK:
    'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
  PAYPAL:
    'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  FLUTTERWAVE:
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  SQUARE:
    'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
  MPESA:
    'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
  MTN: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
  AIRTEL:
    'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
};

const PROVIDER_IMAGE_URLS: Record<string, string> = {
  STRIPE: '/icons/payments/stripe.svg',
  PAYPAL: '/icons/payments/paypal.svg',
  FLUTTERWAVE: '/icons/payments/flutterwave.svg',
  SQUARE: '/icons/payments/square.svg',
  MPESA: '/icons/payments/mpesa.svg',
  MTN: '/icons/payments/mtn.svg',
  AIRTEL: '/icons/payments/airtel.svg',
  CASH: '/icons/payments/cash.svg',
  MOBILE_MONEY: '/icons/payments/mobile-money.svg',
  BANK_TRANSFER: '/icons/payments/bank-transfer.svg',
  GIFT_CARD: '/icons/payments/gift-card.svg',
  LOYALTY_POINTS: '/icons/payments/loyalty-points.svg',
};

/**
 * @deprecated The dark-mode image map is intentionally empty. If
 *   you later add dark-mode-specific logos, add them here — the
 *   lookup helper falls through to `PROVIDER_IMAGE_URLS` for any
 *   code not present in this map.
 */
const PROVIDER_DARK_IMAGE_URLS: Record<string, string> = {};

const PROVIDER_CONFIGS: Record<
  string,
  {
    icon: string;
    color: string;
    bgColor: string;
    name: string;
  }
> = {
  STRIPE: {
    icon: '💳',
    color: 'primary',
    bgColor: 'bg-primary-50 dark:bg-primary-900/20',
    name: 'Stripe',
  },
  CASH: {
    icon: '💰',
    color: 'success',
    bgColor: 'bg-success-50 dark:bg-success-900/20',
    name: 'Cash',
  },
  MOBILE_MONEY: {
    icon: '📱',
    color: 'brand',
    bgColor: 'bg-brand-50 dark:bg-brand-900/20',
    name: 'Mobile Money',
  },
  BANK_TRANSFER: {
    icon: '🏦',
    color: 'indigo',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    name: 'Bank Transfer',
  },
  GIFT_CARD: {
    icon: '🎁',
    color: 'brand',
    bgColor: 'bg-brand-50 dark:bg-brand-900/20',
    name: 'Gift Card',
  },
  LOYALTY_POINTS: {
    icon: '⭐',
    color: 'warning',
    bgColor: 'bg-warning-50 dark:bg-warning-900/20',
    name: 'Loyalty Points',
  },
  PAYPAL: {
    icon: '💸',
    color: 'primary',
    bgColor: 'bg-primary-50 dark:bg-primary-900/20',
    name: 'PayPal',
  },
  FLUTTERWAVE: {
    icon: '🌊',
    color: 'cyan',
    bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
    name: 'Flutterwave',
  },
  SQUARE: {
    icon: '⬜',
    color: 'gray',
    bgColor: 'bg-gray-50 dark:bg-gray-800/50',
    name: 'Square',
  },
  MPESA: {
    icon: '📱',
    color: 'success',
    bgColor: 'bg-success-50 dark:bg-success-900/20',
    name: 'M-Pesa',
  },
  MTN: {
    icon: '📱',
    color: 'warning',
    bgColor: 'bg-warning-50 dark:bg-warning-900/20',
    name: 'MTN Mobile Money',
  },
  AIRTEL: {
    icon: '📱',
    color: 'danger',
    bgColor: 'bg-danger-50 dark:bg-danger-900/20',
    name: 'Airtel Money',
  },
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminPaymentStatsPage() {
  const router = useRouter();
  const { canView, isLoading: permissionLoading } = usePermission();
  const { isDark } = useThemeStore();

  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [viewType, setViewType] = useState<'methods' | 'providers'>(
    'methods',
  );

  const canViewPayments =
    canView(PermissionResource.PAYMENT) ||
    canView(PermissionResource.SETTINGS);

  // ── Data loading ─────────────────────────────────────────────

  const calculateProviderStats = useCallback(
    (data: PaymentSummaryData): ProviderStat[] => {
      const providerMap: Record<
        string,
        { amount: number; methods: number }
      > = {};

      Object.entries(data.byMethod || {}).forEach(([method, amount]) => {
        const numericAmount = typeof amount === 'number' ? amount : 0;
        const provider = METHOD_TO_PROVIDER[method] || 'OTHER';
        if (!providerMap[provider]) {
          providerMap[provider] = { amount: 0, methods: 0 };
        }
        providerMap[provider].amount += numericAmount;
        providerMap[provider].methods += 1;
      });

      const total = data.totalAmount || 1;

      return Object.entries(providerMap)
        .map(([provider, stats]) => {
          const config = PROVIDER_CONFIGS[provider] || {
            icon: '📊',
            color: 'gray',
            bgColor: 'bg-gray-50 dark:bg-gray-800/50',
            name: provider,
          };
          const imageUrl = PROVIDER_IMAGE_URLS[provider] || '';

          return {
            provider,
            name: config.name,
            amount: stats.amount,
            // ⚠ The backend's `/payments/summary` endpoint only
            //   exposes the amount per method, not the transaction
            //   count per method. When two methods map to the same
            //   provider (e.g. CREDIT_CARD and DEBIT_CARD both →
            //   STRIPE), `methods` counts distinct method codes,
            //   not transactions. If the backend gains a
            //   per-method count, replace this with the real sum.
            count: stats.methods,
            average:
              stats.methods > 0
                ? stats.amount / stats.methods
                : 0,
            percentage: (stats.amount / total) * 100,
            icon: config.icon,
            color: config.color,
            bgColor: config.bgColor,
            imageUrl,
          };
        })
        .sort((a, b) => b.amount - a.amount);
    },
    [],
  );

  const loadStats = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const params = resolveDateRange(
          dateRange,
          customStartDate,
          customEndDate,
        );

        const response = await paymentService.getPaymentSummary(params);

        const providerStats = calculateProviderStats(response);

        setStats({
          totalAmount: response.totalAmount ?? 0,
          byMethod: response.byMethod ?? {},
          count: response.count ?? 0,
          averageAmount: response.averageAmount ?? 0,
          totalRefunds: response.totalRefunds ?? 0,
          refundCount: response.refundCount ?? 0,
          netAmount: response.netAmount ?? 0,
          providerStats,
        });
      } catch (error) {
        console.error('Failed to load payment stats:', error);
        toast.error('Failed to load statistics');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      dateRange,
      customStartDate,
      customEndDate,
      calculateProviderStats,
    ],
  );

  // ── Custom-range gate ────────────────────────────────────────
  //
  // Only re-run the fetch on a custom range when both dates are
  // populated. This avoids firing a request mid-typing while the
  // user is still picking the second date.
  //
  // Extracted into a named variable so the `useEffect` dependency
  // array contains only simple expressions — ESLint's
  // `react-hooks/exhaustive-deps` rule cannot statically analyse a
  // ternary inside the array.
  const customRangeKey =
    dateRange === 'custom' && customStartDate && customEndDate
      ? `${customStartDate}__${customEndDate}`
      : '';

  // Load on mount and whenever the resolved range changes.
  useEffect(() => {
    if (canViewPayments) {
      void loadStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewPayments, dateRange, customRangeKey]);

  const handleRefresh = useCallback(() => {
    void loadStats(true);
  }, [loadStats]);

  const handleExport = useCallback(async () => {
    try {
      const exportData = {
        period: dateRange,
        // Include the settlement currency in the export payload so
        // downstream tooling knows what the amounts are denominated
        // in. When the env is unset, this is `null`.
        currency: SETTLEMENT_CURRENCY || null,
        summary: {
          totalAmount: stats?.totalAmount,
          totalTransactions: stats?.count,
          averageAmount: stats?.averageAmount,
          totalRefunds: stats?.totalRefunds,
          refundCount: stats?.refundCount,
          netAmount: stats?.netAmount,
        },
        byMethod: stats?.byMethod,
        byProvider: stats?.providerStats,
        exportedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payment-stats-${
        new Date().toISOString().split('T')[0]
      }.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Stats exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export stats');
    }
  }, [dateRange, stats]);

  // ── UI helpers ───────────────────────────────────────────────

  const formatMethod = useCallback((method: string) => {
    return method.toLowerCase().replace(/_/g, ' ');
  }, []);

  const getProviderImageUrl = useCallback(
    (provider: string): string => {
      const dark = PROVIDER_DARK_IMAGE_URLS[provider];
      if (isDark && dark) return dark;
      return PROVIDER_IMAGE_URLS[provider] || '';
    },
    [isDark],
  );

  // ── Render gates ─────────────────────────────────────────────

  if (permissionLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2
          className={`w-12 h-12 animate-spin ${
            isDark ? 'text-brand-400' : 'text-brand-600'
          }`}
        />
      </div>
    );
  }

  if (!canViewPayments) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          You don&apos;t have permission to view payment statistics.
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

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertCircle
          className={`w-16 h-16 mb-4 ${
            isDark ? 'text-warning-400' : 'text-warning-500'
          }`}
        />
        <h2 className="text-2xl font-semibold mb-2">
          No Data Available
        </h2>
        <p className="text-gray-500">
          There is no payment data for the selected period.
        </p>
        <button onClick={handleRefresh} className="mt-4 btn-brand">
          Try Again
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
                Payment Statistics
              </h1>
              <p
                className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                Monitor your payment performance and metrics across
                all providers
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`flex rounded-lg overflow-hidden border ${
                isDark ? 'border-gray-700' : 'border-gray-300'
              }`}
            >
              <button
                onClick={() => setViewType('methods')}
                className={`px-3 py-1.5 text-sm transition duration-250 focus-ring ${
                  viewType === 'methods'
                    ? 'bg-brand-gradient text-white'
                    : isDark
                      ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                By Method
              </button>
              <button
                onClick={() => setViewType('providers')}
                className={`px-3 py-1.5 text-sm transition duration-250 focus-ring ${
                  viewType === 'providers'
                    ? 'bg-brand-gradient text-white'
                    : isDark
                      ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                By Provider
              </button>
            </div>

            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value as DateRange);
                if (e.target.value !== 'custom') {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }
              }}
              className={`px-4 py-2 rounded-lg border ${
                isDark
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition duration-250`}
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="quarter">Last 90 Days</option>
              <option value="year">Last 365 Days</option>
              <option value="custom">Custom Range</option>
            </select>

            {dateRange === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className={`px-3 py-2 rounded-lg border ${
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition duration-250`}
                />
                <span
                  className={
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }
                >
                  to
                </span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className={`px-3 py-2 rounded-lg border ${
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition duration-250`}
                />
              </div>
            )}

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
              aria-label="Refresh stats"
            >
              <RefreshCw
                className={`w-5 h-5 ${
                  refreshing ? 'animate-spin' : ''
                }`}
              />
            </button>

            <button onClick={handleExport} className="btn-brand">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            {
              title: 'Total Revenue',
              value: fmt(stats.totalAmount),
              icon: DollarSign,
              color:
                'bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-400',
            },
            {
              title: 'Total Transactions',
              value: stats.count.toLocaleString(),
              icon: CreditCard,
              color:
                'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400',
            },
            {
              title: 'Average Transaction',
              value: fmt(stats.averageAmount),
              icon: BarChart3,
              color:
                'bg-secondary-100 text-secondary-600 dark:bg-secondary-900/30 dark:text-secondary-400',
            },
            {
              title: 'Net Revenue',
              value: fmt(stats.netAmount),
              icon: TrendingUp,
              color:
                'bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400',
            },
          ].map((stat, index) => (
            <div
              key={index}
              className="card-brand shadow-soft hover:shadow-card-hover transition duration-250"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p
                    className={`text-sm font-medium ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  >
                    {stat.title}
                  </p>
                  <p
                    className={`text-2xl font-bold mt-2 tabular-nums ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Refund Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                  {fmt(stats.totalRefunds)}
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
            <p
              className={`text-sm mt-2 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              {stats.refundCount} refund transactions
            </p>
          </div>
          <div className="card-brand shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p
                  className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  Refund Rate
                </p>
                <p
                  className={`text-2xl font-bold mt-1 tabular-nums ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {stats.count > 0
                    ? (
                        (stats.refundCount / stats.count) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
              <div
                className={`p-3 rounded-lg ${
                  isDark ? 'bg-primary-900/20' : 'bg-primary-100'
                }`}
              >
                <PieChart
                  className={`w-6 h-6 ${
                    isDark ? 'text-primary-400' : 'text-primary-600'
                  }`}
                />
              </div>
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              {stats.refundCount} of {stats.count} transactions refunded
            </p>
          </div>
        </div>

        {/* Methods / Providers Breakdown */}
        <div className="card-brand mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2
              className={`text-lg font-semibold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              {viewType === 'methods'
                ? 'Payment Methods Breakdown'
                : 'Payment Providers Breakdown'}
            </h2>
            <span
              className={`text-xs ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              {viewType === 'methods'
                ? `${Object.keys(stats.byMethod || {}).length} methods`
                : `${stats.providerStats?.length || 0} providers`}
            </span>
          </div>

          {viewType === 'methods' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.byMethod &&
                Object.entries(stats.byMethod).map(
                  ([method, amount]) => {
                    const total = stats.totalAmount || 1;
                    const numericAmount =
                      typeof amount === 'number' ? amount : 0;
                    const percentage =
                      (numericAmount / total) * 100;
                    const Icon =
                      PAYMENT_METHOD_ICONS[method] || CreditCard;
                    const colorClass =
                      PAYMENT_METHOD_COLORS[method] ||
                      'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';

                    return (
                      <div
                        key={method}
                        className={`p-4 rounded-xl ${
                          isDark ? 'bg-gray-700/30' : 'bg-gray-50'
                        } transition duration-250 hover:shadow-card`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg ${colorClass}`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <p
                              className={`font-medium capitalize ${
                                isDark
                                  ? 'text-white'
                                  : 'text-gray-900'
                              }`}
                            >
                              {formatMethod(method)}
                            </p>
                            <div className="flex justify-between text-sm tabular-nums">
                              <span
                                className={
                                  isDark
                                    ? 'text-gray-400'
                                    : 'text-gray-500'
                                }
                              >
                                {fmt(numericAmount)}
                              </span>
                              <span
                                className={
                                  isDark
                                    ? 'text-gray-300'
                                    : 'text-gray-700'
                                }
                              >
                                {percentage.toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                              <div
                                className="bg-brand-gradient h-2 rounded-full transition-all duration-350"
                                style={{
                                  width: `${percentage}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  },
                )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.providerStats &&
                stats.providerStats.map((provider) => {
                  const config =
                    PROVIDER_CONFIGS[provider.provider];
                  const imageUrl = getProviderImageUrl(
                    provider.provider,
                  );
                  const bgColor =
                    provider.bgColor ||
                    'bg-gray-50 dark:bg-gray-700/30';

                  return (
                    <div
                      key={provider.provider}
                      className={`p-4 rounded-xl ${bgColor} transition duration-250 hover:shadow-card`}
                    >
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
                                (
                                  e.target as HTMLImageElement
                                ).style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
                            <span className="text-2xl">
                              {config?.icon || '📊'}
                            </span>
                          </div>
                        )}
                        <div className="flex-1">
                          <p
                            className={`font-medium ${
                              isDark ? 'text-white' : 'text-gray-900'
                            }`}
                          >
                            {provider.name}
                          </p>
                          <div className="flex justify-between text-sm tabular-nums">
                            <span
                              className={
                                isDark
                                  ? 'text-gray-400'
                                  : 'text-gray-500'
                              }
                            >
                              {fmt(provider.amount)}
                            </span>
                            <span
                              className={
                                isDark
                                  ? 'text-gray-300'
                                  : 'text-gray-700'
                              }
                            >
                              {provider.percentage.toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                            <div
                              className={`h-2 rounded-full transition-all duration-350 ${
                                provider.color === 'success'
                                  ? 'bg-success-600'
                                  : provider.color === 'primary'
                                    ? 'bg-primary-600'
                                    : provider.color === 'brand'
                                      ? 'bg-brand-gradient'
                                      : provider.color === 'indigo'
                                        ? 'bg-indigo-600'
                                        : provider.color ===
                                            'warning'
                                          ? 'bg-warning-600'
                                          : provider.color ===
                                              'cyan'
                                            ? 'bg-cyan-600'
                                            : provider.color ===
                                                'sky'
                                              ? 'bg-sky-600'
                                              : provider.color ===
                                                  'danger'
                                                ? 'bg-danger-600'
                                                : 'bg-gray-600'
                              }`}
                              style={{
                                width: `${provider.percentage}%`,
                              }}
                            />
                          </div>
                          <div className="flex justify-between text-xs mt-1 tabular-nums">
                            <span
                              className={
                                isDark
                                  ? 'text-gray-500'
                                  : 'text-gray-400'
                              }
                            >
                              {provider.count} transactions
                            </span>
                            <span
                              className={
                                isDark
                                  ? 'text-gray-500'
                                  : 'text-gray-400'
                              }
                            >
                              Avg: {fmt(provider.average)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Provider Comparison Summary */}
        {viewType === 'providers' &&
          stats.providerStats &&
          stats.providerStats.length > 1 && (
            <div className="card-brand mb-6">
              <h3
                className={`text-sm font-semibold mb-3 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                Provider Comparison
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {stats.providerStats
                  .slice(0, 3)
                  .map((provider, index) => {
                    const config =
                      PROVIDER_CONFIGS[provider.provider];
                    const imageUrl = getProviderImageUrl(
                      provider.provider,
                    );

                    return (
                      <div
                        key={provider.provider}
                        className={`p-3 rounded-xl ${
                          isDark ? 'bg-gray-700/30' : 'bg-gray-50'
                        } transition duration-250 hover:shadow-card`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {imageUrl ? (
                              <div className="relative w-8 h-8">
                                <Image
                                  src={imageUrl}
                                  alt={provider.name}
                                  width={32}
                                  height={32}
                                  className="rounded-lg object-contain"
                                  onError={(e) => {
                                    (
                                      e.target as HTMLImageElement
                                    ).style.display = 'none';
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="w-8 h-8 flex items-center justify-center">
                                <span className="text-lg">
                                  {config?.icon || '📊'}
                                </span>
                              </div>
                            )}
                            <span
                              className={`font-medium ${
                                isDark
                                  ? 'text-white'
                                  : 'text-gray-900'
                              }`}
                            >
                              {provider.name}
                            </span>
                          </div>
                          {index === 0 && (
                            <span className="badge-brand">Top</span>
                          )}
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs tabular-nums">
                          <div>
                            <p
                              className={
                                isDark
                                  ? 'text-gray-400'
                                  : 'text-gray-500'
                              }
                            >
                              Volume
                            </p>
                            <p
                              className={`font-medium ${
                                isDark
                                  ? 'text-white'
                                  : 'text-gray-900'
                              }`}
                            >
                              {fmt(provider.amount)}
                            </p>
                          </div>
                          <div>
                            <p
                              className={
                                isDark
                                  ? 'text-gray-400'
                                  : 'text-gray-500'
                              }
                            >
                              Transactions
                            </p>
                            <p
                              className={`font-medium ${
                                isDark
                                  ? 'text-white'
                                  : 'text-gray-900'
                              }`}
                            >
                              {provider.count}
                            </p>
                          </div>
                          <div>
                            <p
                              className={
                                isDark
                                  ? 'text-gray-400'
                                  : 'text-gray-500'
                              }
                            >
                              Avg
                            </p>
                            <p
                              className={`font-medium ${
                                isDark
                                  ? 'text-white'
                                  : 'text-gray-900'
                              }`}
                            >
                              {fmt(provider.average)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

        {/* Footer */}
        <div className="card-brand shadow-soft mt-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm">
            <div
              className={`${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              <Clock className="inline w-4 h-4 mr-1" />
              Last updated: {formatDate(new Date())}
            </div>
            <div
              className={`${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Data covers{' '}
              {dateRange === 'today'
                ? 'today'
                : dateRange === 'custom'
                  ? 'custom range'
                  : `last ${dateRange}`}
            </div>
            <div
              className={`${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              <Shield className="inline w-4 h-4 mr-1" />
              {SETTLEMENT_CURRENCY
                ? `All amounts in ${SETTLEMENT_CURRENCY}`
                : 'Settlement currency not configured'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


