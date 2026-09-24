// packages/web/app/(dashboard)/admin/sales/refunds/page.tsx

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  CreditCard,
  Banknote,
  Gift,
  Wallet,
  RotateCcw,
} from 'lucide-react';
import { saleService } from '../../../../../services/saleService';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from '../../../../../utils/formatters';
import { useAuth } from '../../../../../hooks/useAuth';
import { toast } from '../../../../../utils/toast-manager';

// ============================================
// INTERFACES
// ============================================
//
// Refund statuses and methods are UPPERCASE to match the Prisma
// enums. The backend only ever writes `status: 'PENDING'` today —
// the other members of the enum exist but are unreachable from the
// current API surface.

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

// ============================================
// HELPERS — backend → Refund shape
// ============================================

function normalizeRefundStatus(raw: string | null | undefined): RefundStatus {
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

function normalizeRefundMethod(raw: string | null | undefined): RefundMethod {
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

function normalizeRefundType(raw: string | null | undefined): 'FULL' | 'PARTIAL' {
  const value = (raw || 'full').toUpperCase();
  return value === 'PARTIAL' ? 'PARTIAL' : 'FULL';
}

/**
 * Map a backend `Sale` (which carries `refunds[]`) plus one of its
 * refund rows into the frontend `Refund` shape this page renders.
 *
 * The backend's refund list endpoint returns sales, not refunds, so
 * the caller iterates `sale.refunds` and calls this once per refund.
 */
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
    })
  );

  return {
    id: refund.id,
    refundNumber: refund.refundNumber || `REF-${refund.id?.slice(-6) || 'N/A'}`,
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
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

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
  return <Icon className="w-4 h-4 inline mr-1" />;
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

/** `STORE_CREDIT` → `STORE CREDIT`. */
const humanizeMethod = (method: string): string =>
  method.replace(/_/g, ' ').toUpperCase();

/** `PENDING` → `Pending`. */
const titleCase = (value: string): string => {
  if (!value) return value;
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function RefundsPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { user: authUser } = useAuth();
  const router = useRouter();

  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState<RefundStats>(DEFAULT_REFUND_STATS);

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

  // Permissions
  const userRole = ((authUser?.role as string) || 'EMPLOYEE').toUpperCase();
  const canManageRefunds = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(
    userRole
  );
  const canViewRefunds = [
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
    'EMPLOYEE',
    'CASHIER',
  ].includes(userRole);

  // Redirect if not authorized
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

  // ============================================
  // FETCH
  // ============================================
  //
  // The backend has no `/api/refunds` router. The refund list is
  // derived from sales whose status is `REFUNDED`:
  //
  //     GET /api/sales/refunds → saleController.getRefunds
  //
  // which internally calls `getAllSales({ status: 'REFUNDED' })`.
  // Each returned sale carries its own `refunds[]` array, which we
  // flatten into one row per refund.

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
          sortBy: 'saleDate',
          sortOrder: 'desc',
        };

        // Any status other than `all` is applied to the derived
        // refund rows client-side after the sale list comes back.
        const salesPage = await saleService.getAllSales({
          ...params,
          status: 'REFUNDED',
        });

        const rawSales: any[] = (salesPage as any).data || [];

        const flattened: Refund[] = [];
        rawSales.forEach((sale: any) => {
          const saleRefunds: any[] = Array.isArray(sale.refunds)
            ? sale.refunds
            : [];
          if (saleRefunds.length > 0) {
            saleRefunds.forEach((refund: any) => {
              flattened.push(saleRefundToRefund(sale, refund));
            });
          }
        });

        // Apply the optional refund-status filter client-side.
        const filtered =
          filters.status === 'all'
            ? flattened
            : flattened.filter((r) => r.status === filters.status);

        setRefunds(filtered);
        setTotalRefunds((salesPage as any).total || filtered.length);
        setTotalPages((salesPage as any).totalPages || 1);
        setStats(computeRefundStats(filtered));
      } catch (error: any) {
        console.error('Error fetching refunds:', error);
        toast.error(error?.message || 'Failed to load refunds');
        setRefunds([]);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [authUser, filters]
  );

  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

  // ============================================
  // FILTER HANDLERS
  // ============================================

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }));
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }));
  };

  const handleDateChange = (
    field: 'startDate' | 'endDate',
    value: string
  ) => {
    setFilters((prev) => ({ ...prev, [field]: value, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  // ============================================
  // ACTION HANDLERS
  // ============================================

  const handlePrintRefund = (refund: Refund) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print refunds');
      return;
    }
    printWindow.document.write(generateRefundHTML(refund));
    printWindow.document.close();
    printWindow.print();
    toast.success('Refund sent to printer');
  };

  /**
   * Export refunds.
   *
   * The backend's sales export endpoint accepts the same date range
   * and produces a CSV of sales. We reuse it and filter the output
   * to just the receipts in this list.
   */
  const handleExport = async () => {
    try {
      setExporting(true);

      const result = await saleService.exportSales({
        startDate: filters.startDate,
        endDate: filters.endDate,
        format: 'csv',
      });

      const rowsData: any[] = (result as any)?.data || [];
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
      toast.error(error?.message || 'Failed to export refunds');
    } finally {
      setExporting(false);
    }
  };

  // ============================================
  // LOADING / PERMISSION STATES
  // ============================================

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!authUser || !canViewRefunds) {
    return null;
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/admin/sales')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                aria-label="Back to Sales"
              >
                <ArrowLeft className="w-5 h-5 text-gray-500" />
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
              onClick={() => fetchRefunds(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus-ring"
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || refunds.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50 focus-ring"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <StatCard title="Total" value={stats.total} color="brand" />
          <StatCard title="Pending" value={stats.pending} color="warning" />
          <StatCard title="Approved" value={stats.approved} color="brand" />
          <StatCard title="Rejected" value={stats.rejected} color="danger" />
          <StatCard title="Completed" value={stats.completed} color="success" />
          <StatCard title="Cancelled" value={stats.cancelled} color="gray" />
          <StatCard
            title="Total Amount"
            value={formatCurrency(stats.totalAmount)}
            color="brand"
          />
        </div>

        {/* Additional Stats — Average & Methods */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="card-brand p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Average Refund Amount
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              {formatCurrency(stats.averageRefund)}
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

        {/* Filters */}
        <div className="card-brand p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
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
              onChange={(e) => handleDateChange('startDate', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleDateChange('endDate', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              onClick={() => fetchRefunds()}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors focus-ring"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {/* Refunds List */}
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
                    {/* Refund Header */}
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
                            refund.status
                          )} flex items-center gap-1`}
                        >
                          <StatusIcon status={refund.status} />
                          {titleCase(refund.status)}
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                          {formatCurrency(refund.total)}
                        </span>
                      </div>
                    </div>

                    {/* Refund Body */}
                    <div className="p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {refund.customerName || 'Guest'}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="w-4 h-4" />
                              Receipt: #{refund.receiptNumber}
                            </span>
                            <span className="flex items-center gap-1 tabular-nums">
                              <Package className="w-4 h-4" />
                              {refund.items.length} items
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getRefundMethodColor(
                                refund.refundMethod
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
                            <Eye className="w-4 h-4" />
                            Details
                          </button>
                          <button
                            onClick={() => handlePrintRefund(refund)}
                            className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 focus-ring"
                          >
                            <Printer className="w-4 h-4" />
                            Print
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-wrap justify-center items-center gap-2 mt-6">
                <button
                  onClick={() =>
                    handlePageChange(Math.max(1, filters.page - 1))
                  }
                  disabled={filters.page === 1}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-300 focus-ring"
                >
                  <ChevronLeft className="w-4 h-4 inline" />
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
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
                  })}
                </div>
                <button
                  onClick={() =>
                    handlePageChange(Math.min(totalPages, filters.page + 1))
                  }
                  disabled={filters.page === totalPages}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-300 focus-ring"
                >
                  Next
                  <ChevronRight className="w-4 h-4 inline" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedRefund && (
          <DetailModal
            refundData={selectedRefund}
            onClose={() => setShowDetailModal(false)}
            onPrint={() => handlePrintRefund(selectedRefund)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

/**
 * Compute refund stats from the current page.
 *
 * The backend has no `/api/refunds/stats` endpoint, so these are
 * page-scoped. The "Total" card reflects the backend's `response.total`
 * (all refunded sales in the date range) but the per-status counts
 * are for the current page only, which is why the subtext on each
 * card reads "current page".
 */
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
    if (byMethod[r.refundMethod] !== undefined) {
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

function generateRefundHTML(refund: Refund): string {
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
              <span class="price">$${item.total.toFixed(2)}</span>
            </div>
          `
            )
            .join('')}
        </div>

        <div class="totals">
          <div class="row"><span>Subtotal</span><span>$${refund.subtotal.toFixed(2)}</span></div>
          <div class="row"><span>Tax</span><span>$${refund.tax.toFixed(2)}</span></div>
          <div class="row grand"><span>Total</span><span>$${refund.total.toFixed(2)}</span></div>
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

// ============================================
// HELPER COMPONENTS
// ============================================

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

// ============================================
// DETAIL MODAL
// ============================================

interface DetailModalProps {
  refundData: Refund;
  onClose: () => void;
  onPrint: () => void;
}

function DetailModal({ refundData, onClose, onPrint }: DetailModalProps) {
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
            <XCircle className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status and Total */}
          <div className="flex items-center justify-between">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                refundData.status
              )} flex items-center gap-2`}
            >
              <StatusIcon status={refundData.status} />
              {titleCase(refundData.status)}
            </span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              {formatCurrency(refundData.total)}
            </span>
          </div>

          {/* Customer Info */}
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
              <p className="font-medium text-gray-900 dark:text-white">
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

          {/* Items */}
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
                    {formatCurrency(item.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="space-y-2 max-w-xs ml-auto">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  Subtotal
                </span>
                <span className="text-gray-900 dark:text-white tabular-nums">
                  {formatCurrency(refundData.subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Tax</span>
                <span className="text-gray-900 dark:text-white tabular-nums">
                  {formatCurrency(refundData.tax)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-900 dark:text-white">Total</span>
                <span className="text-brand-accent-600 dark:text-brand-accent-400 tabular-nums">
                  {formatCurrency(refundData.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onPrint}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2 focus-ring"
            >
              <Printer className="w-4 h-4" />
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

// ============================================
// LOADING SKELETON
// ============================================

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
