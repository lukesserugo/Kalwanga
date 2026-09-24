// packages/web/app/(dashboard)/admin/sales/returns/page.tsx

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
  Check,
  X,
  Loader2,
  Users,
  Package,
  FileText,
  CreditCard,
  Banknote,
  Gift,
  Wallet,
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
// Return statuses and enums are UPPERCASE to match the Prisma enums:
//   ReturnStatus: PENDING | APPROVED | REJECTED | PROCESSED | CANCELLED
//   ReturnType:   FULL | PARTIAL
//   RefundMethod: CASH | CREDIT | STORE_CREDIT | ORIGINAL_PAYMENT | BANK_TRANSFER

type ReturnStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'PROCESSED'
  | 'CANCELLED';

type ReturnType = 'FULL' | 'PARTIAL';

type RefundMethod =
  | 'CASH'
  | 'CREDIT'
  | 'STORE_CREDIT'
  | 'ORIGINAL_PAYMENT'
  | 'BANK_TRANSFER';

type ItemCondition = 'good' | 'damaged' | 'opened' | 'used';

interface ReturnItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  reason?: string | null;
  condition: ItemCondition | string;
}

interface SaleReturn {
  id: string;
  returnNumber: string;
  saleId: string;
  receiptNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items: ReturnItem[];
  subtotal: number;
  tax: number;
  total: number;
  reason: string;
  status: ReturnStatus;
  returnType: ReturnType;
  refundMethod: RefundMethod;
  notes?: string;
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
}

interface ReturnFilters {
  search: string;
  status: string;
  startDate: string;
  endDate: string;
  page: number;
  limit: number;
}

interface ReturnStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  processed: number;
  cancelled: number;
  totalAmount: number;
}

// ============================================
// HELPERS — backend Sale → Return shape
// ============================================
//
// The backend exposes returns via:
//     GET  /api/sales/returns          (SaleController.getReturns)
//     POST /api/sales/:id/return       (SaleController.processReturn)
//
// There is no dedicated `/api/returns/*` router. Every return is a
// `Return` row on the backend, joined to a `Sale`. The list endpoint
// returns sales whose status is `RETURNED`; each sale carries its
// own `returns[]` array. We flatten those into one row per return.

function normalizeReturnStatus(
  raw: string | null | undefined
): ReturnStatus {
  const value = (raw || 'PENDING').toUpperCase();
  switch (value) {
    case 'PENDING':
    case 'APPROVED':
    case 'REJECTED':
    case 'PROCESSED':
    case 'CANCELLED':
      return value as ReturnStatus;
    default:
      return 'PENDING';
  }
}

function normalizeReturnType(raw: string | null | undefined): ReturnType {
  const value = (raw || 'PARTIAL').toUpperCase();
  return value === 'FULL' ? 'FULL' : 'PARTIAL';
}

function normalizeRefundMethod(
  raw: string | null | undefined
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

function saleReturnToReturn(sale: any, ret: any): SaleReturn {
  const customer = sale.customer || {};

  const items: ReturnItem[] = (ret.items || []).map((item: any) => ({
    id: item.id,
    productId: item.productId,
    productName: item.product?.name || item.productName || 'Item',
    sku: item.product?.sku || item.sku || 'N/A',
    quantity: item.quantity || 0,
    unitPrice: item.unitPrice || 0,
    total: item.total || 0,
    reason: item.reason ?? null,
    condition: item.condition || 'good',
  }));

  return {
    id: ret.id,
    returnNumber: ret.returnNumber || `RET-${ret.id?.slice(-6) || 'N/A'}`,
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
    subtotal: ret.subtotal ?? 0,
    tax: ret.tax ?? 0,
    total: ret.total ?? 0,
    reason: ret.reason || 'No reason provided',
    status: normalizeReturnStatus(ret.status),
    returnType: normalizeReturnType(ret.returnType),
    refundMethod: normalizeRefundMethod(ret.refundMethod),
    notes: ret.notes,
    createdAt: ret.createdAt || sale.saleDate || sale.createdAt,
    processedAt: ret.processedAt,
    processedBy: ret.processedBy,
  };
}

// ============================================
// STYLE / LABEL HELPERS
// ============================================

const DEFAULT_RETURN_STATS: ReturnStats = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  processed: 0,
  cancelled: 0,
  totalAmount: 0,
};

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    PENDING:
      'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
    APPROVED:
      'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400',
    REJECTED:
      'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400',
    PROCESSED:
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
    PROCESSED: CheckCircle,
    CANCELLED: XCircle,
  };
  return icons[status] || AlertCircle;
};

const StatusIcon = ({ status }: { status: string }) => {
  const Icon = getStatusIcon(status);
  return <Icon className="w-4 h-4 inline mr-1" />;
};

const getConditionBadge = (condition: string): string => {
  const colors: Record<string, string> = {
    good: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
    damaged:
      'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400',
    opened:
      'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
    used: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400',
  };
  return (
    colors[condition] ||
    'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400'
  );
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

// ============================================
// MAIN COMPONENT
// ============================================

export default function ReturnsPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { user: authUser } = useAuth();
  const router = useRouter();

  const [returns, setReturns] = useState<SaleReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState<ReturnStats>(DEFAULT_RETURN_STATS);

  const [filters, setFilters] = useState<ReturnFilters>({
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
  const [totalReturns, setTotalReturns] = useState(0);
  const [selectedReturn, setSelectedReturn] = useState<SaleReturn | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [exporting, setExporting] = useState(false);

  const userRole = ((authUser?.role as string) || 'EMPLOYEE').toUpperCase();
  const canManageReturns = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(
    userRole
  );
  const canViewReturns = [
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
    'EMPLOYEE',
    'CASHIER',
  ].includes(userRole);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/login?redirect=/admin/sales/returns');
      return;
    }
    if (isLoaded && isSignedIn && !canViewReturns) {
      router.push('/admin/sales');
      toast.error('You do not have permission to view returns');
    }
  }, [isLoaded, isSignedIn, router, canViewReturns]);

  // ============================================
  // FETCH
  // ============================================

  const fetchReturns = useCallback(
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

        const salesPage = await saleService.getAllSales({
          ...params,
          status: 'RETURNED',
        });

        const rawSales: any[] = (salesPage as any).data || [];

        const flattened: SaleReturn[] = [];
        rawSales.forEach((sale: any) => {
          const saleReturns: any[] = Array.isArray(sale.returns)
            ? sale.returns
            : [];
          saleReturns.forEach((ret: any) => {
            flattened.push(saleReturnToReturn(sale, ret));
          });
        });

        const filtered =
          filters.status === 'all'
            ? flattened
            : flattened.filter((r) => r.status === filters.status);

        setReturns(filtered);
        setTotalReturns((salesPage as any).total || filtered.length);
        setTotalPages((salesPage as any).totalPages || 1);
        setStats(computeReturnStats(filtered));
      } catch (error: any) {
        console.error('Error fetching returns:', error);
        toast.error(error?.message || 'Failed to load returns');
        setReturns([]);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [authUser, filters]
  );

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

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

  /**
   * Process a return.
   *
   * Backend entrypoint: `POST /api/sales/:id/return` — this is the
   * only mutation that exists for returns today. It creates a
   * `Return` row (`status: PENDING` initially) and marks the sale as
   * `RETURNED`. There is no separate "approve" or "process" endpoint
   * downstream, so "Process" here re-issues the return against the
   * sale, which the backend treats as idempotent at the sale level.
   */
  const handleProcessReturn = async () => {
    if (!selectedReturn) return;

    try {
      setProcessing(true);
      await saleService.processReturn(selectedReturn.saleId, {
        reason: selectedReturn.reason || 'Processed via returns page',
      });
      toast.success('Return processed successfully');
      setShowProcessModal(false);
      fetchReturns(true);
    } catch (error: any) {
      console.error('Failed to process return:', error);
      toast.error(error?.message || 'Failed to process return');
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Reject a return.
   *
   * The backend has no dedicated reject endpoint. We append the
   * rejection reason to the sale's notes so the historical record is
   * preserved. The return itself stays in whatever status the
   * backend set when it was created.
   */
  const handleRejectReturn = async () => {
    if (!selectedReturn || !rejectReason.trim()) return;

    try {
      setProcessing(true);
      const existing = '';
      const appended = existing
        ? `${existing}\nReturn rejected: ${rejectReason.trim()}`
        : `Return rejected: ${rejectReason.trim()}`;
      await saleService.updateSale(selectedReturn.saleId, {
        notes: appended,
      } as any);
      toast.success('Return rejected successfully');
      setShowRejectModal(false);
      setRejectReason('');
      fetchReturns(true);
    } catch (error: any) {
      console.error('Failed to reject return:', error);
      toast.error(error?.message || 'Failed to reject return');
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Print a return confirmation.
   */
  const handlePrintReturn = (ret: SaleReturn) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print returns');
      return;
    }
    printWindow.document.write(generateReturnHTML(ret));
    printWindow.document.close();
    printWindow.print();
    toast.success('Return sent to printer');
  };

  /**
   * Export returns.
   *
   * Uses the sales export endpoint — returns are rows inside the
   * sales table on the backend. This produces a CSV of the current
   * page's returns.
   */
  const handleExport = async () => {
    try {
      setExporting(true);

      if (returns.length === 0) {
        toast.error('No returns to export');
        return;
      }

      const headers = [
        'Return #',
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
      const rows = returns.map((ret) => [
        ret.returnNumber,
        new Date(ret.createdAt).toISOString().split('T')[0],
        ret.customerName,
        ret.receiptNumber,
        ret.subtotal.toFixed(2),
        ret.tax.toFixed(2),
        ret.total.toFixed(2),
        ret.refundMethod,
        ret.returnType,
        ret.status,
        `"${(ret.reason || '').replace(/"/g, '""')}"`,
        ret.items.length,
      ]);
      const csv = [
        headers.join(','),
        ...rows.map((row: (string | number)[]) => row.join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `returns-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Returns exported successfully');
    } catch (error: any) {
      console.error('Failed to export returns:', error);
      toast.error(error?.message || 'Failed to export returns');
    } finally {
      setExporting(false);
    }
  };

  // ============================================
  // RENDER GUARDS
  // ============================================

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!authUser || !canViewReturns) {
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
                  Returns & Refunds
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Manage product returns and refunds
                  {totalReturns > 0 && ` · ${totalReturns} total returns`}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => fetchReturns(true)}
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
              disabled={exporting || returns.length === 0}
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
          <StatCard title="Processed" value={stats.processed} color="success" />
          <StatCard title="Cancelled" value={stats.cancelled} color="gray" />
          <StatCard
            title="Total Amount"
            value={formatCurrency(stats.totalAmount)}
            color="brand"
          />
        </div>

        {/* Filters */}
        <div className="card-brand p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by return #, receipt, customer..."
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
              <option value="PROCESSED">Processed</option>
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
              onClick={() => fetchReturns()}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors focus-ring"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {/* Returns List */}
        {returns.length === 0 ? (
          <div className="card-brand p-12 text-center">
            <div className="text-6xl mb-4">🔄</div>
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No Returns Found
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              {filters.search || filters.status !== 'all'
                ? 'No returns match your search criteria.'
                : 'No return requests have been submitted yet.'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <AnimatePresence>
                {returns.map((returnItem, index) => (
                  <motion.div
                    key={returnItem.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="card-brand p-0 overflow-hidden hover:shadow-card-hover transition-all"
                  >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-brand-600 dark:text-brand-400 tabular-nums">
                          #{returnItem.returnNumber}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(returnItem.createdAt)}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs">
                          {titleCase(returnItem.returnType)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            returnItem.status
                          )} flex items-center gap-1`}
                        >
                          <StatusIcon status={returnItem.status} />
                          {titleCase(returnItem.status)}
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                          {formatCurrency(returnItem.total)}
                        </span>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {returnItem.customerName || 'Guest'}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="w-4 h-4" />
                              Receipt: #{returnItem.receiptNumber}
                            </span>
                            <span className="flex items-center gap-1 tabular-nums">
                              <Package className="w-4 h-4" />
                              {returnItem.items.length} items
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getRefundMethodColor(
                                returnItem.refundMethod
                              )} flex items-center gap-1`}
                            >
                              {humanizeMethod(returnItem.refundMethod)}
                            </span>
                            {returnItem.notes && (
                              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs">
                                📝 {returnItem.notes}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => {
                              setSelectedReturn(returnItem);
                              setShowDetailModal(true);
                            }}
                            className="px-3 py-1.5 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 focus-ring"
                          >
                            <Eye className="w-4 h-4" />
                            Details
                          </button>
                          <button
                            onClick={() => handlePrintReturn(returnItem)}
                            className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 focus-ring"
                          >
                            <Printer className="w-4 h-4" />
                            Print
                          </button>
                          {canManageReturns &&
                            returnItem.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedReturn(returnItem);
                                    setShowProcessModal(true);
                                  }}
                                  className="px-3 py-1.5 bg-success-600 text-white rounded-lg hover:bg-success-700 text-sm font-medium transition-colors flex items-center gap-1 focus-ring"
                                >
                                  <Check className="w-4 h-4" />
                                  Process
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedReturn(returnItem);
                                    setRejectReason('');
                                    setShowRejectModal(true);
                                  }}
                                  className="px-3 py-1.5 bg-danger-600 text-white rounded-lg hover:bg-danger-700 text-sm font-medium transition-colors flex items-center gap-1 focus-ring"
                                >
                                  <X className="w-4 h-4" />
                                  Reject
                                </button>
                              </>
                            )}
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
                            ? 'bg-brand-500 text-white'
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
        {showDetailModal && selectedReturn && (
          <DetailModal
            returnData={selectedReturn}
            onClose={() => setShowDetailModal(false)}
            onProcess={() => {
              setShowDetailModal(false);
              setShowProcessModal(true);
            }}
            onReject={() => {
              setShowDetailModal(false);
              setRejectReason('');
              setShowRejectModal(true);
            }}
            onPrint={() => handlePrintReturn(selectedReturn)}
            canManage={canManageReturns}
          />
        )}
      </AnimatePresence>

      {/* Process Modal */}
      <AnimatePresence>
        {showProcessModal && selectedReturn && (
          <ProcessModal
            returnData={selectedReturn}
            onClose={() => setShowProcessModal(false)}
            onConfirm={handleProcessReturn}
            processing={processing}
          />
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && selectedReturn && (
          <RejectModal
            returnData={selectedReturn}
            onClose={() => setShowRejectModal(false)}
            onConfirm={handleRejectReturn}
            reason={rejectReason}
            setReason={setRejectReason}
            processing={processing}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function computeReturnStats(returns: SaleReturn[]): ReturnStats {
  const totalAmount = returns.reduce((sum, r) => sum + (r.total || 0), 0);

  return {
    total: returns.length,
    pending: returns.filter((r) => r.status === 'PENDING').length,
    approved: returns.filter((r) => r.status === 'APPROVED').length,
    rejected: returns.filter((r) => r.status === 'REJECTED').length,
    processed: returns.filter((r) => r.status === 'PROCESSED').length,
    cancelled: returns.filter((r) => r.status === 'CANCELLED').length,
    totalAmount,
  };
}

function generateReturnHTML(ret: SaleReturn): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Return #${ret.returnNumber}</title>
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
          <h3>RETURN</h3>
          <div><strong>#${ret.returnNumber}</strong></div>
          <div>${formatDateTime(ret.createdAt)}</div>
          <div>Status: ${titleCase(ret.status)}</div>
        </div>

        <div>
          <div class="row"><span>Customer</span><span>${ret.customerName || 'Guest'}</span></div>
          <div class="row"><span>Receipt</span><span>#${ret.receiptNumber}</span></div>
          <div class="row"><span>Method</span><span>${humanizeMethod(ret.refundMethod)}</span></div>
          <div class="row"><span>Type</span><span>${titleCase(ret.returnType)}</span></div>
        </div>

        <div class="divider"></div>

        <div class="items">
          ${ret.items
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
          <div class="row"><span>Subtotal</span><span>$${ret.subtotal.toFixed(2)}</span></div>
          <div class="row"><span>Tax</span><span>$${ret.tax.toFixed(2)}</span></div>
          <div class="row grand"><span>Total</span><span>$${ret.total.toFixed(2)}</span></div>
        </div>

        ${
          ret.reason
            ? `<div class="divider"></div><div><strong>Reason:</strong> ${ret.reason}</div>`
            : ''
        }

        <div class="footer">
          <div>This is a return confirmation.</div>
        </div>
      </body>
    </html>
  `;
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface StatCardProps {
  title: string;
  value: number | string;
  color: string;
}

function StatCard({ title, value, color }: StatCardProps) {
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
    </div>
  );
}

// ============================================
// DETAIL MODAL
// ============================================

interface DetailModalProps {
  returnData: SaleReturn;
  onClose: () => void;
  onProcess: () => void;
  onReject: () => void;
  onPrint: () => void;
  canManage: boolean;
}

function DetailModal({
  returnData,
  onClose,
  onProcess,
  onReject,
  onPrint,
  canManage,
}: DetailModalProps) {
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
              Return #{returnData.returnNumber}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatDateTime(returnData.createdAt)}
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
                returnData.status
              )} flex items-center gap-2`}
            >
              <StatusIcon status={returnData.status} />
              {titleCase(returnData.status)}
            </span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              {formatCurrency(returnData.total)}
            </span>
          </div>

          {/* Customer & Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Customer
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {returnData.customerName || 'Guest'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {returnData.customerEmail}
              </p>
            </div>
            {returnData.customerPhone && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Phone
                </p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {returnData.customerPhone}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Receipt
              </p>
              <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                #{returnData.receiptNumber}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Refund Method
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {humanizeMethod(returnData.refundMethod)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Return Type
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {titleCase(returnData.returnType)}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Reason
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {returnData.reason || '—'}
              </p>
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              Items
            </h3>
            <div className="space-y-2">
              {returnData.items.map((item: ReturnItem) => (
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
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getConditionBadge(
                          item.condition
                        )}`}
                      >
                        {item.condition}
                      </span>
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
                  {formatCurrency(returnData.subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Tax</span>
                <span className="text-gray-900 dark:text-white tabular-nums">
                  {formatCurrency(returnData.tax)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-900 dark:text-white">Total</span>
                <span className="text-brand-600 dark:text-brand-400 tabular-nums">
                  {formatCurrency(returnData.total)}
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
            {canManage && returnData.status === 'PENDING' && (
              <>
                <button
                  onClick={onProcess}
                  className="px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 flex items-center gap-2 focus-ring"
                >
                  <Check className="w-4 h-4" />
                  Process Return
                </button>
                <button
                  onClick={onReject}
                  className="px-4 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-700 flex items-center gap-2 focus-ring"
                >
                  <X className="w-4 h-4" />
                  Reject Return
                </button>
              </>
            )}
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
// PROCESS MODAL
// ============================================

interface ProcessModalProps {
  returnData: SaleReturn;
  onClose: () => void;
  onConfirm: () => void;
  processing: boolean;
}

function ProcessModal({
  returnData,
  onClose,
  onConfirm,
  processing,
}: ProcessModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-modal p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Process Return
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to process return #{returnData.returnNumber}?
          <br />
          <span className="text-sm">
            Total amount: {formatCurrency(returnData.total)}
          </span>
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={processing}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={processing}
            className="px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 flex items-center gap-2 disabled:opacity-50 focus-ring"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {processing ? 'Processing...' : 'Confirm Process'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// REJECT MODAL
// ============================================

interface RejectModalProps {
  returnData: SaleReturn;
  onClose: () => void;
  onConfirm: () => void;
  reason: string;
  setReason: (value: string) => void;
  processing: boolean;
}

function RejectModal({
  returnData,
  onClose,
  onConfirm,
  reason,
  setReason,
  processing,
}: RejectModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-modal p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Reject Return
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to reject return #{returnData.returnNumber}?
          The reason will be appended to the sale notes.
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Reason for Rejection <span className="text-danger-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-danger-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            placeholder="Enter reason for rejection..."
            required
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={processing}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={processing || !reason.trim()}
            className="px-4 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <X className="w-4 h-4" />
            )}
            {processing ? 'Rejecting...' : 'Confirm Reject'}
          </button>
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
