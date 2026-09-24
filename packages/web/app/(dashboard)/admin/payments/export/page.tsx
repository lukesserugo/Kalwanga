// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\payments\export\page.tsx

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  FileText,
  FileJson,
  Loader2,
  Calendar,
  Filter,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Lock,
  Clock,
  Users,
  DollarSign,
  CreditCard,
  Printer,
  Shield,
  Zap,
  Sparkles,
  BarChart3,
  PieChart,
  Globe,
  Smartphone,
  Banknote,
  Wallet,
  Building,
  Gift,
  Star,
  Landmark,
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { paymentService } from '../../../../../services/paymentService';
import { toast } from '../../../../../utils/toast-manager';
import { useThemeStore } from '../../../../stores/themeStore';
import { formatCurrency } from '../../../../../utils/formatters';

// ============================================
// TYPES
// ============================================

type ExportFormat = 'csv' | 'json' | 'excel' | 'pdf';

interface ExportPaymentRow {
  id: string;
  reference?: string;
  amount: number;
  currency?: string;
  paymentMethod: string;
  status: string;
  processedAt: string;
  provider?: string;
  gatewayId?: string;
  transactionId?: string;
  saleId?: string;
  orderId?: string;
  userId?: string;
  businessUnitId?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  user?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  sale?: {
    receiptNumber?: string;
    total?: number;
  };
  order?: {
    orderNumber?: string;
    total?: number;
  };
  businessUnit?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
}

// ============================================
// HELPERS
// ============================================

/**
 * Resolve the provider name from a payment row. Reads the legacy
 * top-level field first, then `metadata.provider`, then `gatewayId`.
 */
function resolveProvider(payment: ExportPaymentRow): string {
  if (payment.provider) return payment.provider;
  const meta = payment.metadata ?? {};
  const metaProvider =
    typeof meta.provider === 'string' ? meta.provider : undefined;
  return metaProvider || payment.gatewayId || '';
}

/**
 * Escape a value for CSV. Quotes the value if it contains a comma,
 * a double quote, a newline, or leading/trailing whitespace. Doubles
 * any interior quotes as per RFC 4180.
 */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  const needsQuotes =
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r') ||
    str.trim() !== str;
  if (!needsQuotes) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Build a CSV string from payment rows. Columns are stable and
 * ordered so a user opening the file in Excel sees a predictable
 * layout.
 */
function buildCsv(
  rows: ExportPaymentRow[],
  options: {
    includeRefunds: boolean;
    includeCustomer: boolean;
    includeBusinessUnit: boolean;
  },
): string {
  const headers = [
    'Reference',
    'Date',
    'Amount',
    'Currency',
    'Payment Method',
    'Status',
    'Provider',
    'Transaction ID',
    'Sale Receipt',
    'Order Number',
  ];

  if (options.includeRefunds) {
    headers.push('Refunded', 'Refund Reason');
  }
  if (options.includeCustomer) {
    headers.push('Customer Name', 'Customer Email', 'Customer Phone');
  }
  if (options.includeBusinessUnit) {
    headers.push(
      'Business Unit',
      'Business Unit Address',
      'Business Unit Phone',
      'Business Unit Email',
    );
  }

  const lines: string[] = [headers.map(csvEscape).join(',')];

  for (const payment of rows) {
    const customerName = payment.user
      ? `${payment.user.firstName ?? ''} ${payment.user.lastName ?? ''}`.trim()
      : '';

    const row: unknown[] = [
      payment.reference || payment.id,
      payment.processedAt,
      payment.amount.toFixed(2),
      payment.currency || 'USD',
      payment.paymentMethod,
      payment.status,
      resolveProvider(payment),
      payment.transactionId || '',
      payment.sale?.receiptNumber || '',
      payment.order?.orderNumber || '',
    ];

    if (options.includeRefunds) {
      const isRefunded =
        payment.status === 'REFUNDED' ||
        typeof (payment as any).refundedAt === 'string';
      row.push(isRefunded ? 'Yes' : 'No');
      row.push((payment as any).refundReason || '');
    }

    if (options.includeCustomer) {
      row.push(customerName, payment.user?.email || '', payment.user?.phone || '');
    }

    if (options.includeBusinessUnit) {
      row.push(
        payment.businessUnit?.name || '',
        payment.businessUnit?.address || '',
        payment.businessUnit?.phone || '',
        payment.businessUnit?.email || '',
      );
    }

    lines.push(row.map(csvEscape).join(','));
  }

  return lines.join('\r\n');
}

/**
 * Build a print-friendly HTML document for PDF export. Opening it
 * in a new tab lets the user use the browser's native
 * Print → Save as PDF, which produces a correctly paginated,
 * styled document without pulling in a PDF library.
 */
function buildPrintHtml(
  rows: ExportPaymentRow[],
  title: string,
  options: {
    includeRefunds: boolean;
    includeCustomer: boolean;
    includeBusinessUnit: boolean;
  },
): string {
  const total = rows.reduce((sum, p) => sum + p.amount, 0);

  const rowsHtml = rows
    .map((payment) => {
      const customerName = payment.user
        ? `${payment.user.firstName ?? ''} ${payment.user.lastName ?? ''}`.trim()
        : '';

      const cells = [
        `<td>${escapeHtml(payment.reference || payment.id)}</td>`,
        `<td>${escapeHtml(new Date(payment.processedAt).toLocaleString())}</td>`,
        `<td class="right">${escapeHtml(payment.amount.toFixed(2))}</td>`,
        `<td>${escapeHtml(payment.paymentMethod)}</td>`,
        `<td>${escapeHtml(payment.status)}</td>`,
        `<td>${escapeHtml(resolveProvider(payment))}</td>`,
      ];

      if (options.includeCustomer) {
        cells.push(
          `<td>${escapeHtml(customerName)}</td>`,
          `<td>${escapeHtml(payment.user?.email || '')}</td>`,
        );
      }
      if (options.includeBusinessUnit) {
        cells.push(`<td>${escapeHtml(payment.businessUnit?.name || '')}</td>`);
      }
      if (options.includeRefunds) {
        const isRefunded =
          payment.status === 'REFUNDED' ||
          typeof (payment as any).refundedAt === 'string';
        cells.push(`<td>${isRefunded ? 'Yes' : 'No'}</td>`);
      }

      return `<tr>${cells.join('')}</tr>`;
    })
    .join('');

  const headers = [
    'Reference',
    'Date',
    'Amount',
    'Method',
    'Status',
    'Provider',
  ];
  if (options.includeCustomer) headers.push('Customer', 'Email');
  if (options.includeBusinessUnit) headers.push('Business Unit');
  if (options.includeRefunds) headers.push('Refunded');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
  .summary { display: flex; gap: 24px; margin-bottom: 16px; font-size: 13px; }
  .summary strong { display: block; font-size: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; background: #f3f4f6; padding: 6px 8px; border-bottom: 1px solid #d1d5db; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  td.right { text-align: right; font-variant-numeric: tabular-nums; }
  tr:nth-child(even) td { background: #fafafa; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Generated ${escapeHtml(new Date().toLocaleString())}</div>
  <div class="summary">
    <div><span>Transactions</span><strong>${rows.length}</strong></div>
    <div><span>Total Amount</span><strong>${total.toFixed(2)}</strong></div>
  </div>
  <table>
    <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Trigger a browser download for a Blob.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Open an HTML document in a new tab and immediately invoke print.
 */
function openPrintDocument(html: string): void {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    toast.error('Pop-up blocked. Allow pop-ups to export as PDF.');
  }
  // The blob URL is revoked after a delay to give the new tab time
  // to load. Revoking immediately breaks the print view.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ============================================
// CONSTANTS
// ============================================

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
  { value: 'csv' as const, label: 'CSV', icon: FileText },
  { value: 'json' as const, label: 'JSON', icon: FileJson },
  { value: 'excel' as const, label: 'Excel', icon: FileSpreadsheet },
  { value: 'pdf' as const, label: 'PDF', icon: FileText },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminPaymentExportPage() {
  const router = useRouter();
  const { canView, canManage, isLoading: permissionLoading } =
    usePermission();
  const { isDark } = useThemeStore();

  const [format, setFormat] = useState<ExportFormat>('csv');
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

  const canViewPayments =
    canView(PermissionResource.PAYMENT) ||
    canManage(PermissionResource.PAYMENT);

  // ── Export handler ───────────────────────────────────────────

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportComplete(false);

    try {
      // Build the query params. The backend expects `startDate` /
      // `endDate`, NOT `dateFrom` / `dateTo`.
      const params: Record<string, unknown> = {
        limit: 10000,
      };

      if (dateFrom) params.startDate = dateFrom;
      if (dateTo) params.endDate = dateTo;
      if (status !== 'all') params.status = status;
      if (paymentMethod !== 'all') params.paymentMethod = paymentMethod;
      if (provider !== 'all') params.provider = provider;

      const response = await paymentService.getPayments(params);

      const rows: ExportPaymentRow[] = Array.isArray(response.data)
        ? (response.data as unknown as ExportPaymentRow[])
        : [];

      if (rows.length === 0) {
        toast.warning('No payments match your filters');
        return;
      }

      const timestamp = new Date().toISOString().split('T')[0];
      const baseName = `payments_export_${timestamp}`;
      const title = 'Payment Export';

      switch (format) {
        case 'csv': {
          const csv = buildCsv(rows, {
            includeRefunds,
            includeCustomer,
            includeBusinessUnit,
          });
          downloadBlob(
            new Blob([csv], { type: 'text/csv;charset=utf-8' }),
            `${baseName}.csv`,
          );
          break;
        }

        case 'excel': {
          // Excel opens CSVs natively. Naming the file `.xlsx` would
          // be misleading — a real .xlsx is a ZIP archive — so we
          // download a real `.csv` and let Excel open it. If you
          // need true XLSX output, add a library like `xlsx` and
          // call `XLSX.writeFile` here.
          const csv = buildCsv(rows, {
            includeRefunds,
            includeCustomer,
            includeBusinessUnit,
          });
          downloadBlob(
            new Blob([csv], { type: 'text/csv;charset=utf-8' }),
            `${baseName}.csv`,
          );
          break;
        }

        case 'json': {
          const payload = {
            generatedAt: new Date().toISOString(),
            filters: {
              status,
              paymentMethod,
              provider,
              dateFrom: dateFrom || null,
              dateTo: dateTo || null,
            },
            total: rows.length,
            data: rows.map((p) => ({
              ...p,
              provider: resolveProvider(p),
            })),
          };
          downloadBlob(
            new Blob([JSON.stringify(payload, null, 2)], {
              type: 'application/json',
            }),
            `${baseName}.json`,
          );
          break;
        }

        case 'pdf': {
          const html = buildPrintHtml(rows, title, {
            includeRefunds,
            includeCustomer,
            includeBusinessUnit,
          });
          openPrintDocument(html);
          break;
        }
      }

      setExportComplete(true);
      toast.success(
        format === 'pdf'
          ? 'Export opened in a new tab — use Print to save as PDF'
          : 'Export completed successfully',
      );
    } catch (error: any) {
      console.error('Export failed:', error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to export data',
      );
    } finally {
      setIsExporting(false);
    }
  }, [
    format,
    dateFrom,
    dateTo,
    status,
    paymentMethod,
    provider,
    includeRefunds,
    includeCustomer,
    includeBusinessUnit,
  ]);

  // ── Lookups ──────────────────────────────────────────────────

  const getProviderImageUrl = useCallback(
    (providerCode: string): string => {
      if (!providerCode || providerCode === 'all') return '';
      return isDark && PROVIDER_DARK_IMAGE_URLS[providerCode]
        ? PROVIDER_DARK_IMAGE_URLS[providerCode]
        : PROVIDER_IMAGE_URLS[providerCode] || '';
    },
    [isDark],
  );

  const getFormatIcon = useCallback(() => {
    const opt = FORMAT_OPTIONS.find((f) => f.value === format);
    const Icon = opt?.icon || FileText;
    return <Icon className="w-5 h-5" />;
  }, [format]);

  const providerLabel = useMemo(() => {
    return (
      PROVIDER_OPTIONS.find((p) => p.value === provider)?.label || 'All'
    );
  }, [provider]);

  const statusLabel = useMemo(() => {
    return (
      STATUS_OPTIONS.find((s) => s.value === status)?.label || 'All'
    );
  }, [status]);

  const methodLabel = useMemo(() => {
    return (
      PAYMENT_METHOD_OPTIONS.find((m) => m.value === paymentMethod)
        ?.label || 'All'
    );
  }, [paymentMethod]);

  // ── Render gates ─────────────────────────────────────────────

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
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          You don't have permission to export payment data.
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

  // ── Main render ──────────────────────────────────────────────

  return (
    <div
      className={`min-h-screen p-6 ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}
    >
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
            <h1
              className={`text-2xl font-bold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              Export Payment Data
            </h1>
            <p
              className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Export payment transactions in various formats
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Export Options */}
          <div className="lg:col-span-2">
            <div className="card-brand shadow-soft">
              <h2
                className={`text-lg font-semibold mb-4 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                Export Options
              </h2>

              {/* Format Selection */}
              <div className="mb-6">
                <label
                  className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Export Format
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {FORMAT_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setFormat(opt.value)}
                        className={`p-3 rounded-xl text-sm font-medium transition duration-250 flex flex-col items-center gap-1 focus-ring ${
                          format === opt.value
                            ? 'bg-brand-gradient text-white shadow-brand'
                            : isDark
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        aria-pressed={format === opt.value}
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
                  <label
                    className={`block text-sm font-medium mb-1 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
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
                  <label
                    className={`block text-sm font-medium mb-1 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
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
                  <label
                    className={`block text-sm font-medium mb-1 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
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
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
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
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${
                      isDark
                        ? 'bg-gray-700 text-white border-gray-600'
                        : 'bg-gray-100 text-gray-900 border-gray-300'
                    } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                  >
                    {PAYMENT_METHOD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
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
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${
                      isDark
                        ? 'bg-gray-700 text-white border-gray-600'
                        : 'bg-gray-100 text-gray-900 border-gray-300'
                    } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
                  >
                    {PROVIDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
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
                    id="include-refunds"
                  />
                  <label
                    htmlFor="include-refunds"
                    className={`text-sm ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Include refunds
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={includeCustomer}
                    onChange={(e) => setIncludeCustomer(e.target.checked)}
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 transition duration-250"
                    id="include-customer"
                  />
                  <label
                    htmlFor="include-customer"
                    className={`text-sm ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Include customer information
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={includeBusinessUnit}
                    onChange={(e) =>
                      setIncludeBusinessUnit(e.target.checked)
                    }
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 transition duration-250"
                    id="include-business-unit"
                  />
                  <label
                    htmlFor="include-business-unit"
                    className={`text-sm ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Include business unit
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Summary & Actions */}
          <div>
            <div className="card-brand shadow-soft">
              <h2
                className={`text-lg font-semibold mb-4 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                Export Summary
              </h2>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    Format
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      isDark ? 'text-white' : 'text-gray-900'
                    } flex items-center gap-2`}
                  >
                    {getFormatIcon()}
                    {format.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    Date Range
                  </span>
                  <span
                    className={`text-sm font-medium tabular-nums ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {dateFrom || 'All'} - {dateTo || 'All'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    Status
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    Method
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {methodLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    Provider
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      isDark ? 'text-white' : 'text-gray-900'
                    } flex items-center gap-2`}
                  >
                    {provider !== 'all' &&
                    getProviderImageUrl(provider) ? (
                      <Image
                        src={getProviderImageUrl(provider)}
                        alt={providerLabel}
                        width={20}
                        height={20}
                        className="rounded object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display =
                            'none';
                        }}
                      />
                    ) : null}
                    {providerLabel}
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
                  <span className="text-sm font-medium">
                    Export completed successfully!
                  </span>
                </div>
              )}

              <p
                className={`mt-4 text-xs text-center ${
                  isDark ? 'text-gray-500' : 'text-gray-400'
                }`}
              >
                Export may take a moment depending on the amount of data
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
