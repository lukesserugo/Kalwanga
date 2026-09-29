// packages/web/components/sales/SaleList.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import {
  Search,
  Download,
  Eye,
  RefreshCw,
  Printer,
  TrendingUp,
  XCircle,
  Tag,
  Star,
  Sparkles,
} from 'lucide-react';

import {
  saleService,
  DISCOUNT_TYPE_LABELS,
} from '../../services/saleService';
import type { DiscountType } from '../../services/saleService';
import type { Sale } from '../../types/sale';
import { Table } from '../common/Table';
import { Pagination } from '../common/Pagination';
import { Modal } from '../common/Modal';
import { toast } from '../../utils/toast-manager';

// ============================================================
// TYPES
// ============================================================

interface SalesStats {
  totalRevenue: number;
  totalSales: number;
  averageTicket: number;
  todayRevenue: number;
  todaySales: number;
}

interface SaleFilters {
  search: string;
  status: string;
  startDate: string;
  endDate: string;
  customerId: string;
  userId: string;
}

type DiscountFilter = 'all' | 'discounted';

const SEARCH_DEBOUNCE_MS = 300;

// ============================================================
// CONSTANTS — static class maps
// ============================================================

const STATUS_BADGE_STYLES: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  REFUNDED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  ON_HOLD: 'bg-orange-100 text-orange-700',
  VOID: 'bg-gray-100 text-gray-700',
  RETURNED: 'bg-purple-100 text-purple-700',
  DELETED: 'bg-gray-100 text-gray-500',
};

const DEFAULT_STATUS_BADGE = 'bg-blue-100 text-blue-700';

// ============================================================
// HELPERS
// ============================================================

function extractErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  const anyErr = error as any;
  const data = anyErr?.response?.data;

  if (data) {
    if (typeof data.error === 'string') return data.error;
    if (data.error?.message) return String(data.error.message);
    if (data.message) return String(data.message);
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors
        .map((e: any) => `${e.field ?? 'field'}: ${e.message ?? 'invalid'}`)
        .join(', ');
    }
  }

  if (anyErr?.message) return String(anyErr.message);
  return fallback;
}

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toIsoString(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function parseMoney(input: string): number {
  if (!input) return 0;
  const n = parseFloat(input);
  return Number.isFinite(n) ? n : 0;
}

function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

/**
 * Compact breakdown hint for the receipt cell of a table row.
 *
 * Renders nothing when the sale carries no promotion or loyalty
 * attribution. Uses `saleService.describeBreakdown` so the wording
 * matches the receipt and detail page.
 */
const BreakdownHint: React.FC<{ sale: Sale }> = ({ sale }) => {
  if (!saleService.hasBreakdown(sale)) return null;

  const breakdown = saleService.extractBreakdown(sale);
  const hasPromotion = (breakdown.promotionDiscount ?? 0) > 0;
  const hasLoyalty = (breakdown.loyaltyPointsUsed ?? 0) > 0;
  const label = saleService.describeBreakdown(sale);

  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5"
      title={label}
      tabIndex={0}
      aria-label={`Discount: ${label}`}
    >
      {hasPromotion && (
        <Tag className="w-3 h-3 text-blue-500 shrink-0" aria-hidden="true" />
      )}
      {hasLoyalty && (
        <Star
          className="w-3 h-3 text-yellow-500 fill-current shrink-0"
          aria-hidden="true"
        />
      )}
      <span className="truncate max-w-[180px]">{label}</span>
    </span>
  );
};

// ============================================================
// COMPONENT
// ============================================================

export function SaleList() {
  const mountedRef = useRef(true);
  const fetchRequestIdRef = useRef(0);

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [filters, setFilters] = useState<SaleFilters>({
    search: '',
    status: '',
    startDate: '',
    endDate: '',
    customerId: '',
    userId: '',
  });

  /**
   * Debounced version of `filters.search`. Only this value drives
   * `loadSales`, so typing doesn't fire a fetch per keystroke.
   */
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 20,
  });

  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmountInput, setRefundAmountInput] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);

  const [stats, setStats] = useState<SalesStats>({
    totalRevenue: 0,
    totalSales: 0,
    averageTicket: 0,
    todayRevenue: 0,
    todaySales: 0,
  });
  const [showStats, setShowStats] = useState(false);
  const [discountFilter, setDiscountFilter] = useState<DiscountFilter>('all');

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Debounce the search input ────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // Reset to page 1 whenever the effective filter set changes.
  useEffect(() => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [
    debouncedSearch,
    filters.status,
    filters.startDate,
    filters.endDate,
    filters.customerId,
    filters.userId,
  ]);

  // ============================================================
  // DATA LOADING
  // ============================================================

  const loadSales = useCallback(async (): Promise<boolean> => {
    const requestId = ++fetchRequestIdRef.current;
    setLoading(true);
    setLoadError(null);

    try {
      const result = await saleService.getAllSales({
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch || undefined,
        status: filters.status || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        customerId: filters.customerId || undefined,
        userId: filters.userId || undefined,
      });

      if (requestId !== fetchRequestIdRef.current) return false;
      if (!mountedRef.current) return false;

      setSales(result.data ?? []);
      setPagination((prev) => ({
        ...prev,
        total: result.total ?? 0,
        totalPages: result.totalPages ?? 1,
      }));
      return true;
    } catch (error) {
      if (requestId !== fetchRequestIdRef.current) return false;
      if (!mountedRef.current) return false;

      const message = extractErrorMessage(error, 'Failed to load sales');
      console.error('[SaleList] load failed:', message);
      setLoadError(message);
      toast.error(message);
      setSales([]);
      return false;
    } finally {
      if (requestId === fetchRequestIdRef.current && mountedRef.current) {
        setLoading(false);
      }
    }
  }, [
    pagination.page,
    pagination.limit,
    debouncedSearch,
    filters.status,
    filters.startDate,
    filters.endDate,
    filters.customerId,
    filters.userId,
  ]);

  const loadStats = useCallback(async () => {
    try {
      const data = await saleService.getSalesStats();
      if (!mountedRef.current) return;
      setStats({
        totalRevenue: data.totalRevenue ?? 0,
        totalSales: data.totalSales ?? 0,
        averageTicket: data.averageTicket ?? 0,
        todayRevenue: data.todayRevenue ?? 0,
        todaySales: data.todaySales ?? 0,
      });
    } catch (error) {
      console.error('[SaleList] stats load failed:', error);
    }
  }, []);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleRefresh = useCallback(async () => {
    const ok = await loadSales();
    void loadStats();
    if (ok) toast.success('Sales refreshed');
    else toast.error('Failed to refresh sales');
  }, [loadSales, loadStats]);

  /**
   * Refundable amount for the currently-selected sale. Total minus
   * any completed refunds and settled returns, matching the backend's
   * computation.
   */
  const refundableAmount = useMemo(() => {
    if (!selectedSale) return 0;
    const refundedTotal = (selectedSale.refunds ?? [])
      .filter((r) => r.status === 'COMPLETED' || r.status === 'APPROVED')
      .reduce((sum, r) => sum + (r.total ?? 0), 0);
    const returnedTotal = (selectedSale.returns ?? [])
      .filter((r) => r.status === 'APPROVED' || r.status === 'PROCESSED')
      .reduce((sum, r) => sum + (r.total ?? 0), 0);
    return round2(
      Math.max(0, selectedSale.total - refundedTotal - returnedTotal),
    );
  }, [selectedSale]);

  const openRefundModal = useCallback((sale: Sale) => {
    setSelectedSale(sale);
    setRefundReason('');
    // Default to full refund — the operator can reduce it.
    setRefundAmountInput(
      round2(
        Math.max(
          0,
          sale.total -
            (sale.refunds ?? [])
              .filter(
                (r) => r.status === 'COMPLETED' || r.status === 'APPROVED',
              )
              .reduce((sum, r) => sum + (r.total ?? 0), 0) -
            (sale.returns ?? [])
              .filter(
                (r) => r.status === 'APPROVED' || r.status === 'PROCESSED',
              )
              .reduce((sum, r) => sum + (r.total ?? 0), 0),
        ),
      ).toFixed(2),
    );
    setShowRefundModal(true);
  }, []);

  const closeRefundModal = useCallback(() => {
    if (isRefunding) return;
    setShowRefundModal(false);
    setSelectedSale(null);
    setRefundReason('');
    setRefundAmountInput('');
  }, [isRefunding]);

  const handleRefund = useCallback(async () => {
    if (!selectedSale) return;

    const trimmed = refundReason.trim();
    if (!trimmed) {
      toast.warning('Please enter a refund reason');
      return;
    }

    const amount = round2(parseMoney(refundAmountInput));
    if (amount <= 0) {
      toast.warning('Refund amount must be greater than zero');
      return;
    }
    if (amount > refundableAmount) {
      toast.warning(
        `Refund cannot exceed ${refundableAmount.toFixed(2)}`,
      );
      return;
    }

    setIsRefunding(true);
    try {
      await saleService.refundSale(selectedSale.id, trimmed, amount);
      if (!mountedRef.current) return;

      toast.success(`Refunded ${amount.toFixed(2)}`);
      setShowRefundModal(false);
      setSelectedSale(null);
      setRefundReason('');
      setRefundAmountInput('');

      // Refresh both list and stats after a state change.
      void loadSales();
      void loadStats();
    } catch (error) {
      if (!mountedRef.current) return;
      const message = extractErrorMessage(error, 'Failed to refund sale');
      console.error('[SaleList] refund failed:', message);
      toast.error(message);
    } finally {
      if (mountedRef.current) setIsRefunding(false);
    }
  }, [
    selectedSale,
    refundReason,
    refundAmountInput,
    refundableAmount,
    loadSales,
    loadStats,
  ]);

  const handleExport = useCallback(async () => {
    try {
      const blob = await saleService.exportSales({
        startDate:
          filters.startDate ||
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
        endDate:
          filters.endDate || new Date().toISOString().split('T')[0],
        format: 'csv',
      });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `sales-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      toast.success('Sales exported');
    } catch (error) {
      const message = extractErrorMessage(error, 'Failed to export sales');
      console.error('[SaleList] export failed:', message);
      toast.error(message);
    }
  }, [filters.startDate, filters.endDate]);

  const handlePrintReceipt = useCallback((sale: Sale) => {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) {
      toast.error('Please allow pop-ups to print receipts');
      return;
    }
    try {
      printWindow.opener = null;
    } catch {
      /* ignore */
    }

    const e = escapeHtml;

    const receiptNumber = e(sale.receiptNumber);
    const saleDate = e(new Date(sale.saleDate).toLocaleString());

    const itemRows = (sale.items ?? [])
      .map(
        (item) => `
          <tr>
            <td>${e(item.product?.name ?? 'Product')} x${e(item.quantity)}</td>
            <td style="text-align: right;">$${e(item.total.toFixed(2))}</td>
          </tr>
        `,
      )
      .join('');

    const breakdown = saleService.extractBreakdown(sale);
    const promotionDiscount = breakdown.promotionDiscount ?? 0;
    const promotionCode = breakdown.promotionCode ?? null;
    const loyaltyPointsUsed = breakdown.loyaltyPointsUsed ?? 0;
    const loyaltyDiscount = breakdown.loyaltyDiscount ?? 0;

    const promotionLine =
      promotionDiscount > 0
        ? `<tr>
             <td>Promotion${promotionCode ? ` (${e(promotionCode)})` : ''}</td>
             <td style="text-align: right;">-$${e(promotionDiscount.toFixed(2))}</td>
           </tr>`
        : '';

    const loyaltyLine =
      loyaltyPointsUsed > 0
        ? `<tr>
             <td>${e(loyaltyPointsUsed)} loyalty points</td>
             <td style="text-align: right;">-$${e(loyaltyDiscount.toFixed(2))}</td>
           </tr>`
        : '';

    const rawDiscountLine =
      sale.discount > 0 &&
      promotionDiscount === 0 &&
      loyaltyDiscount === 0
        ? `<tr>
             <td>Discount</td>
             <td style="text-align: right;">-$${e(sale.discount.toFixed(2))}</td>
           </tr>`
        : '';

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head><meta charset="utf-8" /><title>Receipt #${receiptNumber}</title></head>
        <body style="font-family: 'Courier New', monospace; padding: 20px; max-width: 320px;">
          <h2>Receipt #${receiptNumber}</h2>
          <p>Date: ${saleDate}</p>
          <table style="width: 100%;">${itemRows}</table>
          <hr />
          <table style="width: 100%; font-size: 13px;">
            <tr>
              <td>Subtotal</td>
              <td style="text-align: right;">$${e(sale.subtotal.toFixed(2))}</td>
            </tr>
            <tr>
              <td>Tax</td>
              <td style="text-align: right;">$${e(sale.tax.toFixed(2))}</td>
            </tr>
            ${promotionLine}
            ${loyaltyLine}
            ${rawDiscountLine}
            <tr style="font-weight: bold; font-size: 16px;">
              <td>Total</td>
              <td style="text-align: right;">$${e(sale.total.toFixed(2))}</td>
            </tr>
          </table>
          <script>
            window.addEventListener('load', function () {
              setTimeout(function () { window.print(); }, 50);
            });
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, []);

  // ============================================================
  // DERIVED
  // ============================================================

  /**
   * Applies the client-side "Discounted" filter without touching the
   * backend.
   */
  const visibleSales = useMemo(() => {
    if (discountFilter === 'all') return sales;
    return sales.filter((s) => saleService.hasBreakdown(s));
  }, [sales, discountFilter]);

  /**
   * Count of discounted sales on the current page. The chip shows
   * how many rows will remain after the filter is applied.
   */
  const discountedCount = useMemo(
    () => sales.filter((s) => saleService.hasBreakdown(s)).length,
    [sales],
  );

  // ============================================================
  // COLUMNS
  // ============================================================
  // Memoized so `Table` doesn't receive a fresh array on every
  // render.
  // ============================================================

  const columns = useMemo(
    () => [
      {
        key: 'receipt',
        header: 'Receipt',
        render: (sale: Sale) => (
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              #{sale.receiptNumber}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
              {new Date(sale.saleDate).toLocaleString()}
            </p>
            <BreakdownHint sale={sale} />
          </div>
        ),
      },
      {
        key: 'customer',
        header: 'Customer',
        render: (sale: Sale) => (
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {sale.customer
                ? `${sale.customer.firstName} ${sale.customer.lastName}`.trim() ||
                  'Guest'
                : 'Guest'}
            </p>
            {sale.customer?.email && (
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {sale.customer.email}
              </p>
            )}
          </div>
        ),
      },
      {
        key: 'items',
        header: 'Items',
        render: (sale: Sale) => (
          <span className="tabular-nums text-gray-700 dark:text-gray-300">
            {sale.items?.length ?? 0} item
            {(sale.items?.length ?? 0) === 1 ? '' : 's'}
          </span>
        ),
      },
      {
        key: 'total',
        header: 'Total',
        render: (sale: Sale) => {
          const breakdown = saleService.extractBreakdown(sale);
          const hasBreakdown = saleService.hasBreakdown(sale);
          const hasBoth =
            (breakdown.promotionDiscount ?? 0) > 0 &&
            (breakdown.loyaltyDiscount ?? 0) > 0;
          return (
            <div>
              <p className="font-bold text-gray-900 dark:text-white tabular-nums">
                {sale.total.toFixed(2)}
              </p>
              {sale.discount > 0 && (
                <p className="text-sm text-green-600 dark:text-green-400 tabular-nums">
                  -{sale.discount.toFixed(2)}
                </p>
              )}
              {hasBreakdown && hasBoth && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                  {DISCOUNT_TYPE_LABELS[
                    (breakdown.discountType as DiscountType) ?? 'MANUAL'
                  ] ?? 'Mixed'}
                </p>
              )}
            </div>
          );
        },
      },
      {
        key: 'payment',
        header: 'Payment',
        render: (sale: Sale) => (
          <div>
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-700 dark:text-gray-300">
              {sale.payments?.[0]?.paymentMethod || 'N/A'}
            </span>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
              Paid: {(sale.paidAmount ?? 0).toFixed(2)}
            </p>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (sale: Sale) => (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              STATUS_BADGE_STYLES[sale.status] ?? DEFAULT_STATUS_BADGE
            }`}
          >
            {sale.status}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (sale: Sale) => (
          <div className="flex items-center gap-2">
            <Link
              href={`/sales/${sale.id}`}
              className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors focus-ring"
              aria-label={`View ${sale.receiptNumber}`}
            >
              <Eye
                className="w-4 h-4 text-blue-600 dark:text-blue-400"
                aria-hidden="true"
              />
            </Link>
            <button
              type="button"
              onClick={() => handlePrintReceipt(sale)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
              aria-label={`Print ${sale.receiptNumber}`}
            >
              <Printer
                className="w-4 h-4 text-gray-600 dark:text-gray-400"
                aria-hidden="true"
              />
            </button>
            {sale.status === 'COMPLETED' && (
              <button
                type="button"
                onClick={() => openRefundModal(sale)}
                className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors focus-ring"
                aria-label={`Refund ${sale.receiptNumber}`}
              >
                <XCircle
                  className="w-4 h-4 text-red-600 dark:text-red-400"
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
        ),
      },
    ],
    [handlePrintReceipt, openRefundModal],
  );

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Sales
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View and manage all sales transactions
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowStats((s) => !s)}
            aria-pressed={showStats}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 focus-ring"
          >
            <TrendingUp className="w-4 h-4" aria-hidden="true" />
            Stats
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 focus-ring"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Export
          </button>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 focus-ring"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {loadError && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300"
        >
          <XCircle
            className="w-4 h-4 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <p className="flex-1">{loadError}</p>
        </div>
      )}

      {/* Stats Cards */}
      {showStats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total Revenue
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              ${(stats.totalRevenue ?? 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total Sales
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              {stats.totalSales}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Average Ticket
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              ${(stats.averageTicket ?? 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Today's Revenue
            </p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              ${(stats.todayRevenue ?? 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Today's Sales
            </p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {stats.todaySales}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Search by receipt number…"
                aria-label="Search sales"
                value={filters.search}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, search: e.target.value }))
                }
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>
          <input
            type="date"
            aria-label="Start date"
            value={filters.startDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, startDate: e.target.value }))
            }
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums focus:outline-none"
          />
          <span className="text-gray-500 dark:text-gray-400">to</span>
          <input
            type="date"
            aria-label="End date"
            value={filters.endDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, endDate: e.target.value }))
            }
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums focus:outline-none"
          />
          <select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(e) =>
              setFilters((f) => ({ ...f, status: e.target.value }))
            }
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
          >
            <option value="">All Status</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="REFUNDED">Refunded</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Discount filter chips */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <Sparkles
            className="w-3.5 h-3.5 text-gray-400"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => setDiscountFilter('all')}
            aria-pressed={discountFilter === 'all'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors focus-ring ${
              discountFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setDiscountFilter('discounted')}
            aria-pressed={discountFilter === 'discounted'}
            title="Filters the current page to rows with a promotion or loyalty discount"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors focus-ring ${
              discountFilter === 'discounted'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Tag className="w-3.5 h-3.5" aria-hidden="true" />
            Discounted
            {discountedCount > 0 && (
              <span
                className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center tabular-nums ${
                  discountFilter === 'discounted'
                    ? 'bg-white/25 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                {discountedCount > 99 ? '99+' : discountedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
        <Table columns={columns} data={visibleSales} loading={loading} />
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(page) =>
              setPagination((p) => ({ ...p, page }))
            }
          />
        </div>
      </div>

      {/* Refund Modal */}
      <Modal
        isOpen={showRefundModal}
        onClose={closeRefundModal}
        title="Refund Sale"
      >
        <div className="p-6">
          {selectedSale && (
            <div className="mb-4 space-y-2">
              <p className="font-medium text-gray-900 dark:text-white">
                Receipt: #{selectedSale.receiptNumber}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                Refundable: {refundableAmount.toFixed(2)}
                {refundableAmount < selectedSale.total && (
                  <span className="block text-xs text-gray-400 dark:text-gray-500">
                    (Sale total was {selectedSale.total.toFixed(2)}; partial
                    refunds and returns have been deducted.)
                  </span>
                )}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                Date: {new Date(selectedSale.saleDate).toLocaleString()}
              </p>
              {saleService.hasBreakdown(selectedSale) && (
                <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                  <Sparkles
                    className="w-3.5 h-3.5 text-blue-500 shrink-0"
                    aria-hidden="true"
                  />
                  {saleService.describeBreakdown(selectedSale)}
                </p>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="list-refund-amount"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Refund Amount
              </label>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                  aria-hidden="true"
                >
                  $
                </span>
                <input
                  id="list-refund-amount"
                  type="text"
                  inputMode="decimal"
                  value={refundAmountInput}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === '' || /^\d*(\.\d{0,2})?$/.test(next)) {
                      setRefundAmountInput(next);
                    }
                  }}
                  disabled={isRefunding}
                  className="w-full pl-7 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="list-refund-reason"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Refund Reason
              </label>
              <textarea
                id="list-refund-reason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                rows={3}
                disabled={isRefunding}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none resize-none disabled:opacity-50"
                placeholder="Reason for refund…"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={closeRefundModal}
              disabled={isRefunding}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus-ring disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleRefund()}
              disabled={isRefunding || !refundReason.trim()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 focus-ring"
            >
              {isRefunding ? 'Refunding…' : 'Process Refund'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default SaleList;
