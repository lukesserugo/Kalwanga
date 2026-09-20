// D:\Projects\Kalwanga\packages\web\components\payment\PaymentReceipt.tsx

'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Receipt, Printer, Download, Copy, CheckCircle,
  Calendar, Clock, DollarSign, CreditCard, User,
  Mail, Phone, MapPin, Building, Package,
  FileText, Share2, ExternalLink, X,
  Globe, Smartphone, Banknote, Wallet, Gift, Star, Landmark
} from 'lucide-react';
import { useThemeStore } from '../../app/stores/themeStore';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { toast } from '../../utils/toast-manager';

// ============================================
// TYPES
// ============================================

interface PaymentReceiptProps {
  payment: {
    id: string;
    reference: string;
    amount: number;
    paymentMethod: string;
    status: string;
    processedAt: string;
    provider?: string;
    gatewayId?: string;
    sale?: {
      receiptNumber: string;
      items?: Array<{
        productName: string;
        quantity: number;
        unitPrice: number;
        total: number;
      }>;
    };
    customer?: {
      name: string;
      email: string;
      phone: string;
    };
    businessUnit?: {
      name: string;
      address: string;
      phone: string;
      email: string;
    };
  };
  onClose?: () => void;
  className?: string;
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
  MTN: Smartphone,
  AIRTEL: Smartphone,
  TIGO: Smartphone,
  VODAFONE: Smartphone,
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card',
  MOBILE_MONEY: 'Mobile Money',
  BANK_TRANSFER: 'Bank Transfer',
  GIFT_CARD: 'Gift Card',
  LOYALTY_POINTS: 'Loyalty Points',
  CHECK: 'Check',
  PAYPAL: 'PayPal',
  FLUTTERWAVE: 'Flutterwave',
  PAYSTACK: 'Paystack',
  SQUARE: 'Square',
  MTN: 'MTN Mobile Money',
  AIRTEL: 'Airtel Money',
  TIGO: 'Tigo Pesa',
  VODAFONE: 'Vodafone Cash',
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
  MTN: 'MTN',
  AIRTEL: 'Airtel',
  TIGO: 'Tigo',
  VODAFONE: 'Vodafone',
};

// ============================================
// MAIN COMPONENT
// ============================================

export function PaymentReceipt({
  payment,
  onClose,
  className = '',
}: PaymentReceiptProps) {
  const { isDark } = useThemeStore();
  const [copied, setCopied] = useState(false);

  const getProviderImageUrl = (provider?: string): string => {
    if (!provider) return '';
    return isDark && PROVIDER_DARK_IMAGE_URLS[provider]
      ? PROVIDER_DARK_IMAGE_URLS[provider]
      : PROVIDER_IMAGE_URLS[provider] || '';
  };

  const getPaymentMethodIcon = (method: string) => {
    const Icon = PAYMENT_METHOD_ICONS[method] || CreditCard;
    return Icon;
  };

  const getPaymentMethodLabel = (method: string) => {
    return PAYMENT_METHOD_LABELS[method] || method;
  };

  const getProviderName = (provider?: string) => {
    if (!provider) return '';
    return PROVIDER_NAMES[provider] || provider;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'PAID': 'text-success-600 dark:text-success-400',
      'PENDING': 'text-warning-600 dark:text-warning-400',
      'FAILED': 'text-danger-600 dark:text-danger-400',
      'REFUNDED': 'text-gray-600 dark:text-gray-400',
      'PARTIAL': 'text-primary-600 dark:text-primary-400',
      'PROCESSING': 'text-secondary-600 dark:text-secondary-400',
      'AUTHORIZED': 'text-primary-600 dark:text-primary-400',
      'DECLINED': 'text-danger-600 dark:text-danger-400',
      'DISPUTED': 'text-brand-600 dark:text-brand-400',
      'CANCELLED': 'text-gray-600 dark:text-gray-400',
    };
    return colors[status] || 'text-gray-600 dark:text-gray-400';
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      'PAID': 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
      'PENDING': 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
      'FAILED': 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
      'REFUNDED': 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
      'PARTIAL': 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
      'PROCESSING': 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300',
      'AUTHORIZED': 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
      'DECLINED': 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
      'DISPUTED': 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
      'CANCELLED': 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';
  };

  const handleCopy = () => {
    const providerName = getProviderName(payment.provider || payment.gatewayId);
    const text = `Receipt #${payment.reference}
Amount: ${formatCurrency(payment.amount)}
Payment Method: ${getPaymentMethodLabel(payment.paymentMethod)}
${providerName ? `Provider: ${providerName}` : ''}
Date: ${formatDateTime(payment.processedAt)}
Status: ${payment.status}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Receipt copied to clipboard');
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const receiptData = {
      reference: payment.reference,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      provider: payment.provider || payment.gatewayId,
      status: payment.status,
      date: payment.processedAt,
      items: payment.sale?.items || [],
      customer: payment.customer,
      businessUnit: payment.businessUnit,
    };

    const blob = new Blob([JSON.stringify(receiptData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${payment.reference}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Receipt downloaded');
  };

  const PaymentMethodIcon = getPaymentMethodIcon(payment.paymentMethod);
  const providerImageUrl = getProviderImageUrl(payment.provider || payment.gatewayId);
  const providerName = getProviderName(payment.provider || payment.gatewayId);

  return (
    <div className={className} id="receipt">
      <div className={`p-6 rounded-2xl card-brand shadow-soft animate-fade-in ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Receipt className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            <div>
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Payment Receipt
              </h3>
              <p className={`text-sm tabular-nums ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                #{payment.reference}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`p-2 rounded-lg transition duration-250 focus-ring ${
                isDark
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
              title="Copy receipt"
              aria-label="Copy receipt"
            >
              {copied ? (
                <CheckCircle className="w-4 h-4 text-success-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={handlePrint}
              className={`p-2 rounded-lg transition duration-250 focus-ring ${
                isDark
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
              title="Print receipt"
              aria-label="Print receipt"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownload}
              className={`p-2 rounded-lg transition duration-250 focus-ring ${
                isDark
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
              title="Download receipt"
              aria-label="Download receipt"
            >
              <Download className="w-4 h-4" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition duration-250 focus-ring ${
                  isDark
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                }`}
                title="Close"
                aria-label="Close receipt"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Status & Amount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Amount</p>
            <p className={`text-2xl font-bold tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {formatCurrency(payment.amount)}
            </p>
          </div>
          <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Status</p>
            <span className={`px-3 py-1 text-2xs font-medium rounded-full inline-flex items-center gap-1 ${getStatusBadgeColor(payment.status)}`}>
              {payment.status}
            </span>
          </div>
        </div>

        {/* Payment Method & Provider */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Payment Method</p>
            <div className="flex items-center gap-2 mt-1">
              <PaymentMethodIcon className={`w-5 h-5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`} />
              <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {getPaymentMethodLabel(payment.paymentMethod)}
              </span>
            </div>
          </div>
          <div>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Provider</p>
            <div className="flex items-center gap-2 mt-1">
              {providerImageUrl ? (
                <div className="relative w-6 h-6">
                  <Image
                    src={providerImageUrl}
                    alt={providerName}
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
                {providerName || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Date Processed</p>
            <p className={`font-medium tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {formatDateTime(payment.processedAt)}
            </p>
          </div>
          <div>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Reference</p>
            <p className={`font-mono font-medium tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {payment.reference}
            </p>
          </div>
        </div>

        {/* Customer Info */}
        {payment.customer && (
          <div className={`p-4 rounded-xl mb-6 ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
            <p className={`text-sm font-medium mb-2 eyebrow ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Customer Information
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <span className={isDark ? 'text-white' : 'text-gray-900'}>
                  {payment.customer.name || 'Guest'}
                </span>
              </div>
              {payment.customer.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>
                    {payment.customer.email}
                  </span>
                </div>
              )}
              {payment.customer.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <span className={`tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {payment.customer.phone}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Items */}
        {payment.sale?.items && payment.sale.items.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className={`text-sm font-medium eyebrow ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Items
              </p>
              <span className={`text-sm tabular-nums ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Sale: {payment.sale.receiptNumber}
              </span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
              {payment.sale.items.map((item, index) => (
                <div key={index} className={`flex items-center justify-between py-2 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                  <div>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {item.productName}
                    </p>
                    <p className={`text-sm tabular-nums ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {item.quantity} × {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <span className={`font-medium tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {formatCurrency(item.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        {payment.sale?.items && payment.sale.items.length > 0 && (
          <div className={`p-4 rounded-xl mb-6 ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
            <div className="flex justify-between text-sm">
              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Subtotal</span>
              <span className={`tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {formatCurrency(payment.amount)}
              </span>
            </div>
            <div className="flex justify-between font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className={isDark ? 'text-white' : 'text-gray-900'}>Total</span>
              <span className={`tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {formatCurrency(payment.amount)}
              </span>
            </div>
          </div>
        )}

        {/* Business Info */}
        {payment.businessUnit && (
          <div className={`pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {payment.businessUnit.name}
            </p>
            {payment.businessUnit.address && (
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {payment.businessUnit.address}
              </p>
            )}
            {payment.businessUnit.phone && (
              <p className={`text-sm tabular-nums ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {payment.businessUnit.phone}
              </p>
            )}
            {payment.businessUnit.email && (
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {payment.businessUnit.email}
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className={`mt-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} text-center`}>
          <p className={`text-2xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Thank you for your business!
          </p>
          <p className={`text-2xs tabular-nums ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
            Receipt generated on {formatDateTime(new Date())}
          </p>
          {payment.provider && (
            <p className={`text-2xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
              Payment processed via {getProviderName(payment.provider)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
