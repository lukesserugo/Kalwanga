// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\payments\export\page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft, Download, FileSpreadsheet, FileText,
  FileJson, Loader2, Calendar, Filter, RefreshCw,
  CheckCircle, AlertCircle, Lock, Clock, Users,
  DollarSign, CreditCard, Printer, Shield,
  Zap, Sparkles, BarChart3, PieChart,
  Globe, Smartphone, Banknote, Wallet, Building, Gift, Star,
  Landmark
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { paymentService } from '../../../../../services/paymentService';
import { toast } from '../../../../../utils/toast-manager';
import { useThemeStore } from '../../../../stores/themeStore';
import { formatCurrency } from '../../../../../utils/formatters';

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

const PAYMENT_METHOD_OPTIONS = [
  { value: 'all', label: 'All Methods' },
  { value: 'CASH', label: 'Cash', icon: Banknote },
  { value: 'CREDIT_CARD', label: 'Credit Card', icon: CreditCard },
  { value: 'DEBIT_CARD', label: 'Debit Card', icon: Wallet },
  { value: 'MOBILE_MONEY', label: 'Mobile Money', icon: Smartphone },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: Landmark },
  { value: 'GIFT_CARD', label: 'Gift Card', icon: Gift },
  { value: 'LOYALTY_POINTS', label: 'Loyalty Points', icon: Star },
  { value: 'CHECK', label: 'Check', icon: FileText },
  { value: 'PAYPAL', label: 'PayPal', icon: Globe },
  { value: 'FLUTTERWAVE', label: 'Flutterwave', icon: Globe },
  { value: 'PAYSTACK', label: 'Paystack', icon: CreditCard },
  { value: 'SQUARE', label: 'Square', icon: CreditCard },
];

const PROVIDER_OPTIONS = [
  { value: 'all', label: 'All Providers' },
  { value: 'STRIPE', label: 'Stripe' },
  { value: 'CASH', label: 'Cash' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'GIFT_CARD', label: 'Gift Card' },
  { value: 'LOYALTY_POINTS', label: 'Loyalty Points' },
  { value: 'PAYPAL', label: 'PayPal' },
  { value: 'FLUTTERWAVE', label: 'Flutterwave' },
  { value: 'PAYSTACK', label: 'Paystack' },
  { value: 'SQUARE', label: 'Square' },
  { value: 'MTN', label: 'MTN Mobile Money' },
  { value: 'AIRTEL', label: 'Airtel Money' },
  { value: 'TIGO', label: 'Tigo Pesa' },
  { value: 'VODAFONE', label: 'Vodafone Cash' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'AUTHORIZED', label: 'Authorized' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'DISPUTED', label: 'Disputed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const FORMAT_OPTIONS = [
  { value: 'csv', label: 'CSV', icon: FileText },
  { value: 'json', label: 'JSON', icon: FileJson },
  { value: 'excel', label: 'Excel', icon: FileSpreadsheet },
  { value: 'pdf', label: 'PDF', icon: FileText },
];

export default function AdminPaymentExportPage() {
  const router = useRouter();
  const { canView, canManage, isLoading: permissionLoading } = usePermission();
  const { isDark } = useThemeStore();

  const [format, setFormat] = useState<'csv' | 'json' | 'excel' | 'pdf'>('csv');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('all');
  const [paymentMethod, setPaymentMethod] = useState('all');
  const [provider, setProvider] = useState('all');
  const [includeRefunds, setIncludeRefunds] = useState(true);
  const [includeCustomer, setIncludeCustomer] = useState(true);
  const [includeBusinessUnit, setIncludeBusinessUnit] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  const canViewPayments = canView(PermissionResource.PAYMENT) || canManage(PermissionResource.PAYMENT);

  const handleExport = async () => {
    setIsExporting(true);
    setExportComplete(false);

    try {
      const params: any = {
        format,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        status: status !== 'all' ? status : undefined,
        paymentMethod: paymentMethod !== 'all' ? paymentMethod : undefined,
        provider: provider !== 'all' ? provider : undefined,
        includeRefunds,
        includeCustomer,
        includeBusinessUnit,
        limit: 10000,
      };

      const response = await paymentService.getPayments(params);

      // Create download link
      const blob = new Blob([JSON.stringify(response, null, 2)], {
        type: format === 'csv' ? 'text/csv' :
              format === 'json' ? 'application/json' :
              format === 'excel' ? 'application/vnd.ms-excel' :
              'application/pdf'
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payments_export_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportComplete(true);
      toast.success('Export completed successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const getProviderImageUrl = (providerCode: string): string => {
    if (!providerCode || providerCode === 'all') return '';
    return isDark && PROVIDER_DARK_IMAGE_URLS[providerCode]
      ? PROVIDER_DARK_IMAGE_URLS[providerCode]
      : PROVIDER_IMAGE_URLS[providerCode] || '';
  };

  const getFormatIcon = () => {
    const opt = FORMAT_OPTIONS.find(f => f.value === format);
    const Icon = opt?.icon || FileText;
    return <Icon className="w-5 h-5" />;
  };

  // Helper to render provider option with logo
  const renderProviderOption = (opt: { value: string; label: string }) => {
    const imageUrl = getProviderImageUrl(opt.value);

    if (opt.value === 'all') {
      return <option key={opt.value} value={opt.value}>{opt.label}</option>;
    }

    return (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    );
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
        <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to export payment data.</p>
        <button
          onClick={() => router.push('/admin/payments')}
          className="mt-4 btn-brand"
        >
          Back to Payments
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-container mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 animate-fade-in">
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
              Export Payment Data
            </h1>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Export payment transactions in various formats
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Export Options */}
          <div className="lg:col-span-2">
            <div className="card-brand shadow-soft">
              <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Export Options
              </h2>

              {/* Format Selection */}
              <div className="mb-6">
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Export Format
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {FORMAT_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setFormat(opt.value as any)}
                        className={`p-3 rounded-xl text-sm font-medium transition duration-250 flex flex-col items-center gap-1 focus-ring ${
                          format === opt.value
                            ? 'bg-brand-gradient text-white shadow-brand'
                            : isDark
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                    } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
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
                    } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                  />
                </div>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${
                      isDark
                        ? 'bg-gray-700 text-white border-gray-600'
                        : 'bg-gray-100 text-gray-900 border-gray-300'
                    } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${
                      isDark
                        ? 'bg-gray-700 text-white border-gray-600'
                        : 'bg-gray-100 text-gray-900 border-gray-300'
                    } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                  >
                    {PAYMENT_METHOD_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Provider
                  </label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${
                      isDark
                        ? 'bg-gray-700 text-white border-gray-600'
                        : 'bg-gray-100 text-gray-900 border-gray-300'
                    } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                  >
                    {PROVIDER_OPTIONS.map(renderProviderOption)}
                  </select>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={includeRefunds}
                    onChange={(e) => setIncludeRefunds(e.target.checked)}
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 transition duration-250"
                  />
                  <label className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Include refunds
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={includeCustomer}
                    onChange={(e) => setIncludeCustomer(e.target.checked)}
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 transition duration-250"
                  />
                  <label className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Include customer information
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={includeBusinessUnit}
                    onChange={(e) => setIncludeBusinessUnit(e.target.checked)}
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 transition duration-250"
                  />
                  <label className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Include business unit
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Summary & Actions */}
          <div>
            <div className="card-brand shadow-soft">
              <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Export Summary
              </h2>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Format</span>
                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                    {getFormatIcon()}
                    {format.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Date Range</span>
                  <span className={`text-sm font-medium tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {dateFrom || 'All'} - {dateTo || 'All'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Status</span>
                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {STATUS_OPTIONS.find(s => s.value === status)?.label || 'All'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Method</span>
                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {PAYMENT_METHOD_OPTIONS.find(m => m.value === paymentMethod)?.label || 'All'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Provider</span>
                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                    {provider !== 'all' && getProviderImageUrl(provider) ? (
                      <Image
                        src={getProviderImageUrl(provider)}
                        alt={PROVIDER_OPTIONS.find(p => p.value === provider)?.label || provider}
                        width={20}
                        height={20}
                        className="rounded object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : null}
                    {PROVIDER_OPTIONS.find(p => p.value === provider)?.label || 'All'}
                  </span>
                </div>
              </div>

              <button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full btn-brand disabled:opacity-50"
              >
                {isExporting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
                {isExporting ? 'Exporting...' : 'Start Export'}
              </button>

              {exportComplete && (
                <div className="mt-4 p-3 bg-success-100 dark:bg-success-900/30 rounded-xl flex items-center gap-2 text-success-700 dark:text-success-300 animate-slide-down">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Export completed successfully!</span>
                </div>
              )}

              <p className={`mt-4 text-xs text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Export may take a moment depending on the amount of data
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
