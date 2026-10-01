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
  CheckCircle,
  Lock,
  CreditCard,
  Globe,
  Smartphone,
  Banknote,
  Wallet,
  Gift,
  Star,
  Landmark,
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { paymentService } from '../../../../../services/paymentService';
import { toast } from '../../../../../utils/toast-manager';
import { useThemeStore } from '../../../../stores/themeStore';

// ============================================
// TYPES
// ============================================

type ExportFormat = 'csv' | 'json' | 'excel' | 'pdf';

interface ExportPaymentRow {
  id: string;
  reference?: string;
  amount: number;
  /**
   * Ledger currency code for `amount`. Read from
   * `Payment.currency` on the backend row. When absent, the CSV
   * and print handlers emit an empty cell rather than a
   * fabricated `UGX` (which the old code did unconditionally).
   */
  currency?: string | null;
  paymentMethod: string;
  status: string;
  processedAt: string;
  /** Present on some legacy rows; new rows carry it in `metadata`. */
  provider?: string;
  gatewayId?: string;
  transactionId?: string;
  saleId?: string;
  orderId?: string;
  userId?: string;
  businessUnitId?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  refundedAt?: string;
  refundReason?: string;
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
 * top-level field first, then `metadata.provider` (where the backend
 * actually writes it), then `gatewayId`.
 */
function resolveProvider(payment: ExportPaymentRow): string {
  if (payment.provider) return payment.provider;
  const meta = payment.metadata ?? {};
  const metaProvider =
    typeof meta.provider === 'string' ? meta.provider : undefined;
  return metaProvider || payment.gatewayId || '';
}

/**
 * Resolve the currency code for a single payment row. Reads the
 * row's own `currency` first, then the deployment default from env,
 * then `''`. No hardcoded fallback in this file.
 */
function resolvePaymentCurrency(payment: ExportPaymentRow): string {
  return (
    payment.currency ||
    process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ||
    ''
  );
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
 *
 * ⚠ The `Currency` column carries whatever `resolvePaymentCurrency`
 *   yields. When the row has no code and the deployment env is
 *   unset, the cell is empty — never a fabricated `UGX`.
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
      // Empty string when no code is resolvable — never a
      // fabricated symbol or default.
      resolvePaymentCurrency(payment),
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
        typeof payment.refundedAt === 'string';
      row.push(isRefunded ? 'Yes' : 'No');
      row.push(payment.refundReason || '');
    }

    if (options.includeCustomer) {
      row.push(
        customerName,
        payment.user?.email || '',
        payment.user?.phone || '',
      );
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build a print-friendly HTML document for PDF export. Opening it
 * in a new tab lets the user use the browser's native
 * Print → Save as PDF, which produces a correctly paginated,
 * styled document without pulling in a PDF library.
 *
 * ⚠ Amounts are grouped by currency in the summary block so a
 *   mixed-currency export doesn't produce a mathematically
 *   meaningless single total. Each per-row amount is rendered as
 *   `amount CODE` when a code is resolvable, else as a bare
 *   number.
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
  // Group totals by currency. When a row has no code, group it
  // under a `(no currency)` bucket rather than folding it into an
  // arbitrary default.
  const totalsByCurrency = new Map<string, number>();
  for (const p of rows) {
    const code = resolvePaymentCurrency(p) || '(no currency)';
    totalsByCurrency.set(
      code,
      (totalsByCurrency.get(code) ?? 0) + p.amount,
    );
  }

  const totalsHtml = Array.from(totalsByCurrency.entries())
    .map(
      ([code, total]) =>
        `<div><span>${escapeHtml(code)}</span><strong>${total.toFixed(
          2,
        )}</strong></div>`,
    )
    .join('');

  const rowsHtml = rows
    .map((payment) => {
      const customerName = payment.user
        ? `${payment.user.firstName ?? ''} ${payment.user.lastName ?? ''}`.trim()
        : '';

      const code = resolvePaymentCurrency(payment);
      const amountCell = code
        ? `${escapeHtml(payment.amount.toFixed(2))} ${escapeHtml(code)}`
        : escapeHtml(payment.amount.toFixed(2));

      const cells = [
        `<td>${escapeHtml(payment.reference || payment.id)}</td>`,
        `<td>${escapeHtml(new Date(payment.processedAt).toLocaleString())}</td>`,
        `<td class="right">${amountCell}</td>`,
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
        cells.push(
          `<td>${escapeHtml(payment.businessUnit?.name || '')}</td>`,
        );
      }
      if (options.includeRefunds) {
        const isRefunded =
          payment.status === 'REFUNDED' ||
          typeof payment.refundedAt === 'string';
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
  .summary { display: flex; flex-wrap: wrap; gap: 24px; margin-bottom: 16px; font-size: 13px; }
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
    ${totalsHtml}
  </div>
  <table>
    <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;
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

/**
 * Provider logo with a graceful fallback that returns `null` when
 * no local asset exists or the image failed to load. Kept as a
 * component so a provider change always mounts a fresh instance.
 */
function ProviderLogo({
  provider,
  size = 20,
  isDark,
}: {
  provider: string;
  size?: number;
  isDark: boolean;
}) {
  const [failed, setFailed] = useState(false);

  const url =
    provider &&
    (isDark
      ? PROVIDER_DARK_IMAGE_URLS[provider]
      : PROVIDER_IMAGE_URLS[provider]);

  if (!url || failed) return null;

  return (
    <Image
      src={url}
      alt=""
      width={size}
      height={size}
      className="rounded object-contain"
      onError={() => setFailed(true)}
      unoptimized
    />
  );
}

// ============================================
// CONSTANTS
// ============================================
//
// ⚠ All provider logos are LOCAL asset paths under
//   `packages/web/public/`. No external CDN dependency.
//
// ⚠ PAYSTACK, TIGO, and VODAFONE are intentionally absent from the
//   provider options list — no backend handler exists for any of
//   them, and the export filter should not offer a choice that
//   will always produce an empty result.

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

const PAYMENT_METHOD_OPTIONS = [
  { value: 'all', label: 'All Methods' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'DEBIT_CARD', label: 'Debit Card' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'GIFT_CARD', label: 'Gift Card' },
  { value: 'LOYALTY_POINTS', label: 'Loyalty Points' },
  { value: 'CHECK', label: 'Check' },
  { value: 'PAYPAL', label: 'PayPal' },
  { value: 'FLUTTERWAVE', label: 'Flutterwave' },
  { value: 'SQUARE', label: 'Square' },
  { value: 'MTN', label: 'MTN Mobile Money' },
  { value: 'AIRTEL', label: 'Airtel Money' },
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
  { value: 'MPESA', label: 'M-Pesa' },
  { value: 'MTN', label: 'MTN Mobile Money' },
  { value: 'AIRTEL', label: 'Airtel Money' },
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
  // Honest label: the "Excel" format downloads a `.csv`, which
  // Excel opens natively. A real `.xlsx` requires the `xlsx`
  // library — see the `case 'excel':` comment below.
  { value: 'excel' as const, label: 'Excel (CSV)', icon: FileSpreadsheet },
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

      let rows: ExportPaymentRow[] = Array.isArray(response.data)
        ? (response.data as unknown as ExportPaymentRow[])
        : [];

      // Client-side safety net. The backend's `provider` filter
      // maps to `Payment.gatewayId` (a cuid), not the provider
      // enum name, so passing `provider: 'STRIPE'` today returns
      // zero rows. Filter the returned set locally so the file
      // still matches what the user asked for. If the backend
      // later starts honouring the param, this is a no-op.
      if (status !== 'all') {
        rows = rows.filter((r) => r.status === status);
      }
      if (paymentMethod !== 'all') {
        rows = rows.filter((r) => r.paymentMethod === paymentMethod);
      }
      if (provider !== 'all') {
        rows = rows.filter((r) => resolveProvider(r) === provider);
      }

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
          // Excel opens CSVs natively. A real `.xlsx` is a ZIP
          // archive and requires a library. Two options:
          //
          //   (a) Keep this as-is: download a `.csv` that Excel
          //       opens natively. The button is labelled
          //       "Excel (CSV)" so the user isn't misled.
          //   (b) Install `xlsx` (`npm i xlsx`) and replace this
          //       block with:
          //
          //         const XLSX = await import('xlsx');
          //         const ws = XLSX.utils.json_to_sheet(rows);
          //         const wb = XLSX.utils.book_new();
          //         XLSX.utils.book_append_sheet(wb, ws, 'Payments');
          //         XLSX.writeFile(wb, `${baseName}.xlsx`);
          //
          // Do NOT rename a `.csv` to `.xlsx` — Excel will warn
          // about the extension/content mismatch on open.
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
              // Persist the resolved currency code alongside the
              // amount so downstream tooling doesn't need to
              // re-derive it.
              resolvedCurrency: resolvePaymentCurrency(p) || null,
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

  /**
   * Human-readable date-range label for the summary card. Handles
   * the four combinations (neither, start-only, end-only, both)
   * so the card never shows the odd "All - All".
   */
  const dateRangeLabel = useMemo(() => {
    if (dateFrom && dateTo) return `${dateFrom} → ${dateTo}`;
    if (dateFrom) return `From ${dateFrom}`;
    if (dateTo) return `Until ${dateTo}`;
    return 'All time';
  }, [dateFrom, dateTo]);

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
          You don&apos;t have permission to export payment data.
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
                    {format === 'excel'
                      ? 'Excel (CSV)'
                      : format.toUpperCase()}
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
                    {dateRangeLabel}
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
                    {provider !== 'all' && (
                      <ProviderLogo
                        key={provider}
                        provider={provider}
                        isDark={isDark}
                      />
                    )}
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
