// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\checkout\export\page.tsx

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  FileJson,
  FileText,
  Loader2,
  Lock,
  CheckCircle,
  Info,
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { checkoutService } from '../../../../../services/checkoutService';
import { toast } from '../../../../../utils/toast-manager';

type ExportFormat = 'csv' | 'json';

export default function CheckoutExportPage() {
  const router = useRouter();
  const { hasPermission, isLoading: permissionLoading } = usePermission();

  const [format, setFormat] = useState<ExportFormat>('csv');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('all');
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const canExport = hasPermission(PermissionResource.SALE);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportComplete(false);

    try {
      const result = await checkoutService.exportCheckouts({
        format,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });

      const blob =
        result instanceof Blob
          ? result
          : new Blob([JSON.stringify(result, null, 2)], {
              type: 'application/json',
            });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `checkout_export_${new Date()
        .toISOString()
        .split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (isMountedRef.current) setExportComplete(true);
      toast.success('Export completed successfully');
    } catch (error: any) {
      console.error('Export failed:', error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to export data',
      );
    } finally {
      if (isMountedRef.current) setIsExporting(false);
    }
  }, [format, dateFrom, dateTo]);

  // ============================================
  // GUARDS
  // ============================================

  if (permissionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!canExport) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to export checkout data.
        </p>
        <button
          type="button"
          onClick={() => router.push('/admin/checkout')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Back to Checkout
        </button>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push('/admin/checkout')}
            className="p-2 rounded-lg transition hover:bg-gray-200 dark:hover:bg-gray-700 focus-ring"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Export Checkout Data
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Export checkout transactions in CSV or JSON
            </p>
          </div>
        </div>
      </div>

      {/* Notice */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300 mb-6">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          The backend currently produces CSV and JSON only. Excel and
          PDF exports are disabled until the corresponding server-side
          generators are implemented.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Options */}
        <div className="lg:col-span-2">
          <div className="rounded-xl p-6 shadow-sm bg-white dark:bg-gray-800">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Export Options
            </h2>

            {/* Format */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Export Format
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: 'csv', label: 'CSV', icon: FileText },
                    { value: 'json', label: 'JSON', icon: FileJson },
                  ] as const
                ).map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormat(opt.value)}
                      className={`p-4 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 focus-ring ${
                        format === opt.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Date From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Date To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Status filter — informational only, see note */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="COMPLETED">Completed</option>
                <option value="PENDING">Pending</option>
                <option value="PROCESSING">Processing</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="VOID">Void</option>
              </select>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                The status filter is not applied server-side for this
                endpoint. Filter the file client-side after download.
              </p>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div>
          <div className="rounded-xl p-6 shadow-sm bg-white dark:bg-gray-800">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Export Summary
            </h2>

            <div className="space-y-3 mb-6">
              <SummaryRow label="Format" value={format.toUpperCase()} />
              <SummaryRow
                label="Date Range"
                value={`${dateFrom || 'All'} – ${dateTo || 'All'}`}
              />
              <SummaryRow
                label="Status"
                value={status === 'all' ? 'All' : status}
              />
            </div>

            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 focus-ring"
            >
              {isExporting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              {isExporting ? 'Exporting…' : 'Start Export'}
            </button>

            {exportComplete && (
              <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">
                  Export completed successfully!
                </span>
              </div>
            )}

            <p className="mt-4 text-xs text-center text-gray-500 dark:text-gray-400">
              Export may take a moment depending on the amount of data
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
        {value}
      </span>
    </div>
  );
}
