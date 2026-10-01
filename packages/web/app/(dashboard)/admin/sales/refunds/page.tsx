// packages/web/app/(dashboard)/admin/sales/refunds/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Search,
  RefreshCw,
  Eye,
  Printer,
  ChevronLeft,
  ChevronRight,
  XCircle,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  Loader2,
  Users,
  Package,
  FileText,
} from 'lucide-react';
import { saleService } from '../../../../../services/saleService';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from '../../../../../utils/formatters';
import { useAuth } from '../../../../../hooks/useAuth';
import { toast } from '../../../../../utils/toast-manager';
import { api } from '../../../../../services/api';

async function fetchRefundsRemote(params: {
  page?: number;
  limit?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ data: any[]; total?: number; totalPages?: number; currency?: string }> {
  const response = await api.get<any>('/sales/refunds', { params });
  const body =
    response && typeof response === 'object' && 'data' in response
      ? (response as any).data
      : response;

  const data = Array.isArray(body)
    ? body
    : Array.isArray(body?.data)
      ? body.data
      : [];
  const pagination = body?.pagination ?? response?.pagination ?? {};
  const currency =
    (response && typeof response === 'object' && (response as any).currency) ||
    (body && typeof body === 'object' && (body as any).currency) ||
    undefined;

  return {
    data,
    total:
      typeof pagination.total === 'number' ? pagination.total : data.length,
    totalPages:
      typeof pagination.totalPages === 'number' ? pagination.totalPages : 1,
    currency,
  };
}

async function exportSalesRemote(params: {
  startDate?: string;
  endDate?: string;
  format?: 'json' | 'csv' | 'excel' | 'pdf';
}): Promise<{ data: any[]; total?: number; format?: string; currency?: string }> {
  const response = await api.get<any>('/sales/export', { params });
  const body =
    response && typeof response === 'object' && 'data' in response
      ? (response as any).data
      : response;

  const currency =
    (response && typeof response === 'object' && (response as any).currency) ||
    (body && typeof body === 'object' && (body as any).currency) ||
    undefined;

  if (body && typeof body === 'object' && Array.isArray(body.data)) {
    return {
      data: body.data,
      total: typeof body.total === 'number' ? body.total : body.data.length,
      format: typeof body.format === 'string' ? body.format : params.format,
      currency,
    };
  }
  if (Array.isArray(body)) {
    return { data: body, total: body.length, format: params.format, currency };
  }
  return { data: [], total: 0, format: params.format, currency };
}

type RefundStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'CANCELLED';

type RefundMethod =
  | 'CASH'
  | 'CREDIT'
  | 'STORE_CREDIT'
  | 'ORIGINAL_PAYMENT'
  | 'BANK_TRANSFER';

type RefundType = 'FULL' | 'PARTIAL' | 'full' | 'partial';

interface RefundItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  reason?: string | null;
}

interface Refund {
  id: string;
  refundNumber: string;
  saleId: string;
  receiptNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items: RefundItem[];
  subtotal: number;
  tax: number;
  total: number;
  reason: string;
  status: RefundStatus;
  refundMethod: RefundMethod;
  refundType: RefundType;
  notes?: string;
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
  /**
   * ISO 4217 ledger currency for every amount on this refund.
   * Resolved server-side from the owning business unit.
   */
  currency?: string;
}

interface RefundFilters {
  search: string;
  status: string;
  startDate: string;
  endDate: string;
  page: number;
  limit: number;
}

interface RefundStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  completed: number;
  cancelled: number;
  totalAmount: number;
  averageRefund: number;
  byMethod: {
    CASH: number;
    CREDIT: number;
    STORE_CREDIT: number;
    ORIGINAL_PAYMENT: number;
    BANK_TRANSFER: number;
  };
}

function normalizeRefundStatus(
  raw: string | null | undefined,
): RefundStatus {
  const value = (raw || 'PENDING').toUpperCase();
  switch (value) {
    case 'PENDING':
    case 'APPROVED':
    case 'REJECTED':
    case 'COMPLETED':
    case 'CANCELLED':
      return value as RefundStatus;
    default:
      return 'PENDING';
  }
}

function normalizeRefundMethod(
  raw: string | null | undefined,
): RefundMethod {
  const value = (raw || 'ORIGINAL_PAYMENT').toUpperCase();
  switch (value) {
    case 'CASH':
    case 'CREDIT':
    case 'STORE_CREDIT':
    case 'ORIGINAL_PAYMENT':
    case 'BANK_TRANSFER':
      return value as RefundMethod;
    default:
      return 'ORIGINAL_PAYMENT';
  }
}

function normalizeRefundType(
  raw: string | null | undefined,
): 'FULL' | 'PARTIAL' {
  const value = (raw || 'full').toUpperCase();
  return value === 'PARTIAL' ? 'PARTIAL' : 'FULL';
}

/**
 * Extract the ledger currency for a sale from any of the places it
 * may appear:
 *   1. `sale.currency`               (Phase 2 top-level)
 *   2. `sale.payments[0].currency`   (per-payment fallback)
 *   3. `sale.businessUnit.currency`  (BU record)
 *
 * Returns `undefined` when none is present. Callers must then fall
 * back to a safe default (e.g. the response envelope's `currency`,
 * or the registry default).
 */
function resolveSaleCurrency(sale: any): string | undefined {
  if (!sale || typeof sale !== 'object') return undefined;
  if (typeof sale.currency === 'string' && sale.currency) return sale.currency;
  const firstPayment = Array.isArray(sale.payments) ? sale.payments[0] : null;
  if (firstPayment && typeof firstPayment.currency === 'string' && firstPayment.currency) {
    return firstPayment.currency;
  }
  if (
    sale.businessUnit &&
    typeof sale.businessUnit.currency === 'string' &&
    sale.businessUnit.currency
  ) {
    return sale.businessUnit.currency;
  }
  return undefined;
}

function saleRefundToRefund(sale: any, refund: any): Refund {
  const customer = sale.customer || {};

  const items: RefundItem[] = (refund.items || sale.items || []).map(
    (item: any) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product?.name || item.productName || 'Item',
      sku: item.product?.sku || item.sku || 'N/A',
      quantity: item.quantity || 0,
      unitPrice: item.unitPrice || 0,
      total: item.total || 0,
      reason: item.reason ?? null,
    }),
  );

  return {
    id: refund.id,
    refundNumber:
      refund.refundNumber || `REF-${refund.id?.slice(-6) || 'N/A'}`,
    saleId: sale.id,
    receiptNumber: sale.receiptNumber || 'N/A',
    customerName: sale.customerName
      ? sale.customerName
      : customer.firstName
        ? `${customer.firstName} ${customer.lastName}`.trim()
        : 'Guest',
    customerEmail: customer.email || 'N/A',
    customerPhone: customer.phoneNumber,
    items,
    subtotal: refund.subtotal ?? 0,
    tax: refund.tax ?? 0,
    total: refund.total ?? 0,
    reason: refund.reason || 'No reason provided',
    status: normalizeRefundStatus(refund.status),
    refundMethod: normalizeRefundMethod(refund.refundMethod),
    refundType: normalizeRefundType(refund.refundType),
    notes: refund.notes,
    createdAt: refund.createdAt || sale.saleDate || sale.createdAt,
    processedAt: refund.processedAt,
    processedBy: refund.processedBy,
    currency: resolveSaleCurrency(sale),
  };
}

const DEFAULT_REFUND_STATS: RefundStats = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  completed: 0,
  cancelled: 0,
  totalAmount: 0,
  averageRefund: 0,
  byMethod: {
    CASH: 0,
    CREDIT: 0,
    STORE_CREDIT: 0,
    ORIGINAL_PAYMENT: 0,
    BANK_TRANSFER: 0,
  },
};

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    PENDING:
      'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
    APPROVED:
      'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400',
    REJECTED:
      'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400',
    COMPLETED:
      'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
    CANCELLED:
      'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400',
  };
  return (
    colors[status] ||
    'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400'
  );
};

const getStatusIcon = (status: string): React.ElementType => {
  const icons: Record<string, React.ElementType> = {
    PENDING: Clock,
    APPROVED: CheckCircle,
    REJECTED: XCircle,
    COMPLETED: CheckCircle,
    CANCELLED: XCircle,
  };
  return icons[status] || AlertCircle;
};

const StatusIcon = ({ status }: { status: string }) => {
  const Icon = getStatusIcon(status);
  return <Icon className="w-4 h-4 inline mr-1" aria-hidden="true" />;
};

const getRefundMethodColor = (method: string): string => {
  const colors: Record<string, string> = {
    CASH: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
    CREDIT:
      'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400',
    STORE_CREDIT:
      'bg-brand-accent-100 dark:bg-brand-accent-900/30 text-brand-accent-700 dark:text-brand-accent-400',
    ORIGINAL_PAYMENT:
      'bg-secondary-100 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-400',
    BANK_TRANSFER:
      'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
  };
  return (
    colors[method] ||
    'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400'
  );
};

const humanizeMethod = (method: string): string =>
  method.replace(/_/g, ' ').toUpperCase();

const titleCase = (value: string): string => {
  if (!value) return value;
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const REFUND_METHOD_KEYS: readonly RefundMethod[] = [
  'CASH',
  'CREDIT',
  'STORE_CREDIT',
  'ORIGINAL_PAYMENT',
  'BANK_TRANSFER',
] as const;

function computeRefundStats(refunds: Refund[]): RefundStats {
  const totalAmount = refunds.reduce((sum, r) => sum + (r.total || 0), 0);

  const byMethod: RefundStats['byMethod'] = {
    CASH: 0,
    CREDIT: 0,
    STORE_CREDIT: 0,
    ORIGINAL_PAYMENT: 0,
    BANK_TRANSFER: 0,
  };
  refunds.forEach((r) => {
    if (REFUND_METHOD_KEYS.includes(r.refundMethod)) {
      byMethod[r.refundMethod] += 1;
    }
  });

  return {
    total: refunds.length,
    pending: refunds.filter((r) => r.status === 'PENDING').length,
    approved: refunds.filter((r) => r.status === 'APPROVED').length,
    rejected: refunds.filter((r) => r.status === 'REJECTED').length,
    completed: refunds.filter((r) => r.status === 'COMPLETED').length,
    cancelled: refunds.filter((r) => r.status === 'CANCELLED').length,
    totalAmount,
    averageRefund: refunds.length > 0 ? totalAmount / refunds.length : 0,
    byMethod,
  };
}

/**
 * Generate printable refund HTML.
 *
 * ⚠ `currency` is REQUIRED. Every amount on the receipt is formatted
 *   with the ledger currency. A hardcoded `$` would mislabel a UGX
 *   or KES deployment.
 */
function generateRefundHTML(refund: Refund, currency: string): string {
  const fmt = (amount: number): string => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Refund #${refund.refundNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            padding: 20px;
            max-width: 320px;
            margin: 0 auto;
            background: white;
            color: black;
            font-size: 12px;
            line-height: 1.4;
          }
          .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 10px; margin-bottom: 10px; }
          .header h3 { font-size: 16px; margin-bottom: 4px; }
          .divider { border-top: 1px dashed #ccc; margin: 8px 0; }
          .items { margin: 10px 0; }
          .item { display: flex; justify-content: space-between; padding: 2px 0; }
          .item .name { flex: 1; }
          .item .qty { margin: 0 8px; color: #666; }
          .item .price { font-weight: bold; white-space: nowrap; }
          .totals { border-top: 2px dashed #333; padding-top: 10px; margin-top: 10px; }
          .totals .row { display: flex; justify-content: space-between; padding: 2px 0; }
          .totals .grand { font-size: 16px; font-weight: bold; border-top: 1px solid #333; padding-top: 8px; margin-top: 4px; }
          .footer { text-align: center; border-top: 2px dashed #333; padding-top: 10px; margin-top: 10px; font-size: 11px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h3>REFUND</h3>
          <div><strong>#${refund.refundNumber}</strong></div>
          <div>${formatDateTime(refund.createdAt)}</div>
          <div>Status: ${titleCase(refund.status)}</div>
        </div>

        <div>
          <div class="row"><span>Customer</span><span>${refund.customerName || 'Guest'}</span></div>
          <div class="row"><span>Receipt</span><span>#${refund.receiptNumber}</span></div>
          <div class="row"><span>Method</span><span>${humanizeMethod(refund.refundMethod)}</span></div>
          <div class="row"><span>Type</span><span>${titleCase(refund.refundType)}</span></div>
        </div>

        <div class="divider"></div>

        <div class="items">
          ${refund.items
            .map(
              (item) => `
            <div class="item">
              <span class="name">${item.productName}</span>
              <span class="qty">x${item.quantity}</span>
              <span class="price">${fmt(item.total)}</span>
            </div>
          `,
            )
            .join('')}
        </div>

        <div class="totals">
          <div class="row"><span>Subtotal</span><span>${fmt(refund.subtotal)}</span></div>
          <div class="row"><span>Tax</span><span>${fmt(refund.tax)}</span></div>
          <div class="row grand"><span>Total</span><span>${fmt(refund.total)}</span></div>
        </div>

        ${
          refund.reason
            ? `<div class="divider"></div><div><strong>Reason:</strong> ${refund.reason}</div>`
            : ''
        }

        <div class="footer">
          <div>This is a refund confirmation.</div>
        </div>
      </body>
    </html>
  `;
}

function StatCard({
  title,
  value,
  color,
  subtext,
}: {
  title: string;
  value: number | string;
  color: string;
  subtext?: string;
}) {
  const colors: Record<string, string> = {
    brand: 'text-brand-600 dark:text-brand-400',
    warning: 'text-warning-600 dark:text-warning-400',
    success: 'text-success-600 dark:text-success-400',
    danger: 'text-danger-600 dark:text-danger-400',
    gray: 'text-gray-600 dark:text-gray-400',
  };

  return (
    <div className="card-brand p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <p
        className={`text-xl font-bold ${
          colors[color] || 'text-gray-900 dark:text-white'
        } tabular-nums`}
      >
        {value}
      </p>
      {subtext && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {subtext}
        </p>
      )}
    </div>
  );
}

function MethodBadge({
  method,
  count,
  label,
}: {
  method: string;
  count: number;
  label?: string;
}) {
  const displayLabel = label || humanizeMethod(method);
  const color = getRefundMethodColor(method);

  return (
    <div className={`px-2 py-1 rounded-lg text-center ${color}`}>
      <p className="text-xs font-medium">{displayLabel}</p>
      <p className="text-sm font-bold tabular-nums">{count}</p>
    </div>
  );
}

export default function RefundsPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { user: authUser } = useAuth();
  const router = useRouter();

  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState<RefundStats>(DEFAULT_REFUND_STATS);
  /**
   * Ledger currency for every amount on this page. Resolved from
   * the response envelope, or from the first refund that carries
   * one. `undefined` until the first fetch resolves — every
   * `formatCurrency` call is guarded against it.
   */
  const [currency, setCurrency] = useState<string | undefined>(undefined);

  const [filters, setFilters] = useState<RefundFilters>({
    search: '',
    status: 'all',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    page: 1,
    limit: 10,
  });

  const [totalPages, setTotalPages] = useState(1);
  const [totalRefunds, setTotalRefunds] = useState(0);
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  const userRole = ((authUser?.role as string) || 'EMPLOYEE').toUpperCase();
  const canViewRefunds = [
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
    'EMPLOYEE',
    'CASHIER',
  ].includes(userRole);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/login?redirect=/admin/sales/refunds');
      return;
    }
    if (isLoaded && isSignedIn && !canViewRefunds) {
      router.push('/admin/sales');
      toast.error('You do not have permission to view refunds');
    }
  }, [isLoaded, isSignedIn, router, canViewRefunds]);

  const fetchRefunds = useCallback(
    async (silent = false) => {
      if (!authUser) return;

      try {
        if (!silent) setLoading(true);
        else setIsRefreshing(true);

        const params: any = {
          page: filters.page,
          limit: filters.limit,
          search: filters.search || undefined,
          startDate: filters.startDate
            ? new Date(filters.startDate).toISOString()
            : undefined,
          endDate: filters.endDate
            ? new Date(`${filters.endDate}T23:59:59.999Z`).toISOString()
            : undefined,
        };

        const response = await fetchRefundsRemote(params);
        const rawSales: any[] = Array.isArray(response.data)
          ? response.data
          : [];

        const flattened: Refund[] = [];
        rawSales.forEach((sale: any) => {
          const saleRefunds: any[] = Array.isArray(sale.refunds)
            ? sale.refunds
            : [];
          saleRefunds.forEach((refund: any) => {
            flattened.push(saleRefundToRefund(sale, refund));
          });
        });

        const filtered =
          filters.status === 'all'
            ? flattened
            : flattened.filter((r) => r.status === filters.status);

        // Resolve the page currency: envelope first, then the first
        // refund that carries one.
        const resolvedCurrency =
          response.currency ||
          filtered.find((r) => typeof r.currency === 'string' && r.currency)
            ?.currency ||
          undefined;
        setCurrency(resolvedCurrency);

        setRefunds(filtered);
        setTotalRefunds(
          typeof response.total === 'number'
            ? response.total
            : filtered.length,
        );
        setTotalPages(
          typeof response.totalPages === 'number'
            ? response.totalPages
            : 1,
        );
        setStats(computeRefundStats(filtered));
      } catch (error: any) {
        console.error('Error fetching refunds:', error);
        toast.error(
          error?.response?.data?.message ||
            error?.message ||
            'Failed to load refunds',
        );
        setRefunds([]);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [authUser, filters],
  );

  useEffect(() => {
    void fetchRefunds();
  }, [fetchRefunds]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }));
  };

  const handleStatusChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }));
  };

  const handleDateChange = (
    field: 'startDate' | 'endDate',
    value: string,
  ) => {
    setFilters((prev) => ({ ...prev, [field]: value, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  /**
   * Format an amount using the page's resolved ledger currency.
   * Falls back to a plain number when the currency is not yet known
   * (first paint before the fetch resolves).
   */
  const fmt = useCallback(
    (amount: number): string => {
      if (!currency) return new Intl.NumberFormat('en-US').format(amount);
      return formatCurrency(amount, currency);
    },
    [currency],
  );

  const handlePrintRefund = (refund: Refund) => {
    if (!currency) {
      toast.error('Currency not yet resolved — try again in a moment');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print refunds');
      return;
    }
    printWindow.document.write(generateRefundHTML(refund, currency));
    printWindow.document.close();
    printWindow.print();
    toast.success('Refund sent to printer');
  };

  const handleExport = async () => {
    try {
      setExporting(true);

      const result = await exportSalesRemote({
        startDate: filters.startDate,
        endDate: filters.endDate,
        format: 'json',
      });

      const rowsData: any[] = Array.isArray(result.data) ? result.data : [];
      if (rowsData.length === 0) {
        toast.error('No refunds to export');
        return;
      }

      const headers = [
        'Refund #',
        'Date',
        'Customer',
        'Receipt',
        'Subtotal',
        'Tax',
        'Total',
        'Currency',
        'Method',
        'Type',
        'Status',
        'Reason',
        'Items',
      ];
      const rows = refunds.map((refund) => [
        refund.refundNumber,
        new Date(refund.createdAt).toISOString().split('T')[0],
        refund.customerName,
        refund.receiptNumber,
        refund.subtotal.toFixed(2),
        refund.tax.toFixed(2),
        refund.total.toFixed(2),
        refund.currency || currency || '',
        refund.refundMethod,
        refund.refundType,
        refund.status,
        `"${(refund.reason || '').replace(/"/g, '""')}"`,
        refund.items.length,
      ]);
      const csv = [
        headers.join(','),
        ...rows.map((row: (string | number)[]) => row.join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `refunds-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Refunds exported successfully');
    } catch (error: any) {
      console.error('Failed to export refunds:', error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to export refunds',
      );
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!authUser || !canViewRefunds) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/admin/sales')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                aria-label="Back to Sales"
              >
                <ArrowLeft
                  className="w-5 h-5 text-gray-500"
                  aria-hidden="true"
                />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Refunds
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Refunds issued against completed sales
                  {totalRefunds > 0 && ` · ${totalRefunds} refunded sales`}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => void fetchRefunds(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus-ring"
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2
                  className="w-4 h-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
              )}
              Refresh
            </button>
            <button
              onClick={() => void handleExport()}
              disabled={exporting || refunds.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50 focus-ring"
            >
              {exporting ? (
                <Loader2
                  className="w-4 h-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Download className="w-4 h-4" aria-hidden="true" />
              )}
              Export
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <StatCard title="Total" value={stats.total} color="brand" />
          <StatCard title="Pending" value={stats.pending} color="warning" />
          <StatCard title="Approved" value={stats.approved} color="brand" />
          <StatCard title="Rejected" value={stats.rejected} color="danger" />
          <StatCard title="Completed" value={stats.completed} color="success" />
          <StatCard title="Cancelled" value={stats.cancelled} color="gray" />
          <StatCard
            title="Total Amount"
            value={fmt(stats.totalAmount)}
            color="brand"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="card-brand p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Average Refund Amount
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              {fmt(stats.averageRefund)}
            </p>
          </div>
          <div className="card-brand p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Refund Methods
            </p>
            <div className="grid grid-cols-5 gap-2">
              <MethodBadge method="CASH" count={stats.byMethod.CASH} />
              <MethodBadge method="CREDIT" count={stats.byMethod.CREDIT} />
              <MethodBadge
                method="STORE_CREDIT"
                count={stats.byMethod.STORE_CREDIT}
                label="Store Credit"
              />
              <MethodBadge
                method="ORIGINAL_PAYMENT"
                count={stats.byMethod.ORIGINAL_PAYMENT}
                label="Original Payment"
              />
              <MethodBadge
                method="BANK_TRANSFER"
                count={stats.byMethod.BANK_TRANSFER}
                label="Bank Transfer"
              />
            </div>
          </div>
        </div>

        <div className="card-brand p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"
                aria-hidden="true"
              />
              <input
                type="text"
                placeholder="Search by receipt, customer..."
                value={filters.search}
                onChange={handleSearch}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <select
              value={filters.status}
              onChange={handleStatusChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                handleDateChange('startDate', e.target.value)
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums"
            />
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleDateChange('endDate', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums"
            />
            <button
              onClick={() => void fetchRefunds()}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors focus-ring"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {refunds.length === 0 ? (
          <div className="card-brand p-12 text-center">
            <div className="text-6xl mb-4">💰</div>
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No Refunds Found
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              {filters.search || filters.status !== 'all'
                ? 'No refunds match your search criteria.'
                : 'No refunds have been processed yet.'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <AnimatePresence>
                {refunds.map((refund, index) => (
                  <motion.div
                    key={refund.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="card-brand p-0 overflow-hidden hover:shadow-card-hover transition-all"
                  >
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-brand-accent-600 dark:text-brand-accent-400 tabular-nums">
                          #{refund.refundNumber}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(refund.createdAt)}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs">
                          {titleCase(refund.refundType)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            refund.status,
                          )} flex items-center gap-1`}
                        >
                          <StatusIcon status={refund.status} />
                          {titleCase(refund.status)}
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                          {fmt(refund.total)}
                        </span>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Users
                                className="w-4 h-4"
                                aria-hidden="true"
                              />
                              {refund.customerName || 'Guest'}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText
                                className="w-4 h-4"
                                aria-hidden="true"
                              />
                              Receipt: #{refund.receiptNumber}
                            </span>
                            <span className="flex items-center gap-1 tabular-nums">
                              <Package
                                className="w-4 h-4"
                                aria-hidden="true"
                              />
                              {refund.items.length} items
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getRefundMethodColor(
                                refund.refundMethod,
                              )} flex items-center gap-1`}
                            >
                              {humanizeMethod(refund.refundMethod)}
                            </span>
                            {refund.reason && (
                              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs">
                                {refund.reason}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => {
                              setSelectedRefund(refund);
                              setShowDetailModal(true);
                            }}
                            className="px-3 py-1.5 text-brand-accent-600 dark:text-brand-accent-400 hover:bg-brand-accent-50 dark:hover:bg-brand-accent-900/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 focus-ring"
                          >
                            <Eye className="w-4 h-4" aria-hidden="true" />
                            Details
                          </button>
                          <button
                            onClick={() => handlePrintRefund(refund)}
                            className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 focus-ring"
                          >
                            <Printer className="w-4 h-4" aria-hidden="true" />
                            Print
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {totalPages > 1 && (
              <div className="flex flex-wrap justify-center items-center gap-2 mt-6">
                <button
                  onClick={() =>
                    handlePageChange(Math.max(1, filters.page - 1))
                  }
                  disabled={filters.page === 1}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-300 focus-ring"
                >
                  <ChevronLeft
                    className="w-4 h-4 inline"
                    aria-hidden="true"
                  />
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from(
                    { length: Math.min(totalPages, 5) },
                    (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (filters.page <= 3) {
                        pageNum = i + 1;
                      } else if (filters.page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = filters.page - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`w-9 h-9 rounded-lg text-sm transition-colors tabular-nums focus-ring ${
                            filters.page === pageNum
                              ? 'bg-brand-accent-500 text-white'
                              : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    },
                  )}
                </div>
                <button
                  onClick={() =>
                    handlePageChange(
                      Math.min(totalPages, filters.page + 1),
                    )
                  }
                  disabled={filters.page === totalPages}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-300 focus-ring"
                >
                  Next
                  <ChevronRight
                    className="w-4 h-4 inline"
                    aria-hidden="true"
                  />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {showDetailModal && selectedRefund && (
          <DetailModal
            refundData={selectedRefund}
            currency={currency}
            onClose={() => setShowDetailModal(false)}
            onPrint={() => handlePrintRefund(selectedRefund)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface DetailModalProps {
  refundData: Refund;
  currency?: string;
  onClose: () => void;
  onPrint: () => void;
}

function DetailModal({ refundData, currency, onClose, onPrint }: DetailModalProps) {
  /**
   * Format an amount using the refund's own currency when present,
   * falling back to the page-level currency, and finally to a
   * plain number if neither is known.
   */
  const fmt = (amount: number): string => {
    const code = refundData.currency || currency;
    if (!code) return new Intl.NumberFormat('en-US').format(amount);
    return formatCurrency(amount, code);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-modal p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700 sidebar-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
              Refund #{refundData.refundNumber}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatDateTime(refundData.createdAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
            aria-label="Close"
          >
            <XCircle className="w-6 h-6 text-gray-500" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                refundData.status,
              )} flex items-center gap-2`}
            >
              <StatusIcon status={refundData.status} />
              {titleCase(refundData.status)}
            </span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              {fmt(refundData.total)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Customer
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {refundData.customerName || 'Guest'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Email
              </p>
              <p className="font-medium text-gray-900 dark:text-white truncate">
                {refundData.customerEmail || 'N/A'}
              </p>
            </div>
            {refundData.customerPhone && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Phone
                </p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {refundData.customerPhone}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Receipt
              </p>
              <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                #{refundData.receiptNumber}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Refund Method
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {humanizeMethod(refundData.refundMethod)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Refund Type
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {titleCase(refundData.refundType)}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Reason
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {refundData.reason || '—'}
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              Items
            </h3>
            <div className="space-y-2">
              {refundData.items.map((item: RefundItem) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {item.productName}
                    </p>
                    <div className="flex flex-wrap gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>SKU: {item.sku}</span>
                      <span className="tabular-nums">× {item.quantity}</span>
                    </div>
                    {item.reason && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Reason: {item.reason}
                      </p>
                    )}
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white tabular-nums flex-shrink-0">
                    {fmt(item.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="space-y-2 max-w-xs ml-auto">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  Subtotal
                </span>
                <span className="text-gray-900 dark:text-white tabular-nums">
                  {fmt(refundData.subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Tax</span>
                <span className="text-gray-900 dark:text-white tabular-nums">
                  {fmt(refundData.tax)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-900 dark:text-white">Total</span>
                <span className="text-brand-accent-600 dark:text-brand-accent-400 tabular-nums">
                  {fmt(refundData.total)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onPrint}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2 focus-ring"
            >
              <Printer className="w-4 h-4" aria-hidden="true" />
              Print
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 focus-ring"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 h-20"
          ></div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 h-20"></div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 h-20"></div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 h-16 mb-6"></div>
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 h-32"
          ></div>
        ))}
      </div>
    </div>
  );
}
