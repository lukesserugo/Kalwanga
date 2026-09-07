// D:\Projects\Kalwanga\packages\web\components\payment\PaymentReceipt.tsx

'use client';

import { useState } from 'react';
import {
  Receipt, Printer, Download, Copy, CheckCircle,
  Calendar, Clock, DollarSign, CreditCard, User,
  Mail, Phone, MapPin, Building, Package,
  FileText, Share2, ExternalLink, X
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
// MAIN COMPONENT
// ============================================

export function PaymentReceipt({
  payment,
  onClose,
  className = '',
}: PaymentReceiptProps) {
  const { isDark } = useThemeStore();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = `Receipt #${payment.reference}\nAmount: ${formatCurrency(payment.amount)}\nDate: ${formatDateTime(payment.processedAt)}\nStatus: ${payment.status}`;
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
      status: payment.status,
      date: payment.processedAt,
      items: payment.sale?.items || [],
      customer: payment.customer,
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

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      'CASH': 'Cash',
      'CREDIT_CARD': 'Credit Card',
      'DEBIT_CARD': 'Debit Card',
      'MOBILE_MONEY': 'Mobile Money',
      'BANK_TRANSFER': 'Bank Transfer',
      'GIFT_CARD': 'Gift Card',
      'LOYALTY_POINTS': 'Loyalty Points',
      'CHECK': 'Check',
    };
    return labels[method] || method;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'PAID': 'text-green-600 dark:text-green-400',
      'PENDING': 'text-yellow-600 dark:text-yellow-400',
      'FAILED': 'text-red-600 dark:text-red-400',
      'REFUNDED': 'text-gray-600 dark:text-gray-400',
      'PARTIAL': 'text-blue-600 dark:text-blue-400',
    };
    return colors[status] || 'text-gray-600 dark:text-gray-400';
  };

  return (
    <div className={className} id="receipt">
      {/* Receipt Content */}
      <div className={`p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Receipt className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            <div>
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Payment Receipt
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                #{payment.reference}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`p-2 rounded-lg transition ${
                isDark
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
              title="Copy receipt"
            >
              {copied ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={handlePrint}
              className={`p-2 rounded-lg transition ${
                isDark
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
              title="Print receipt"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownload}
              className={`p-2 rounded-lg transition ${
                isDark
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
              title="Download receipt"
            >
              <Download className="w-4 h-4" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition ${
                  isDark
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                }`}
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Status & Amount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Amount</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {formatCurrency(payment.amount)}
            </p>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Status</p>
            <p className={`text-lg font-semibold ${getStatusColor(payment.status)}`}>
              {payment.status}
            </p>
          </div>
        </div>

        {/* Payment Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Payment Method</p>
            <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {getPaymentMethodLabel(payment.paymentMethod)}
            </p>
          </div>
          <div>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Date</p>
            <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {formatDateTime(payment.processedAt)}
            </p>
          </div>
        </div>

        {/* Customer Info */}
        {payment.customer && (
          <div className={`p-4 rounded-lg mb-6 ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
            <p className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Customer Information
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className={isDark ? 'text-white' : 'text-gray-900'}>
                  {payment.customer.name || 'Guest'}
                </span>
              </div>
              {payment.customer.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>
                    {payment.customer.email}
                  </span>
                </div>
              )}
              {payment.customer.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>
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
            <p className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Items
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {payment.sale.items.map((item, index) => (
                <div key={index} className={`flex items-center justify-between py-2 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                  <div>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {item.productName}
                    </p>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {item.quantity} × {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {formatCurrency(item.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Business Info */}
        {payment.businessUnit && (
          <div className={`pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {payment.businessUnit.name}
            </p>
            {payment.businessUnit.address && (
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {payment.businessUnit.address}
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className={`mt-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} text-center`}>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Thank you for your business!
          </p>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
            Receipt generated on {formatDateTime(new Date())}
          </p>
        </div>
      </div>
    </div>
  );
}
