// packages/web/app/(dashboard)/admin/sales/invoices/page.tsx

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
  Send,
  X,
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
// Invoice statuses are UPPERCASE to match the Prisma enum
// `InvoiceStatus`: DRAFT | SENT | PAID | OVERDUE | CANCELLED | VOID |
// PARTIALLY_PAID.

type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'VOID'
  | 'PARTIALLY_PAID';

type InvoicePaymentTerms =
  | 'NET_7'
  | 'NET_15'
  | 'NET_30'
  | 'NET_60'
  | 'DUE_ON_RECEIPT';

interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  discount?: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  saleId: string;
  receiptNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
  status: InvoiceStatus;
  paymentTerms: InvoicePaymentTerms;
  dueDate?: string;
  notes?: string;
  createdAt: string;
  sentAt?: string;
  paidAt?: string;
  voidAt?: string;
  cancelledAt?: string;
  businessUnitId: string;
  businessUnitName?: string;
}

interface InvoiceFilters {
  search: string;
  status: string;
  startDate: string;
  endDate: string;
  page: number;
  limit: number;
}

interface InvoiceStats {
  total: number;
  draft: number;
  sent: number;
  paid: number;
  overdue: number;
  cancelled: number;
  void: number;
  totalAmount: number;
  totalPaid: number;
  totalBalance: number;
  averageInvoice: number;
}

// ============================================
// HELPERS — backend Sale → Invoice shape
// ============================================
//
// The backend exposes invoices via:
//     GET  /api/sales/invoices          (SaleController.getInvoices)
//     PUT  /api/sales/:id               (SaleController.updateSale)
//     POST /api/sales/:id/email-receipt (SaleController.sendReceiptEmail)
//
// There is no dedicated `/api/invoices/*` router. Every invoice in
// the system is a `Sale` with a non-null `invoiceId`, joined to an
// `Invoice` row. The list endpoint returns sales; the frontend
// flattens `sale.invoice` + `sale.customer` into the shape this page
// renders.

function normalizeInvoiceStatus(raw: string | null | undefined): InvoiceStatus {
  const value = (raw || 'DRAFT').toUpperCase();
  switch (value) {
    case 'DRAFT':
    case 'SENT':
    case 'PAID':
    case 'OVERDUE':
    case 'CANCELLED':
    case 'VOID':
    case 'PARTIALLY_PAID':
      return value as InvoiceStatus;
    default:
      return 'DRAFT';
  }
}

function normalizePaymentTerms(
  raw: string | null | undefined
): InvoicePaymentTerms {
  const value = (raw || 'NET_30').toUpperCase();
  switch (value) {
    case 'NET_7':
    case 'NET_15':
    case 'NET_30':
    case 'NET_60':
    case 'DUE_ON_RECEIPT':
      return value as InvoicePaymentTerms;
    default:
      return 'NET_30';
  }
}

function saleToInvoice(sale: any): Invoice | null {
  const inv = sale.invoice;
  if (!inv) return null;

  const customer = sale.customer || {};

  const items: InvoiceItem[] = (sale.items || []).map((item: any) => ({
    id: item.id,
    productId: item.productId,
    productName: item.product?.name || item.productName || 'Item',
    sku: item.product?.sku || item.sku || 'N/A',
    quantity: item.quantity || 0,
    unitPrice: item.unitPrice || 0,
    total: item.total || 0,
    discount: item.discount || 0,
  }));

  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber || 'N/A',
    saleId: sale.id,
    receiptNumber: sale.receiptNumber || 'N/A',
    customerName: sale.customerName
      ? sale.customerName
      : customer.firstName
      ? `${customer.firstName} ${customer.lastName}`.trim()
      : 'Guest',
    customerEmail: customer.email || 'N/A',
    customerPhone: customer.phoneNumber,
    customerAddress: customer.address,
    items,
    subtotal: inv.subtotal ?? sale.subtotal ?? 0,
    tax: inv.tax ?? sale.tax ?? 0,
    discount: inv.discount ?? sale.discount ?? 0,
    total: inv.total ?? sale.total ?? 0,
    paidAmount: inv.paidAmount ?? sale.paidAmount ?? 0,
    balanceDue: inv.balanceDue ?? 0,
    status: normalizeInvoiceStatus(inv.status),
    paymentTerms: normalizePaymentTerms(inv.paymentTerms),
    dueDate: inv.dueDate,
    notes: inv.notes,
    createdAt: inv.createdAt || sale.saleDate || sale.createdAt,
    sentAt: inv.sentAt,
    paidAt: inv.paidAt,
    voidAt: inv.voidAt,
    cancelledAt: inv.cancelledAt,
    businessUnitId: sale.businessUnitId,
    businessUnitName: sale.businessUnit?.name,
  };
}

// ============================================
// STYLE / LABEL HELPERS
// ============================================

const DEFAULT_INVOICE_STATS: InvoiceStats = {
  total: 0,
  draft: 0,
  sent: 0,
  paid: 0,
  overdue: 0,
  cancelled: 0,
  void: 0,
  totalAmount: 0,
  totalPaid: 0,
  totalBalance: 0,
  averageInvoice: 0,
};

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400',
    SENT: 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400',
    PAID: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
    OVERDUE:
      'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400',
    CANCELLED:
      'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
    VOID: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400',
    PARTIALLY_PAID:
      'bg-brand-accent-100 dark:bg-brand-accent-900/30 text-brand-accent-700 dark:text-brand-accent-400',
  };
  return (
    colors[status] ||
    'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400'
  );
};

const getStatusIcon = (status: string): React.ElementType => {
  const icons: Record<string, React.ElementType> = {
    DRAFT: FileText,
    SENT: Send,
    PAID: CheckCircle,
    OVERDUE: AlertCircle,
    CANCELLED: XCircle,
    VOID: XCircle,
    PARTIALLY_PAID: Clock,
  };
  return icons[status] || AlertCircle;
};

const StatusIcon = ({ status }: { status: string }) => {
  const Icon = getStatusIcon(status);
  return <Icon className="w-4 h-4 inline mr-1" />;
};

const getPaymentTermsLabel = (terms: string): string => {
  const labels: Record<string, string> = {
    NET_7: 'Net 7',
    NET_15: 'Net 15',
    NET_30: 'Net 30',
    NET_60: 'Net 60',
    DUE_ON_RECEIPT: 'Due on Receipt',
  };
  return labels[terms] || terms;
};

const titleCase = (value: string): string => {
  if (!value) return value;
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function InvoicesPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { user: authUser } = useAuth();
  const router = useRouter();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState<InvoiceStats>(DEFAULT_INVOICE_STATS);

  const [filters, setFilters] = useState<InvoiceFilters>({
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
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showPaidModal, setShowPaidModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [exporting, setExporting] = useState(false);

  const userRole = ((authUser?.role as string) || 'EMPLOYEE').toUpperCase();
  const canManageInvoices = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(
    userRole
  );
  const canViewInvoices = [
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
    'EMPLOYEE',
    'CASHIER',
  ].includes(userRole);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/login?redirect=/admin/sales/invoices');
      return;
    }
    if (isLoaded && isSignedIn && !canViewInvoices) {
      router.push('/admin/sales');
      toast.error('You do not have permission to view invoices');
    }
  }, [isLoaded, isSignedIn, router, canViewInvoices]);

  // ============================================
  // FETCH
  // ============================================

  const fetchInvoices = useCallback(
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

        // If a specific invoice status was chosen, pass it as the
        // sale-status filter. There's no `invoiceStatus` param on
        // the backend — invoice status is filtered client-side.
        const salesPage = await saleService.getAllSales(params);

        const rawSales: any[] = (salesPage as any).data || [];
        const flattened: Invoice[] = rawSales
          .map(saleToInvoice)
          .filter((inv): inv is Invoice => inv !== null);

        const filtered =
          filters.status === 'all'
            ? flattened
            : flattened.filter((inv) => inv.status === filters.status);

        setInvoices(filtered);
        setTotalInvoices((salesPage as any).total || filtered.length);
        setTotalPages((salesPage as any).totalPages || 1);
        setStats(computeInvoiceStats(filtered));
      } catch (error: any) {
        console.error('Error fetching invoices:', error);
        toast.error(error?.message || 'Failed to load invoices');
        setInvoices([]);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [authUser, filters]
  );

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

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
   * "Send" invoice — emails the receipt/receipt-equivalent. The
   * backend's email route lives on sales:
   *     POST /api/sales/:id/email-receipt
   */
  const handleSendInvoice = async () => {
    if (!selectedInvoice) return;

    try {
      setProcessing(true);
      await saleService.sendReceiptEmail(
        selectedInvoice.saleId,
        selectedInvoice.customerEmail
      );
      toast.success('Invoice sent successfully');
      setShowSendModal(false);
      fetchInvoices(true);
    } catch (error: any) {
      console.error('Failed to send invoice:', error);
      toast.error(error?.message || 'Failed to send invoice');
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Mark invoice as paid — updates the sale status to PAID and
   * annotates the notes with the payment method.
   */
  const handleMarkAsPaid = async () => {
    if (!selectedInvoice) return;

    try {
      setProcessing(true);
      const existing = '';
      const appended = existing
        ? `${existing}\nMarked as paid via ${paymentMethod}`
        : `Marked as paid via ${paymentMethod}`;
      await saleService.updateSale(selectedInvoice.saleId, {
        status: 'COMPLETED',
        notes: appended,
      } as any);
      toast.success('Invoice marked as paid');
      setShowPaidModal(false);
      fetchInvoices(true);
    } catch (error: any) {
      console.error('Failed to mark invoice as paid:', error);
      toast.error(error?.message || 'Failed to mark invoice as paid');
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Void invoice — sets the sale to VOID and appends the reason to
   * notes so the historical record is preserved.
   */
  const handleVoidInvoice = async () => {
    if (!selectedInvoice || !voidReason.trim()) return;

    try {
      setProcessing(true);
      const existing = selectedInvoice.notes || '';
      const appended = existing
        ? `${existing}\nVoided: ${voidReason.trim()}`
        : `Voided: ${voidReason.trim()}`;
      await saleService.updateSale(selectedInvoice.saleId, {
        status: 'VOID',
        notes: appended,
      } as any);
      toast.success('Invoice voided successfully');
      setShowVoidModal(false);
      setVoidReason('');
      fetchInvoices(true);
    } catch (error: any) {
      console.error('Failed to void invoice:', error);
      toast.error(error?.message || 'Failed to void invoice');
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Cancel invoice — sets the sale to CANCELLED and appends the
   * reason to notes.
   */
  const handleCancelInvoice = async () => {
    if (!selectedInvoice || !cancelReason.trim()) return;

    try {
      setProcessing(true);
      const existing = selectedInvoice.notes || '';
      const appended = existing
        ? `${existing}\nCancelled: ${cancelReason.trim()}`
        : `Cancelled: ${cancelReason.trim()}`;
      await saleService.updateSale(selectedInvoice.saleId, {
        status: 'CANCELLED',
        notes: appended,
      } as any);
      toast.success('Invoice cancelled successfully');
      setShowCancelModal(false);
      setCancelReason('');
      fetchInvoices(true);
    } catch (error: any) {
      console.error('Failed to cancel invoice:', error);
      toast.error(error?.message || 'Failed to cancel invoice');
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Export invoices — uses the sales export endpoint with the same
   * date range. Produces a CSV of the sales that carry invoices.
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
        toast.error('No invoices to export');
        return;
      }

      const headers = [
        'Invoice #',
        'Receipt',
        'Date',
        'Due Date',
        'Customer',
        'Email',
        'Subtotal',
        'Tax',
        'Discount',
        'Total',
        'Paid',
        'Balance',
        'Status',
        'Terms',
        'Items',
      ];
      const rows = invoices.map((invoice) => [
        invoice.invoiceNumber,
        invoice.receiptNumber,
        new Date(invoice.createdAt).toISOString().split('T')[0],
        invoice.dueDate
          ? new Date(invoice.dueDate).toISOString().split('T')[0]
          : '',
        invoice.customerName,
        invoice.customerEmail,
        invoice.subtotal.toFixed(2),
        invoice.tax.toFixed(2),
        invoice.discount.toFixed(2),
        invoice.total.toFixed(2),
        invoice.paidAmount.toFixed(2),
        invoice.balanceDue.toFixed(2),
        invoice.status,
        invoice.paymentTerms,
        invoice.items.length,
      ]);
      const csv = [
        headers.join(','),
        ...rows.map((row: (string | number)[]) => row.join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Invoices exported successfully');
    } catch (error: any) {
      console.error('Failed to export invoices:', error);
      toast.error(error?.message || 'Failed to export invoices');
    } finally {
      setExporting(false);
    }
  };

  /**
   * Print invoice — opens a print window with a printable invoice.
   */
  const handlePrintInvoice = (invoice: Invoice) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print invoices');
      return;
    }
    printWindow.document.write(generateInvoiceHTML(invoice));
    printWindow.document.close();
    printWindow.print();
    toast.success('Invoice sent to printer');
  };

  // ============================================
  // RENDER GUARDS
  // ============================================

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!authUser || !canViewInvoices) {
    return null;
  }

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
                  Invoices
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Manage customer invoices and billing
                  {totalInvoices > 0 && ` · ${totalInvoices} total invoices`}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => fetchInvoices(true)}
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
              disabled={exporting || invoices.length === 0}
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
          <StatCard title="Draft" value={stats.draft} color="gray" />
          <StatCard title="Sent" value={stats.sent} color="brand" />
          <StatCard title="Paid" value={stats.paid} color="success" />
          <StatCard title="Overdue" value={stats.overdue} color="danger" />
          <StatCard title="Cancelled" value={stats.cancelled} color="warning" />
          <StatCard
            title="Total Amount"
            value={formatCurrency(stats.totalAmount)}
            color="brand"
          />
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="card-brand p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total Paid
            </p>
            <p className="text-2xl font-bold text-success-600 dark:text-success-400 tabular-nums">
              {formatCurrency(stats.totalPaid)}
            </p>
          </div>
          <div className="card-brand p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total Balance Due
            </p>
            <p className="text-2xl font-bold text-warning-600 dark:text-warning-400 tabular-nums">
              {formatCurrency(stats.totalBalance)}
            </p>
          </div>
          <div className="card-brand p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Average Invoice
            </p>
            <p className="text-2xl font-bold text-brand-accent-600 dark:text-brand-accent-400 tabular-nums">
              {formatCurrency(stats.averageInvoice)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="card-brand p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by invoice #, receipt, customer..."
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
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="VOID">Void</option>
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
              onClick={() => fetchInvoices()}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors focus-ring"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {/* Invoices List */}
        {invoices.length === 0 ? (
          <div className="card-brand p-12 text-center">
            <div className="text-6xl mb-4">📄</div>
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No Invoices Found
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              {filters.search || filters.status !== 'all'
                ? 'No invoices match your search criteria.'
                : 'No invoices have been created yet.'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <AnimatePresence>
                {invoices.map((invoice, index) => (
                  <motion.div
                    key={invoice.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="card-brand p-0 overflow-hidden hover:shadow-card-hover transition-all"
                  >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-brand-600 dark:text-brand-400 tabular-nums">
                          #{invoice.invoiceNumber}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(invoice.createdAt)}
                        </span>
                        {invoice.dueDate && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Due: {formatDate(invoice.dueDate)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            invoice.status
                          )} flex items-center gap-1`}
                        >
                          <StatusIcon status={invoice.status} />
                          {titleCase(invoice.status)}
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                          {formatCurrency(invoice.total)}
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
                              {invoice.customerName || 'Guest'}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="w-4 h-4" />
                              Receipt: #{invoice.receiptNumber}
                            </span>
                            <span className="flex items-center gap-1 tabular-nums">
                              <Package className="w-4 h-4" />
                              {invoice.items.length} items
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs font-medium">
                              {getPaymentTermsLabel(invoice.paymentTerms)}
                            </span>
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs tabular-nums">
                              Balance: {formatCurrency(invoice.balanceDue)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowDetailModal(true);
                            }}
                            className="px-3 py-1.5 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 focus-ring"
                          >
                            <Eye className="w-4 h-4" />
                            Details
                          </button>
                          <button
                            onClick={() => handlePrintInvoice(invoice)}
                            className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 focus-ring"
                          >
                            <Printer className="w-4 h-4" />
                            Print
                          </button>
                          {canManageInvoices && invoice.status === 'DRAFT' && (
                            <button
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setShowSendModal(true);
                              }}
                              className="px-3 py-1.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 text-sm font-medium transition-colors flex items-center gap-1 focus-ring"
                            >
                              <Send className="w-4 h-4" />
                              Send
                            </button>
                          )}
                          {canManageInvoices && invoice.status === 'SENT' && (
                            <button
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setShowPaidModal(true);
                              }}
                              className="px-3 py-1.5 bg-success-600 text-white rounded-lg hover:bg-success-700 text-sm font-medium transition-colors flex items-center gap-1 focus-ring"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Mark Paid
                            </button>
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
        {showDetailModal && selectedInvoice && (
          <DetailModal
            invoiceData={selectedInvoice}
            onClose={() => setShowDetailModal(false)}
            onSend={() => {
              setShowDetailModal(false);
              setShowSendModal(true);
            }}
            onPaid={() => {
              setShowDetailModal(false);
              setShowPaidModal(true);
            }}
            onVoid={() => {
              setShowDetailModal(false);
              setVoidReason('');
              setShowVoidModal(true);
            }}
            onCancel={() => {
              setShowDetailModal(false);
              setCancelReason('');
              setShowCancelModal(true);
            }}
            onPrint={() => handlePrintInvoice(selectedInvoice)}
            canManage={canManageInvoices}
          />
        )}
      </AnimatePresence>

      {/* Send Modal */}
      <AnimatePresence>
        {showSendModal && selectedInvoice && (
          <SendModal
            invoiceData={selectedInvoice}
            onClose={() => setShowSendModal(false)}
            onConfirm={handleSendInvoice}
            processing={processing}
          />
        )}
      </AnimatePresence>

      {/* Paid Modal */}
      <AnimatePresence>
        {showPaidModal && selectedInvoice && (
          <PaidModal
            invoiceData={selectedInvoice}
            onClose={() => setShowPaidModal(false)}
            onConfirm={handleMarkAsPaid}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            processing={processing}
          />
        )}
      </AnimatePresence>

      {/* Void Modal */}
      <AnimatePresence>
        {showVoidModal && selectedInvoice && (
          <VoidModal
            invoiceData={selectedInvoice}
            onClose={() => setShowVoidModal(false)}
            onConfirm={handleVoidInvoice}
            reason={voidReason}
            setReason={setVoidReason}
            processing={processing}
          />
        )}
      </AnimatePresence>

      {/* Cancel Modal */}
      <AnimatePresence>
        {showCancelModal && selectedInvoice && (
          <CancelModal
            invoiceData={selectedInvoice}
            onClose={() => setShowCancelModal(false)}
            onConfirm={handleCancelInvoice}
            reason={cancelReason}
            setReason={setCancelReason}
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

function computeInvoiceStats(invoices: Invoice[]): InvoiceStats {
  const totalAmount = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
  const totalPaid = invoices.reduce((sum, i) => sum + (i.paidAmount || 0), 0);
  const totalBalance = invoices.reduce(
    (sum, i) => sum + (i.balanceDue || 0),
    0
  );

  return {
    total: invoices.length,
    draft: invoices.filter((i) => i.status === 'DRAFT').length,
    sent: invoices.filter((i) => i.status === 'SENT').length,
    paid: invoices.filter((i) => i.status === 'PAID').length,
    overdue: invoices.filter((i) => i.status === 'OVERDUE').length,
    cancelled: invoices.filter((i) => i.status === 'CANCELLED').length,
    void: invoices.filter((i) => i.status === 'VOID').length,
    totalAmount,
    totalPaid,
    totalBalance,
    averageInvoice: invoices.length > 0 ? totalAmount / invoices.length : 0,
  };
}

function generateInvoiceHTML(invoice: Invoice): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice ${invoice.invoiceNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            padding: 40px;
            max-width: 720px;
            margin: 0 auto;
            color: #1f2937;
            font-size: 13px;
            line-height: 1.5;
          }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { font-size: 28px; color: #111827; margin-bottom: 8px; }
          .header .meta { text-align: right; font-size: 12px; color: #6b7280; }
          .header .meta strong { color: #111827; font-size: 14px; display: block; margin-bottom: 4px; }
          .parties { display: flex; gap: 40px; margin-bottom: 30px; }
          .party { flex: 1; }
          .party h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; margin-bottom: 8px; }
          .party p { font-size: 13px; color: #374151; margin-bottom: 2px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; padding: 10px 8px; border-bottom: 1px solid #e5e7eb; }
          th.right, td.right { text-align: right; }
          td { padding: 10px 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #374151; }
          .totals { margin-left: auto; width: 280px; margin-top: 10px; }
          .totals .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
          .totals .row.grand { font-size: 16px; font-weight: 700; color: #111827; border-top: 2px solid #e5e7eb; padding-top: 12px; margin-top: 6px; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>INVOICE</h1>
            <p style="color: #6b7280; font-size: 12px;">${invoice.businessUnitName || 'Store'}</p>
          </div>
          <div class="meta">
            <strong>${invoice.invoiceNumber}</strong>
            Issued: ${formatDate(invoice.createdAt)}<br>
            ${invoice.dueDate ? `Due: ${formatDate(invoice.dueDate)}<br>` : ''}
            Status: ${titleCase(invoice.status)}
          </div>
        </div>

        <div class="parties">
          <div class="party">
            <h3>Bill To</h3>
            <p><strong>${invoice.customerName || 'Guest'}</strong></p>
            <p>${invoice.customerEmail}</p>
            ${invoice.customerPhone ? `<p>${invoice.customerPhone}</p>` : ''}
            ${invoice.customerAddress ? `<p>${invoice.customerAddress}</p>` : ''}
          </div>
          <div class="party">
            <h3>Details</h3>
            <p>Receipt: #${invoice.receiptNumber}</p>
            <p>Terms: ${getPaymentTermsLabel(invoice.paymentTerms)}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>SKU</th>
              <th class="right">Qty</th>
              <th class="right">Unit Price</th>
              <th class="right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items
              .map(
                (item) => `
              <tr>
                <td>${item.productName}</td>
                <td style="color: #9ca3af;">${item.sku}</td>
                <td class="right">${item.quantity}</td>
                <td class="right">$${item.unitPrice.toFixed(2)}</td>
                <td class="right">$${item.total.toFixed(2)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="row"><span>Subtotal</span><span>$${invoice.subtotal.toFixed(2)}</span></div>
          <div class="row"><span>Tax</span><span>$${invoice.tax.toFixed(2)}</span></div>
          ${invoice.discount > 0 ? `<div class="row" style="color: #059669;"><span>Discount</span><span>-$${invoice.discount.toFixed(2)}</span></div>` : ''}
          <div class="row grand"><span>Total</span><span>$${invoice.total.toFixed(2)}</span></div>
          <div class="row"><span>Paid</span><span>$${invoice.paidAmount.toFixed(2)}</span></div>
          <div class="row" style="font-weight: 600; color: #b45309;"><span>Balance Due</span><span>$${invoice.balanceDue.toFixed(2)}</span></div>
        </div>

        ${invoice.notes ? `<div style="margin-top: 30px; padding: 15px; background: #f9fafb; border-radius: 6px;"><strong style="font-size: 11px; text-transform: uppercase; color: #6b7280;">Notes</strong><p style="margin-top: 6px;">${invoice.notes}</p></div>` : ''}

        <div class="footer">
          <p>Thank you for your business.</p>
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
    'brand-accent': 'text-brand-accent-600 dark:text-brand-accent-400',
    secondary: 'text-secondary-600 dark:text-secondary-400',
    success: 'text-success-600 dark:text-success-400',
    warning: 'text-warning-600 dark:text-warning-400',
    danger: 'text-danger-600 dark:text-danger-400',
    gray: 'text-gray-600 dark:text-gray-400',
  };

  return (
    <div className="card-brand p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <p
        className={`text-xl font-bold tabular-nums ${
          colors[color] || 'text-gray-900 dark:text-white'
        }`}
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
  invoiceData: Invoice;
  onClose: () => void;
  onSend: () => void;
  onPaid: () => void;
  onVoid: () => void;
  onCancel: () => void;
  onPrint: () => void;
  canManage: boolean;
}

function DetailModal({
  invoiceData,
  onClose,
  onSend,
  onPaid,
  onVoid,
  onCancel,
  onPrint,
  canManage,
}: DetailModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-modal p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700 sidebar-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
              Invoice #{invoiceData.invoiceNumber}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatDateTime(invoiceData.createdAt)}
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
                invoiceData.status
              )} flex items-center gap-2`}
            >
              <StatusIcon status={invoiceData.status} />
              {titleCase(invoiceData.status)}
            </span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              {formatCurrency(invoiceData.total)}
            </span>
          </div>

          {/* Business & Customer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Business
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {invoiceData.businessUnitName || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Customer
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {invoiceData.customerName || 'Guest'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {invoiceData.customerEmail}
              </p>
              {invoiceData.customerPhone && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {invoiceData.customerPhone}
                </p>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Receipt
              </p>
              <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                #{invoiceData.receiptNumber}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Payment Terms
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {getPaymentTermsLabel(invoiceData.paymentTerms)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Due Date
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {invoiceData.dueDate ? formatDate(invoiceData.dueDate) : '—'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Balance Due
              </p>
              <p className="font-medium text-warning-600 dark:text-warning-400 tabular-nums">
                {formatCurrency(invoiceData.balanceDue)}
              </p>
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              Items
            </h3>
            <div className="space-y-2">
              {invoiceData.items.map((item: InvoiceItem) => (
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
                      <span className="tabular-nums">
                        @ {formatCurrency(item.unitPrice)}
                      </span>
                    </div>
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
                  {formatCurrency(invoiceData.subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Tax</span>
                <span className="text-gray-900 dark:text-white tabular-nums">
                  {formatCurrency(invoiceData.tax)}
                </span>
              </div>
              {invoiceData.discount > 0 && (
                <div className="flex justify-between text-sm text-success-600 dark:text-success-400">
                  <span>Discount</span>
                  <span className="tabular-nums">
                    -{formatCurrency(invoiceData.discount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-900 dark:text-white">Total</span>
                <span className="text-brand-600 dark:text-brand-400 tabular-nums">
                  {formatCurrency(invoiceData.total)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Paid</span>
                <span className="text-success-600 dark:text-success-400 tabular-nums">
                  {formatCurrency(invoiceData.paidAmount)}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-sm pt-1 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-700 dark:text-gray-300">
                  Balance Due
                </span>
                <span className="text-warning-600 dark:text-warning-400 tabular-nums">
                  {formatCurrency(invoiceData.balanceDue)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoiceData.notes && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Notes
              </p>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {invoiceData.notes}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onPrint}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2 focus-ring"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            {canManage && invoiceData.status === 'DRAFT' && (
              <button
                onClick={onSend}
                className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2 focus-ring"
              >
                <Send className="w-4 h-4" />
                Send Invoice
              </button>
            )}
            {canManage && invoiceData.status === 'SENT' && (
              <button
                onClick={onPaid}
                className="px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 flex items-center gap-2 focus-ring"
              >
                <CheckCircle className="w-4 h-4" />
                Mark as Paid
              </button>
            )}
            {canManage &&
              invoiceData.status !== 'PAID' &&
              invoiceData.status !== 'CANCELLED' &&
              invoiceData.status !== 'VOID' && (
                <>
                  <button
                    onClick={onVoid}
                    className="px-4 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-700 flex items-center gap-2 focus-ring"
                  >
                    <XCircle className="w-4 h-4" />
                    Void
                  </button>
                  <button
                    onClick={onCancel}
                    className="px-4 py-2 bg-warning-600 text-white rounded-lg hover:bg-warning-700 flex items-center gap-2 focus-ring"
                  >
                    <X className="w-4 h-4" />
                    Cancel
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
// SEND MODAL
// ============================================

interface SendModalProps {
  invoiceData: Invoice;
  onClose: () => void;
  onConfirm: () => void;
  processing: boolean;
}

function SendModal({
  invoiceData,
  onClose,
  onConfirm,
  processing,
}: SendModalProps) {
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
          Send Invoice
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Send invoice #{invoiceData.invoiceNumber} to{' '}
          {invoiceData.customerEmail}?
          <br />
          <span className="text-sm">
            Total amount: {formatCurrency(invoiceData.total)}
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
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2 disabled:opacity-50 focus-ring"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {processing ? 'Sending...' : 'Send Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PAID MODAL
// ============================================

interface PaidModalProps {
  invoiceData: Invoice;
  onClose: () => void;
  onConfirm: () => void;
  paymentMethod: string;
  setPaymentMethod: (value: string) => void;
  processing: boolean;
}

function PaidModal({
  invoiceData,
  onClose,
  onConfirm,
  paymentMethod,
  setPaymentMethod,
  processing,
}: PaidModalProps) {
  const methods = [
    'CASH',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'MOBILE_MONEY',
    'BANK_TRANSFER',
    'GIFT_CARD',
    'CHECK',
  ];

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
          Mark Invoice as Paid
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Mark invoice #{invoiceData.invoiceNumber} as paid?
          <br />
          <span className="text-sm">
            Amount: {formatCurrency(invoiceData.total)}
          </span>
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Payment Method
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-success-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {methods.map((method) => (
              <option key={method} value={method}>
                {method.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
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
            disabled={processing}
            className="px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 flex items-center gap-2 disabled:opacity-50 focus-ring"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {processing ? 'Processing...' : 'Confirm Paid'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// VOID MODAL
// ============================================

interface VoidModalProps {
  invoiceData: Invoice;
  onClose: () => void;
  onConfirm: () => void;
  reason: string;
  setReason: (value: string) => void;
  processing: boolean;
}

function VoidModal({
  invoiceData,
  onClose,
  onConfirm,
  reason,
  setReason,
  processing,
}: VoidModalProps) {
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
          Void Invoice
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to void invoice #{invoiceData.invoiceNumber}?
          The reason will be appended to the sale notes.
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Reason for Voiding <span className="text-danger-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-danger-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            placeholder="Enter reason for voiding..."
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
              <XCircle className="w-4 h-4" />
            )}
            {processing ? 'Voiding...' : 'Confirm Void'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// CANCEL MODAL
// ============================================

interface CancelModalProps {
  invoiceData: Invoice;
  onClose: () => void;
  onConfirm: () => void;
  reason: string;
  setReason: (value: string) => void;
  processing: boolean;
}

function CancelModal({
  invoiceData,
  onClose,
  onConfirm,
  reason,
  setReason,
  processing,
}: CancelModalProps) {
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
          Cancel Invoice
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to cancel invoice #{invoiceData.invoiceNumber}?
          The reason will be appended to the sale notes.
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Reason for Cancellation{' '}
            <span className="text-danger-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-warning-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            placeholder="Enter reason for cancellation..."
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
            className="px-4 py-2 bg-warning-600 text-white rounded-lg hover:bg-warning-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <X className="w-4 h-4" />
            )}
            {processing ? 'Cancelling...' : 'Confirm Cancel'}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[...Array(3)].map((_, i) => (
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
