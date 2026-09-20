// src/app/(dashboard)/receipts/[saleId]/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../services/api';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency } from '../../../../../utils/formatters';
import { PrinterIcon, EnvelopeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

interface ReceiptData {
  receiptNumber: string;
  date: string;
  cashier: string;
  customer: string;
  items: Array<{
    name: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: string;
  businessName: string;
  businessUnit: string;
  qrCode: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export default function ReceiptPrintPage() {
  const { saleId } = useParams();
  const router = useRouter();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailSending, setEmailSending] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const fetchReceipt = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<ApiResponse<ReceiptData>>(`/receipts/sale/${saleId}`);
      setReceipt(response.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load receipt');
    } finally {
      setLoading(false);
    }
  }, [saleId]);

  useEffect(() => {
    if (saleId) {
      fetchReceipt();
    }
  }, [saleId, fetchReceipt]);

  const handlePrint = () => {
    window.print();
  };

  const handleEmailReceipt = async () => {
    const email = prompt('Enter email address to send receipt:');
    if (!email) return;

    // Simple email validation
    if (!email.includes('@') || !email.includes('.')) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setEmailSending(true);
      await api.post<ApiResponse<{ message: string }>>(`/receipts/sale/${saleId}/email`, { email });
      toast.success('Receipt sent successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send receipt');
    } finally {
      setEmailSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin h-8 w-8 border-b-2 border-brand-600 rounded-full"></div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Receipt not found</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 transition duration-250 focus-ring rounded"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Action Buttons - Hidden when printing */}
      <div className="flex flex-wrap gap-3 mb-6 no-print">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition duration-250 focus-ring rounded-lg px-2 py-1"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Back
        </button>
        <button
          onClick={handlePrint}
          className="btn-brand"
        >
          <PrinterIcon className="w-5 h-5" />
          Print
        </button>
        <button
          onClick={handleEmailReceipt}
          disabled={emailSending}
          className="btn-success"
        >
          <EnvelopeIcon className="w-5 h-5" />
          {emailSending ? 'Sending...' : 'Email'}
        </button>
      </div>

      {/* Receipt */}
      <div
        ref={printRef}
        className="card-brand shadow-soft max-w-md mx-auto p-8"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {receipt.businessName || 'Store'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{receipt.businessUnit || ''}</p>
          <div className="w-16 h-0.5 bg-brand-gradient mx-auto my-3"></div>
          <p className="font-mono font-bold tabular-nums text-brand-600 dark:text-brand-400 text-lg">
            #{receipt.receiptNumber}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {new Date(receipt.date).toLocaleString()}
          </p>
        </div>

        {/* Cashier & Customer */}
        <div className="flex justify-between text-sm mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-2xs uppercase tracking-wider eyebrow">Cashier</p>
            <p className="font-medium text-gray-900 dark:text-white">{receipt.cashier || 'N/A'}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-500 dark:text-gray-400 text-2xs uppercase tracking-wider eyebrow">Customer</p>
            <p className="font-medium text-gray-900 dark:text-white">{receipt.customer || 'Guest'}</p>
          </div>
        </div>

        {/* Items */}
        <div className="py-4 mb-4">
          <div className="flex justify-between text-2xs text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow pb-2 border-b border-gray-100 dark:border-gray-700">
            <span>Item</span>
            <span>Qty</span>
            <span>Price</span>
          </div>
          {receipt.items.map((item, index) => (
            <div key={index} className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white text-sm">{item.name}</p>
                <p className="text-2xs font-mono text-gray-400 dark:text-gray-500">{item.sku || ''}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400 w-8 text-center">
                  ×{item.quantity}
                </span>
                <span className="font-medium tabular-nums text-gray-900 dark:text-white text-sm w-20 text-right">
                  {formatCurrency(item.total)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
            <span className="tabular-nums text-gray-900 dark:text-white">{formatCurrency(receipt.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Tax</span>
            <span className="tabular-nums text-gray-900 dark:text-white">{formatCurrency(receipt.tax)}</span>
          </div>
          {receipt.discount > 0 && (
            <div className="flex justify-between text-sm text-success-600 dark:text-success-400">
              <span>Discount</span>
              <span className="tabular-nums">-{formatCurrency(receipt.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-gray-900 dark:text-white">Total</span>
            <span className="tabular-nums text-brand-600 dark:text-brand-400">
              {formatCurrency(receipt.total)}
            </span>
          </div>
          <div className="flex justify-between text-sm pt-1">
            <span className="text-gray-600 dark:text-gray-400">
              Paid ({receipt.paymentMethod || 'N/A'})
            </span>
            <span className="tabular-nums text-gray-900 dark:text-white">
              {formatCurrency(receipt.paidAmount)}
            </span>
          </div>
          {receipt.changeAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Change</span>
              <span className="tabular-nums text-success-600 dark:text-success-400">
                {formatCurrency(receipt.changeAmount)}
              </span>
            </div>
          )}
        </div>

        {/* QR Code */}
        {receipt.qrCode && (
          <div className="text-center mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
            <img
              src={receipt.qrCode}
              alt="Receipt QR"
              className="mx-auto w-24 h-24"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <p className="text-2xs text-gray-400 dark:text-gray-500 mt-2">Scan to verify receipt</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Thank you for your business!</p>
          <p className="text-2xs text-gray-400 dark:text-gray-500 mt-1">
            Please keep this receipt for your records
          </p>
        </div>
      </div>
    </div>
  );
}
