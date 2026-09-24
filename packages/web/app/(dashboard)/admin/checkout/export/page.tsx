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
  AlertCircle,
  Info,
  RefreshCw,
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { checkoutService } from '../../../../../services/checkoutService';
import { toast } from '../../../../../utils/toast-manager';

// ============================================
// TYPES
// ============================================

/**
 * Formats the backend's `GET /checkout/export/all` endpoint actually
 * produces. Anything else (`excel`, `pdf`) is rejected by the route's
 * `exportCheckoutsSchema`, so the UI must not offer it.
 */
type ExportFormat = 'csv' | 'json';

interface FormatOption {
  value: ExportFormat;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    value: 'csv',
    label: 'CSV',
    description: 'Comma-separated values for spreadsheets',
    icon: FileText,
  },
  {
    value: 'json',
    label: 'JSON',
    description: 'Structured data for programmatic use',
    icon: FileJson,
  },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function CheckoutExportPage() {
  const router = useRouter();
  const { hasPermission, isLoading: permissionLoading } = usePermission();

  const [format, setFormat] = useState<ExportFormat>('csv');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const canExport = hasPermission(PermissionResource.SALE);

  // ============================================
  // HANDLERS
  // ============================================

  const handleExport = useCallback(async () => {
    if (isExporting) return;

    setIsExporting(true);
    setExportComplete(false);
    setExportError(null);

    try {
      const result = await checkoutService.exportCheckouts({
        format,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });

      // `exportCheckouts` returns a `Blob` when `format === 'csv'`, and
      // a `CheckoutExportJsonResponse` when `format === 'json'`.
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

      if (!isMountedRef.current) return;

      setExportComplete(true);
      toast.success('Export completed successfully');

      // Auto-clear the success message after a few seconds.
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) setExportComplete(false);
      }, 5000);
    } catch (error: any) {
      if (!isMountedRef.current) return;
      console.error('Export failed:', error);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to export data';
      setExportError(message);
      toast.error(message);
    } finally {
      if (isMountedRef.current) setIsExporting(false);
    }
  }, [format, dateFrom, dateTo, isExporting]);

  const handleReset = useCallback(() => {
    setFormat('csv');
    setDateFrom('');
    setDateTo('');
    setExportComplete(false);
    setExportError(null);
  }, []);

  // ============================================
  // GUARDS
  // ============================================

  if (permissionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Checking permissions…
          </p>
        </div>
      </div>
    );
  }

  if (!canExport) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
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
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors focus-ring"
        >
          Back to Checkout
        </button>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  const hasFilters = Boolean(dateFrom || dateTo);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push('/admin/checkout')}
              className="p-2 rounded-lg transition hover:bg-gray-200 dark:hover:bg-gray-700 focus-ring"
              aria-label="Back to checkout"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Export Checkout Data
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Download checkout transactions as CSV or JSON
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={isExporting}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
              aria-label="Reset filters"
            >
              <RefreshCw className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Backend-scope notice */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            The backend produces CSV and JSON only. Excel and PDF
            export generators are not yet implemented server-side, so
            those formats are not offered here. The status filter is
            not applied server-side by this endpoint — filter the
            resulting file in your tool of choice.
          </p>
        </div>

        {/* Error banner */}
        {exportError && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Export failed
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                {exportError}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Options */}
          <div className="lg:col-span-2 space-y-6">
            {/* Format */}
            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                Export Format
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FORMAT_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = format === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormat(opt.value)}
                      disabled={isExporting}
                      className={`p-4 rounded-xl border-2 text-left transition-all focus-ring ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                      aria-pressed={isSelected}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            isSelected
                              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`font-semibold ${
                              isSelected
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            {opt.label}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {opt.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Date range */}
            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                Date Range
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="export-date-from"
                    className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300"
                  >
                    From
                  </label>
                  <input
                    id="export-date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    disabled={isExporting}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label
                    htmlFor="export-date-to"
                    className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300"
                  >
                    To
                  </label>
                  <input
                    id="export-date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    disabled={isExporting}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  />
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Leave both fields empty to export every checkout the
                backend will return (capped at the server's export
                limit).
              </p>
            </section>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sticky top-24">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                Export Summary
              </h2>

              <div className="space-y-3 mb-6">
                <SummaryRow label="Format" value={format.toUpperCase()} />
                <SummaryRow
                  label="From"
                  value={dateFrom || '—'}
                />
                <SummaryRow label="To" value={dateTo || '—'} />
                <SummaryRow
                  label="Filename"
                  value={`checkout_export_${new Date()
                    .toISOString()
                    .split('T')[0]}.${format}`}
                  mono
                />
              </div>

              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Exporting…
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Start Export
                  </>
                )}
              </button>

              {hasFilters && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isExporting}
                  className="w-full mt-3 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
                >
                  Clear filters
                </button>
              )}

              {exportComplete && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-green-700 dark:text-green-300">
                  <CheckCircle className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-medium">
                    Export downloaded
                  </span>
                </div>
              )}

              <p className="mt-4 text-xs text-center text-gray-500 dark:text-gray-400">
                Large exports may take a moment to generate.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function SummaryRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">
        {label}
      </span>
      <span
        className={`text-sm font-medium text-gray-900 dark:text-white truncate ${
          mono ? 'font-mono' : ''
        }`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
