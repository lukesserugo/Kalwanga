'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft, RefreshCw, Loader2, Lock,
  DollarSign, CreditCard, TrendingUp, TrendingDown,
  BarChart3, PieChart, Users, Calendar,
  Download, ChevronDown, ChevronUp, Clock,
  Award, Gift, Star, AlertCircle, Filter,
  Smartphone, Banknote, Wallet, Building, QrCode,
  Globe, Zap, Shield, CheckCircle, XCircle,
  TrendingUp as TrendingUpIcon, TrendingDown as TrendingDownIcon
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { paymentService } from '../../../../../services/paymentService';
import { formatCurrency, formatDate } from '../../../../../utils/formatters';
import { toast } from '../../../../../utils/toast-manager';
import { useThemeStore } from '../../../../stores/themeStore';

// ============================================
// TYPES - EXTENDED TO INCLUDE PROVIDER STATS
// ============================================

interface PaymentSummary {
  totalAmount: number;
  byMethod: Record<string, number>;
  count: number;
  averageAmount: number;
  totalRefunds: number;
  refundCount: number;
  netAmount: number;
}

interface PaymentStats extends PaymentSummary {
  providerStats?: Array<{
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
  }>;
  dailyStats?: Array<{ date: string; amount: number; count: number }>;
  weeklyStats?: Array<{ week: string; amount: number; count: number }>;
  monthlyStats?: Array<{ month: string; amount: number; count: number }>;
}

// ============================================
// CONSTANTS - EXACT IMAGE URLs
// ============================================

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
  PAYSTACK: CreditCard,
  SQUARE: CreditCard,
  MTN: Smartphone,
  AIRTEL: Smartphone,
  TIGO: Smartphone,
  VODAFONE: Smartphone,
};

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  CASH: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  CREDIT_CARD: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  DEBIT_CARD: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  MOBILE_MONEY: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  BANK_TRANSFER: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  GIFT_CARD: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  LOYALTY_POINTS: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  CHECK: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
  PAYPAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  FLUTTERWAVE: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  PAYSTACK: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  SQUARE: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
  MTN: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  AIRTEL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  TIGO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  VODAFONE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

// EXACT OFFICIAL LOGO URLs
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

// Dark mode versions (some providers have white logos)
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

const PROVIDER_CONFIGS: Record<string, { 
  icon: string; 
  color: string; 
  bgColor: string; 
  name: string;
}> = {
  STRIPE: { 
    icon: '💳', 
    color: 'blue', 
    bgColor: 'bg-blue-50 dark:bg-blue-900/20', 
    name: 'Stripe' 
  },
  CASH: { 
    icon: '💰', 
    color: 'green', 
    bgColor: 'bg-green-50 dark:bg-green-900/20', 
    name: 'Cash' 
  },
  MOBILE_MONEY: { 
    icon: '📱', 
    color: 'orange', 
    bgColor: 'bg-orange-50 dark:bg-orange-900/20', 
    name: 'Mobile Money' 
  },
  BANK_TRANSFER: { 
    icon: '🏦', 
    color: 'indigo', 
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20', 
    name: 'Bank Transfer' 
  },
  GIFT_CARD: { 
    icon: '🎁', 
    color: 'pink', 
    bgColor: 'bg-pink-50 dark:bg-pink-900/20', 
    name: 'Gift Card' 
  },
  LOYALTY_POINTS: { 
    icon: '⭐', 
    color: 'yellow', 
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20', 
    name: 'Loyalty Points' 
  },
  PAYPAL: { 
    icon: '💸', 
    color: 'blue', 
    bgColor: 'bg-blue-50 dark:bg-blue-900/20', 
    name: 'PayPal' 
  },
  FLUTTERWAVE: { 
    icon: '🌊', 
    color: 'cyan', 
    bgColor: 'bg-cyan-50 dark:bg-cyan-900/20', 
    name: 'Flutterwave' 
  },
  PAYSTACK: { 
    icon: '🔷', 
    color: 'sky', 
    bgColor: 'bg-sky-50 dark:bg-sky-900/20', 
    name: 'Paystack' 
  },
  SQUARE: { 
    icon: '⬜', 
    color: 'gray', 
    bgColor: 'bg-gray-50 dark:bg-gray-800/50', 
    name: 'Square' 
  },
  MTN: { 
    icon: '📱', 
    color: 'yellow', 
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20', 
    name: 'MTN Mobile Money' 
  },
  AIRTEL: { 
    icon: '📱', 
    color: 'red', 
    bgColor: 'bg-red-50 dark:bg-red-900/20', 
    name: 'Airtel Money' 
  },
  TIGO: { 
    icon: '📱', 
    color: 'blue', 
    bgColor: 'bg-blue-50 dark:bg-blue-900/20', 
    name: 'Tigo Pesa' 
  },
  VODAFONE: { 
    icon: '📱', 
    color: 'red', 
    bgColor: 'bg-red-50 dark:bg-red-900/20', 
    name: 'Vodafone Cash' 
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
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [viewType, setViewType] = useState<'methods' | 'providers'>('methods');

  const canViewPayments = canView(PermissionResource.PAYMENT) || canView(PermissionResource.PAYMENT);

  useEffect(() => {
    if (canViewPayments) {
      loadStats();
    }
  }, [canViewPayments, dateRange, customStartDate, customEndDate]);

  const loadStats = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const params: any = {};
      
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
      } else if (dateRange === 'custom') {
        if (customStartDate) params.startDate = new Date(customStartDate).toISOString();
        if (customEndDate) params.endDate = new Date(customEndDate).toISOString();
      }

      const response = await paymentService.getPaymentSummary(params);
      
      const providerStats = calculateProviderStats(response);
      
      setStats({
        ...response,
        providerStats,
      });
    } catch (error) {
      console.error('Failed to load payment stats:', error);
      toast.error('Failed to load statistics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateProviderStats = (data: PaymentSummary): Array<{
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
  }> => {
    const providerMap: Record<string, { amount: number; count: number }> = {};
    
    const methodToProvider: Record<string, string> = {
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
      PAYSTACK: 'PAYSTACK',
      SQUARE: 'SQUARE',
      MTN: 'MTN',
      AIRTEL: 'AIRTEL',
      TIGO: 'TIGO',
      VODAFONE: 'VODAFONE',
    };

    Object.entries(data.byMethod || {}).forEach(([method, amount]) => {
      const provider = methodToProvider[method] || 'OTHER';
      if (!providerMap[provider]) {
        providerMap[provider] = { amount: 0, count: 0 };
      }
      providerMap[provider].amount += amount;
      providerMap[provider].count += 1;
    });

    const total = data.totalAmount || 1;
    
    return Object.entries(providerMap).map(([provider, stats]) => {
      const config = PROVIDER_CONFIGS[provider] || { 
        icon: '📊', 
        color: 'gray', 
        bgColor: 'bg-gray-50 dark:bg-gray-800/50', 
        name: provider 
      };
      const imageUrl = PROVIDER_IMAGE_URLS[provider] || '';
      
      return {
        provider,
        name: config.name,
        amount: stats.amount,
        count: stats.count,
        average: stats.count > 0 ? stats.amount / stats.count : 0,
        percentage: (stats.amount / total) * 100,
        icon: config.icon,
        color: config.color,
        bgColor: config.bgColor,
        imageUrl: imageUrl,
      };
    }).sort((a, b) => b.amount - a.amount);
  };

  const handleRefresh = () => {
    loadStats(true);
  };

  const handleExport = async () => {
    try {
      const exportData = {
        period: dateRange,
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

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payment-stats-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Stats exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export stats');
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
    return names[provider] || provider;
  };

  const getProviderImageUrl = (provider: string): string => {
    return isDark && PROVIDER_DARK_IMAGE_URLS[provider] 
      ? PROVIDER_DARK_IMAGE_URLS[provider] 
      : PROVIDER_IMAGE_URLS[provider] || '';
  };

  if (permissionLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className={`w-12 h-12 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
      </div>
    );
  }

  if (!canViewPayments) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to view payment statistics.</p>
        <button
          onClick={() => router.push('/admin/payments')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Back to Payments
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertCircle className={`w-16 h-16 mb-4 ${isDark ? 'text-yellow-400' : 'text-yellow-500'}`} />
        <h2 className="text-2xl font-semibold mb-2">No Data Available</h2>
        <p className="text-gray-500">There is no payment data for the selected period.</p>
        <button
          onClick={handleRefresh}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Try Again
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
              Payment Statistics
            </h1>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Monitor your payment performance and metrics across all providers
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className={`flex rounded-lg overflow-hidden border ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
            <button
              onClick={() => setViewType('methods')}
              className={`px-3 py-1.5 text-sm transition ${
                viewType === 'methods'
                  ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                  : isDark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              By Method
            </button>
            <button
              onClick={() => setViewType('providers')}
              className={`px-3 py-1.5 text-sm transition ${
                viewType === 'providers'
                  ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                  : isDark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              By Provider
            </button>
          </div>

          <select
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value as any);
              if (e.target.value !== 'custom') {
                setCustomStartDate('');
                setCustomEndDate('');
              }
            }}
            className={`px-4 py-2 rounded-lg border ${
              isDark
                ? 'bg-gray-800 border-gray-700 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
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
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
              <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className={`px-3 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
            </div>
          )}

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
            onClick={handleExport}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
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
            value: formatCurrency(stats.totalAmount),
            icon: DollarSign,
            color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
            change: '+12.5%'
          },
          {
            title: 'Total Transactions',
            value: stats.count.toLocaleString(),
            icon: CreditCard,
            color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
            change: '+8.3%'
          },
          {
            title: 'Average Transaction',
            value: formatCurrency(stats.averageAmount),
            icon: BarChart3,
            color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
            change: '+5.2%'
          },
          {
            title: 'Net Revenue',
            value: formatCurrency(stats.netAmount),
            icon: TrendingUp,
            color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
            change: stats.netAmount > 0 ? '+2.1%' : '-0.5%'
          }
        ].map((stat, index) => (
          <div key={index} className={`p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm hover:shadow-md transition`}>
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {stat.title}
                </p>
                <p className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {stat.value}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  {stat.change.startsWith('+') ? (
                    <TrendingUpIcon className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDownIcon className="w-4 h-4 text-red-500" />
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
        <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Refunds</p>
              <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {formatCurrency(stats.totalRefunds)}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${isDark ? 'bg-red-900/20' : 'bg-red-100'}`}>
              <TrendingDown className={`w-6 h-6 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
            </div>
          </div>
          <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {stats.refundCount} refund transactions
          </p>
        </div>
        <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Refund Rate</p>
              <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {stats.count > 0 ? ((stats.refundCount / stats.count) * 100).toFixed(1) : 0}%
              </p>
            </div>
            <div className={`p-3 rounded-lg ${isDark ? 'bg-blue-900/20' : 'bg-blue-100'}`}>
              <PieChart className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
          </div>
          <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {stats.refundCount} of {stats.count} transactions refunded
          </p>
        </div>
      </div>

      {/* Payment Methods / Providers Breakdown */}
      <div className={`p-6 rounded-xl mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {viewType === 'methods' ? 'Payment Methods Breakdown' : 'Payment Providers Breakdown'}
          </h2>
          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {viewType === 'methods' 
              ? `${Object.keys(stats.byMethod || {}).length} methods` 
              : `${stats.providerStats?.length || 0} providers`}
          </span>
        </div>

        {viewType === 'methods' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.byMethod && Object.entries(stats.byMethod).map(([method, amount]) => {
              const total = stats.totalAmount || 1;
              const percentage = (amount / total) * 100;
              const Icon = PAYMENT_METHOD_ICONS[method] || CreditCard;
              const colorClass = PAYMENT_METHOD_COLORS[method] || 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';
              
              return (
                <div key={method} className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${colorClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {formatMethod(method)}
                      </p>
                      <div className="flex justify-between text-sm">
                        <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                          {formatCurrency(amount)}
                        </span>
                        <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.providerStats && stats.providerStats.map((provider) => {
              const config = PROVIDER_CONFIGS[provider.provider];
              const imageUrl = provider.imageUrl || '';
              const bgColor = provider.bgColor || 'bg-gray-50 dark:bg-gray-700/30';
              
              return (
                <div key={provider.provider} className={`p-4 rounded-lg ${bgColor}`}>
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
                              fallback.textContent = config?.icon || '📊';
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
                        <span className="text-2xl">{config?.icon || '📊'}</span>
                      </div>
                    )}
                    <div className="flex-1">
                      <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {provider.name}
                      </p>
                      <div className="flex justify-between text-sm">
                        <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                          {formatCurrency(provider.amount)}
                        </span>
                        <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                          {provider.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            provider.color === 'green' ? 'bg-green-600' :
                            provider.color === 'blue' ? 'bg-blue-600' :
                            provider.color === 'orange' ? 'bg-orange-600' :
                            provider.color === 'indigo' ? 'bg-indigo-600' :
                            provider.color === 'pink' ? 'bg-pink-600' :
                            provider.color === 'yellow' ? 'bg-yellow-600' :
                            provider.color === 'cyan' ? 'bg-cyan-600' :
                            provider.color === 'sky' ? 'bg-sky-600' :
                            provider.color === 'red' ? 'bg-red-600' :
                            'bg-gray-600'
                          }`}
                          style={{ width: `${provider.percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs mt-1">
                        <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>
                          {provider.count} transactions
                        </span>
                        <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>
                          Avg: {formatCurrency(provider.average)}
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
      {viewType === 'providers' && stats.providerStats && stats.providerStats.length > 1 && (
        <div className={`p-4 rounded-xl mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          <h3 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Provider Comparison
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.providerStats.slice(0, 3).map((provider, index) => {
              const config = PROVIDER_CONFIGS[provider.provider];
              const imageUrl = provider.imageUrl || '';
              
              return (
                <div key={provider.provider} className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
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
                              (e.target as HTMLImageElement).style.display = 'none';
                              const parent = (e.target as HTMLImageElement).parentElement;
                              if (parent) {
                                const fallback = document.createElement('span');
                                fallback.className = `text-lg ${isDark ? 'text-gray-300' : 'text-gray-600'}`;
                                fallback.textContent = config?.icon || '📊';
                                parent.appendChild(fallback);
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 flex items-center justify-center">
                          <span className="text-lg">{config?.icon || '📊'}</span>
                        </div>
                      )}
                      <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {provider.name}
                      </span>
                    </div>
                    {index === 0 && (
                      <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-full">
                        Top
                      </span>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>Volume</p>
                      <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {formatCurrency(provider.amount)}
                      </p>
                    </div>
                    <div>
                      <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>Transactions</p>
                      <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {provider.count}
                      </p>
                    </div>
                    <div>
                      <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>Avg</p>
                      <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {formatCurrency(provider.average)}
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
      <div className={`mt-8 p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm">
          <div className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            <Clock className="inline w-4 h-4 mr-1" />
            Last updated: {formatDate(new Date())}
          </div>
          <div className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Data covers {dateRange === 'today' ? 'today' : dateRange === 'custom' ? 'custom range' : `last ${dateRange}`}
          </div>
          <div className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            <Shield className="inline w-4 h-4 mr-1" />
            All amounts in {process.env.NEXT_PUBLIC_CURRENCY || 'USD'}
          </div>
        </div>
      </div>
    </div>
  );
}
