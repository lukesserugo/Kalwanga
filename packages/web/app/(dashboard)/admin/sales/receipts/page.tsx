// packages/web/app/(dashboard)/admin/sales/receipts/page.tsx

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
  DollarSign,
  Package,
  FileText,
  Calendar,
  Mail,
  Send,
  Receipt as ReceiptIcon,
  CreditCard,
  User,
  Phone,
  Mail as MailIcon,
  Copy,
  Check,
  Tag,
  Star,
  Sparkles,
} from 'lucide-react';
import {
  saleService,
  getDiscountTypeLabel,
} from '../../../../../services/saleService';
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

type ReceiptPaymentMethod =
  | 'CASH'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'MOBILE_MONEY'
  | 'BANK_TRANSFER'
  | 'GIFT_CARD'
  | 'LOYALTY_POINTS'
  | 'CRYPTO'
  | 'CHECK';

interface ReceiptItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  discount?: number;
}

interface Receipt {
  id: string;
  receiptNumber: string;
  saleId: string;
  orderNumber?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: ReceiptPaymentMethod;
  status: 'issued' | 'sent' | 'printed' | 'cancelled' | 'void';
  notes?: string;
  createdAt: string;
  sentAt?: string;
  printedAt?: string;
  printedBy?: string;
  businessUnitId: string;
  businessUnitName?: string;
  businessUnitAddress?: string;
  businessUnitPhone?: string;
  businessUnitEmail?: string;
  businessUnitTaxId?: string;
  cashierName?: string;
  cashierId?: string;
  terminalId?: string;
  receiptType: 'sale' | 'refund' | 'return';

  // ── Promotion / loyalty breakdown ─────────────────────────
  // Mirrors the five audit columns on `Sale`. Optional so receipts
  // created before the migration still type-check.
  discountType?: string | null;
  promotionCode?: string | null;
  promotionDiscount?: number;
  loyaltyPointsUsed?: number;
  loyaltyDiscount?: number;
}

interface ReceiptFilters {
  search: string;
  status: string;
  startDate: string;
  endDate: string;
  page: number;
  limit: number;
}

interface ReceiptStats {
  total: number;
  issued: number;
  sent: number;
  printed: number;
  cancelled: number;
  void: number;
  totalAmount: number;
  averageAmount: number;
  byPaymentMethod: Record<string, number>;
}

// ============================================
// HELPERS — map a Sale from the backend to a Receipt
// ============================================

/** Map backend payment method to a receipt payment method. */
function normalizePaymentMethod(raw: string): ReceiptPaymentMethod {
  const value = (raw || 'CASH').toUpperCase();
  switch (value) {
    case 'CASH':
    case 'CREDIT_CARD':
    case 'DEBIT_CARD':
    case 'MOBILE_MONEY':
    case 'BANK_TRANSFER':
    case 'GIFT_CARD':
    case 'LOYALTY_POINTS':
    case 'CRYPTO':
    case 'CHECK':
      return value as ReceiptPaymentMethod;
    default:
      return 'CASH';
  }
}

/** Map backend sale status to a receipt status. */
function normalizeReceiptStatus(raw: string): Receipt['status'] {
  const value = (raw || 'COMPLETED').toUpperCase();
  switch (value) {
    case 'COMPLETED':
    case 'PROCESSING':
    case 'PENDING':
      return 'issued';
    case 'CANCELLED':
      return 'cancelled';
    case 'VOID':
    case 'VOIDED':
    case 'REFUNDED':
    case 'RETURNED':
      return 'void';
    default:
      return 'issued';
  }
}

/**
 * Map a raw sale object (from saleService) → Receipt shape used by
 * this page.
 *
 * Uses `saleService.extractBreakdown()` to pull the five promotion /
 * loyalty audit fields off the sale, so the receipt carries the same
 * breakdown every other view does.
 */
function saleToReceipt(sale: any): Receipt {
  const items: ReceiptItem[] = (sale.items || []).map((item: any) => ({
    id: item.id,
    productId: item.productId,
    productName: item.product?.name || item.productName || 'Item',
    sku: item.product?.sku || item.sku || 'N/A',
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.total,
    discount: item.discount || 0,
  }));

  const payment = sale.payments?.[0] || {};
  const customer = sale.customer || {};
  const breakdown = saleService.extractBreakdown(sale);

  return {
    id: sale.id,
    receiptNumber: sale.receiptNumber || 'N/A',
    saleId: sale.id,
    orderNumber: sale.order?.orderNumber,
    customerName:
      sale.customerName ||
      (customer.firstName
        ? `${customer.firstName} ${customer.lastName}`.trim()
        : 'Guest'),
    customerEmail: customer.email || 'N/A',
    customerPhone: customer.phoneNumber,
    customerAddress: customer.address,
    items,
    subtotal: sale.subtotal || 0,
    tax: sale.tax || 0,
    discount: sale.discount || 0,
    total: sale.total || 0,
    paidAmount: sale.paidAmount || 0,
    changeAmount: sale.changeAmount || 0,
    paymentMethod: normalizePaymentMethod(
      payment.paymentMethod || sale.paymentMethod || 'CASH'
    ),
    status: normalizeReceiptStatus(sale.status),
    notes: sale.notes,
    createdAt: sale.saleDate || sale.createdAt || new Date().toISOString(),
    sentAt: sale.receipt?.sentAt,
    printedAt: sale.receipt?.printedAt,
    printedBy: sale.user
      ? `${sale.user.firstName || ''} ${sale.user.lastName || ''}`.trim()
      : undefined,
    businessUnitId: sale.businessUnitId,
    businessUnitName: sale.businessUnit?.name,
    businessUnitAddress: sale.businessUnit?.address,
    businessUnitPhone: sale.businessUnit?.phone,
    businessUnitEmail: sale.businessUnit?.email,
    businessUnitTaxId: sale.businessUnit?.taxId,
    cashierName: sale.cashierName
      ? sale.cashierName
      : sale.user
      ? `${sale.user.firstName || ''} ${sale.user.lastName || ''}`.trim()
      : undefined,
    cashierId: sale.userId,
    terminalId: sale.cashRegister?.code || undefined,
    receiptType:
      sale.status === 'REFUNDED'
        ? 'refund'
        : sale.status === 'RETURNED'
        ? 'return'
        : 'sale',

    // Breakdown
    discountType: breakdown.discountType ?? null,
    promotionCode: breakdown.promotionCode ?? null,
    promotionDiscount: breakdown.promotionDiscount ?? 0,
    loyaltyPointsUsed: breakdown.loyaltyPointsUsed ?? 0,
    loyaltyDiscount: breakdown.loyaltyDiscount ?? 0,
  };
}

// ============================================
// STAT CARD COMPONENT
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
      {subtext && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {subtext}
        </p>
      )}
    </div>
  );
}

function PaymentMethodBadge({
  method,
  count,
  label,
}: {
  method: string;
  count: number;
  label?: string;
}) {
  const displayLabel = label || method.replace(/_/g, ' ').toUpperCase();
  const color = getPaymentMethodColor(method);

  return (
    <div className={`px-2 py-1 rounded-lg text-center ${color}`}>
      <p className="text-xs font-medium">{displayLabel}</p>
      <p className="text-sm font-bold tabular-nums">{count}</p>
    </div>
  );
}

// ============================================
// STYLE HELPERS
// ============================================

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    issued:
      'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
    sent: 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400',
    printed:
      'bg-brand-accent-100 dark:bg-brand-accent-900/30 text-brand-accent-700 dark:text-brand-accent-400',
    cancelled:
      'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
    void: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400',
  };
  return (
    colors[status] ||
    'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400'
  );
};

const getPaymentMethodColor = (method: string): string => {
  const colors: Record<string, string> = {
    CASH: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
    CREDIT_CARD:
      'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400',
    DEBIT_CARD:
      'bg-brand-accent-100 dark:bg-brand-accent-900/30 text-brand-accent-700 dark:text-brand-accent-400',
    MOBILE_MONEY:
      'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
    BANK_TRANSFER:
      'bg-secondary-100 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-400',
    GIFT_CARD:
      'bg-brand-accent-100 dark:bg-brand-accent-900/30 text-brand-accent-700 dark:text-brand-accent-400',
    LOYALTY_POINTS:
      'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
    CRYPTO: 'bg-secondary-100 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-400',
    CHECK: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400',
  };
  return (
    colors[method] ||
    'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400'
  );
};

const getReceiptTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    sale: 'Sale',
    refund: 'Refund',
    return: 'Return',
  };
  return labels[type] || type;
};

const getStatusIcon = (status: string) => {
  const icons: Record<string, React.ElementType> = {
    issued: CheckCircle,
    sent: Send,
    printed: Printer,
    cancelled: XCircle,
    void: XCircle,
  };
  return icons[status] || AlertCircle;
};

const StatusIcon = ({ status }: { status: string }) => {
  const Icon = getStatusIcon(status);
  return <Icon className="w-4 h-4 inline mr-1" />;
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function ReceiptsPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { user: authUser } = useAuth();
  const router = useRouter();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState<ReceiptStats>({
    total: 0,
    issued: 0,
    sent: 0,
    printed: 0,
    cancelled: 0,
    void: 0,
    totalAmount: 0,
    averageAmount: 0,
    byPaymentMethod: {
      CASH: 0,
      CREDIT_CARD: 0,
      DEBIT_CARD: 0,
      MOBILE_MONEY: 0,
      BANK_TRANSFER: 0,
      GIFT_CARD: 0,
      LOYALTY_POINTS: 0,
      CRYPTO: 0,
      CHECK: 0,
    },
  });

  const [filters, setFilters] = useState<ReceiptFilters>({
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
  const [totalReceipts, setTotalReceipts] = useState(0);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [exporting, setExporting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [copied, setCopied] = useState(false);

  // Permissions
  const userRole = (authUser?.role as string) || 'EMPLOYEE';
  const canManageReceipts = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(
    userRole
  );
  const canViewReceipts = [
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
    'EMPLOYEE',
    'CASHIER',
  ].includes(userRole);

  // Redirect if unauthorized
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/login?redirect=/admin/sales/receipts');
      return;
    }
    if (isLoaded && isSignedIn && !canViewReceipts) {
      router.push('/admin/sales');
      toast.error('You do not have permission to view receipts');
    }
  }, [isLoaded, isSignedIn, router, canViewReceipts]);

  // ============================================
  // FETCH (via saleService — talks to :3001 with Clerk auth)
  // ============================================

  const fetchReceipts = useCallback(
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

        // Map receipt status filter → sale status filter
        if (filters.status !== 'all') {
          switch (filters.status) {
            case 'issued':
            case 'sent':
            case 'printed':
              params.status = 'COMPLETED';
              break;
            case 'cancelled':
              params.status = 'CANCELLED';
              break;
            case 'void':
              params.status = 'VOID';
              break;
          }
        }

        // ✅ Parallel: page rows + server-side aggregates.
        const [response, aggregates] = await Promise.all([
          saleService.getAllSales(params),
          saleService
            .getSalesStats({
              startDate: params.startDate,
              endDate: params.endDate,
            })
            .catch((err) => {
              console.warn('Failed to fetch sales aggregates:', err);
              return null;
            }),
        ]);

        const rawSales: any[] = (response as any).data || [];
        const mapped: Receipt[] = rawSales.map(saleToReceipt);

        setReceipts(mapped);
        setTotalReceipts((response as any).total || mapped.length);
        setTotalPages((response as any).totalPages || 1);

        // Per-status counts stay page-level (backend aggregates don't
        // include them). Total amount and average come from the
        // server-side aggregate when available, otherwise fall back
        // to the page sum.
        const pageTotal = mapped.reduce(
          (sum: number, receipt: Receipt) => sum + (receipt.total || 0),
          0
        );
        const serverTotalRevenue = (aggregates as any)?.totalRevenue ?? null;
        const serverTotalSales = (aggregates as any)?.totalSales ?? null;

        const byPaymentMethod: Record<string, number> = {
          CASH: 0,
          CREDIT_CARD: 0,
          DEBIT_CARD: 0,
          MOBILE_MONEY: 0,
          BANK_TRANSFER: 0,
          GIFT_CARD: 0,
          LOYALTY_POINTS: 0,
          CRYPTO: 0,
          CHECK: 0,
        };
        mapped.forEach((r) => {
          if (byPaymentMethod[r.paymentMethod] !== undefined) {
            byPaymentMethod[r.paymentMethod] += 1;
          }
        });

        const computed: ReceiptStats = {
          total: (response as any).total || mapped.length,
          issued: mapped.filter((r) => r.status === 'issued').length,
          sent: mapped.filter((r) => r.status === 'sent').length,
          printed: mapped.filter((r) => r.status === 'printed').length,
          cancelled: mapped.filter((r) => r.status === 'cancelled').length,
          void: mapped.filter((r) => r.status === 'void').length,
          totalAmount: serverTotalRevenue ?? pageTotal,
          averageAmount:
            serverTotalSales && serverTotalRevenue
              ? serverTotalRevenue / serverTotalSales
              : mapped.length > 0
              ? pageTotal / mapped.length
              : 0,
          byPaymentMethod,
        };
        setStats(computed);
      } catch (error: any) {
        console.error('Error fetching receipts:', error);
        toast.error(error.message || 'Failed to load receipts');
        setReceipts([]);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [authUser, filters]
  );

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

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

  const handleSendEmail = async () => {
    if (!selectedReceipt) return;
    const target = (emailAddress || selectedReceipt.customerEmail || '').trim();
    if (!target) {
      toast.error('Please enter an email address');
      return;
    }

    try {
      setProcessing(true);
      await saleService.sendReceiptEmail(selectedReceipt.saleId, target);
      toast.success(`Receipt sent to ${target}`);
      setShowEmailModal(false);
      setEmailAddress('');
      fetchReceipts(true);
    } catch (error: any) {
      console.error('Failed to send receipt email:', error);
      toast.error(error.message || 'Failed to send receipt email');
    } finally {
      setProcessing(false);
    }
  };

  const handlePrintReceipt = async (receipt: Receipt) => {
    try {
      setProcessing(true);
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Please allow popups to print receipts');
        return;
      }
      const receiptHTML = generateReceiptHTML(receipt);
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      printWindow.print();
      toast.success('Receipt sent to printer');
    } catch (error: any) {
      console.error('Failed to print receipt:', error);
      toast.error(error.message || 'Failed to print receipt');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadPdf = async (receipt: Receipt) => {
    try {
      setDownloadingPdf(true);
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Please allow popups to prepare the PDF');
        return;
      }
      printWindow.document.write(generateReceiptHTML(receipt));
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 300);
      toast.success('Receipt ready to save as PDF');
    } catch (error: any) {
      console.error('Failed to prepare receipt PDF:', error);
      toast.error(error.message || 'Failed to prepare receipt PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  /**
   * Void a receipt.
   *
   * Uses `saleService.voidSale` — the backend method that
   * sets `Sale.status = 'VOID'` and **appends** the reason to the
   * existing notes instead of replacing them.
   *
   * If `voidSale` isn't available on the web service, we fall back to
   * `updateSale` with a merged notes string so we never clobber
   * pre-existing notes.
   */
  const handleVoidReceipt = async () => {
    if (!selectedReceipt || !voidReason.trim()) return;

    try {
      setProcessing(true);

      const svc = saleService as any;
      if (typeof svc.voidSale === 'function') {
        await svc.voidSale(selectedReceipt.saleId, voidReason.trim());
      } else {
        // Merge notes instead of replacing them.
        const existing = (selectedReceipt.notes || '').trim();
        const appended = existing
          ? `${existing}\nVoided: ${voidReason.trim()}`
          : `Voided: ${voidReason.trim()}`;
        await saleService.updateSale(selectedReceipt.saleId, {
          status: 'VOID',
          notes: appended,
        } as any);
      }

      toast.success('Receipt voided successfully');
      setShowVoidModal(false);
      setVoidReason('');
      fetchReceipts(true);
    } catch (error: any) {
      console.error('Failed to void receipt:', error);
      toast.error(error.message || 'Failed to void receipt');
    } finally {
      setProcessing(false);
    }
  };

  const handleCopyReceiptNumber = (receiptNumber: string) => {
    navigator.clipboard.writeText(receiptNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Receipt number copied');
  };

  /**
   * Export all receipts in the current date range.
   *
   * Uses the server-side export so the whole result set is included,
   * not just the current page.
   */
  const handleExport = async () => {
    try {
      setExporting(true);

      const startDate = filters.startDate || undefined;
      const endDate = filters.endDate || undefined;

      const result = await saleService.exportSales({
        startDate,
        endDate,
        format: 'csv',
      });

      const rowsData: any[] = (result as any)?.data || [];

      if (rowsData.length === 0) {
        toast.error('No receipts to export');
        return;
      }

      const headers = [
        'Receipt',
        'Date',
        'Customer',
        'Subtotal',
        'Tax',
        'Discount',
        'Discount Type',
        'Promotion Code',
        'Promotion Discount',
        'Loyalty Points Used',
        'Loyalty Discount',
        'Total',
        'Payment',
        'Status',
        'Items',
      ];
      const rows = rowsData.map((receipt: any) => {
        const breakdown = saleService.extractBreakdown(receipt);
        return [
          receipt.receiptNumber || receipt.id || '',
          receipt.date ||
            (receipt.saleDate
              ? new Date(receipt.saleDate).toISOString().split('T')[0]
              : ''),
          receipt.customer || 'Guest',
          (receipt.subtotal || 0).toFixed(2),
          (receipt.tax || 0).toFixed(2),
          (receipt.discount || 0).toFixed(2),
          breakdown.discountType ?? '',
          breakdown.promotionCode ?? '',
          (breakdown.promotionDiscount ?? 0).toFixed(2),
          String(breakdown.loyaltyPointsUsed ?? 0),
          (breakdown.loyaltyDiscount ?? 0).toFixed(2),
          (receipt.total || 0).toFixed(2),
          receipt.paymentMethod || 'N/A',
          receipt.status || 'COMPLETED',
          String(receipt.items || receipt.itemsCount || 0),
        ];
      });

      const csv = [
        headers.join(','),
        ...rows.map((row: (string | number)[]) => row.join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipts-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Receipts exported successfully');
    } catch (error: any) {
      console.error('Failed to export receipts:', error);
      toast.error(error.message || 'Failed to export receipts');
    } finally {
      setExporting(false);
    }
  };

  // ============================================
  // RECEIPT HTML (for print / PDF)
  // ============================================

  const generateReceiptHTML = (receipt: Receipt): string => {
    const promotionDiscount = receipt.promotionDiscount ?? 0;
    const promotionCode = receipt.promotionCode ?? null;
    const loyaltyPointsUsed = receipt.loyaltyPointsUsed ?? 0;
    const loyaltyDiscount = receipt.loyaltyDiscount ?? 0;

    const promotionLabel = receipt.discountType
      ? getDiscountTypeLabel(receipt.discountType) || 'Promotion'
      : 'Promotion';

    const promotionLine =
      promotionDiscount > 0
        ? `<div class="row discount-line"><span>${promotionLabel}${
            promotionCode ? ` (${promotionCode})` : ''
          }</span><span>-$${promotionDiscount.toFixed(2)}</span></div>`
        : '';

    const loyaltyLine =
      loyaltyPointsUsed > 0
        ? `<div class="row discount-line"><span>${loyaltyPointsUsed} loyalty points</span><span>-$${loyaltyDiscount.toFixed(2)}</span></div>`
        : '';

    const rawDiscountLine =
      receipt.discount > 0 && promotionDiscount === 0 && loyaltyDiscount === 0
        ? `<div class="row discount-line"><span>Discount</span><span>-$${receipt.discount.toFixed(2)}</span></div>`
        : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt #${receipt.receiptNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Courier New', monospace;
              padding: 20px;
              max-width: 300px;
              margin: 0 auto;
              background: white;
              color: black;
              font-size: 12px;
              line-height: 1.4;
            }
            .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 10px; margin-bottom: 10px; }
            .header h3 { font-size: 16px; margin-bottom: 4px; }
            .header .store-info { font-size: 11px; color: #666; }
            .divider { border-top: 1px dashed #ccc; margin: 8px 0; }
            .items { margin: 10px 0; }
            .item { display: flex; justify-content: space-between; padding: 2px 0; }
            .item .name { flex: 1; }
            .item .qty { margin: 0 8px; color: #666; }
            .item .price { font-weight: bold; white-space: nowrap; }
            .totals { border-top: 2px dashed #333; padding-top: 10px; margin-top: 10px; }
            .totals .row { display: flex; justify-content: space-between; padding: 2px 0; }
            .totals .grand-total { font-size: 16px; font-weight: bold; border-top: 1px solid #333; padding-top: 8px; margin-top: 4px; }
            .footer { text-align: center; border-top: 2px dashed #333; padding-top: 10px; margin-top: 10px; font-size: 11px; color: #666; }
            .footer .thankyou { font-size: 14px; font-weight: bold; color: #333; margin-bottom: 4px; }
            .payment-info { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #ccc; }
            .barcode { text-align: center; margin: 10px 0; font-size: 18px; letter-spacing: 2px; }
            .discount-line { color: #e74c3c; }
          </style>
        </head>
        <body>
          <div class="header">
            <h3>${receipt.businessUnitName || 'Store'}</h3>
            <div class="store-info">
              ${receipt.businessUnitAddress || ''}<br>
              ${receipt.businessUnitPhone || ''}<br>
              ${receipt.businessUnitEmail || ''}
            </div>
            <div class="divider"></div>
            <div><strong>RECEIPT #${receipt.receiptNumber}</strong></div>
            <div>${formatDateTime(receipt.createdAt)}</div>
            <div>Cashier: ${receipt.cashierName || 'N/A'}</div>
            ${
              receipt.customerName
                ? `<div>Customer: ${receipt.customerName}</div>`
                : ''
            }
            <div>Type: ${getReceiptTypeLabel(receipt.receiptType)}</div>
          </div>

          <div class="items">
            ${receipt.items
              .map(
                (item: ReceiptItem) => `
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
            <div class="row"><span>Subtotal</span><span>$${receipt.subtotal.toFixed(
              2
            )}</span></div>
            <div class="row"><span>Tax</span><span>$${receipt.tax.toFixed(
              2
            )}</span></div>
            ${promotionLine}
            ${loyaltyLine}
            ${rawDiscountLine}
            <div class="row grand-total">
              <span>TOTAL</span>
              <span>$${receipt.total.toFixed(2)}</span>
            </div>
            <div class="payment-info">
              <div class="row"><span>Paid</span><span>$${receipt.paidAmount.toFixed(
                2
              )}</span></div>
              <div class="row"><span>Change</span><span>$${receipt.changeAmount.toFixed(
                2
              )}</span></div>
              <div class="row"><span>Payment</span><span>${
                receipt.paymentMethod
              }</span></div>
            </div>
          </div>

          <div class="barcode">${'█'.repeat(30)}</div>

          <div class="footer">
            <div class="thankyou">Thank You!</div>
            <div>We appreciate your business</div>
            <div class="divider"></div>
            <div style="font-size:10px;color:#999;">
              Items: ${
                receipt.items.length
              } | ${new Date().toLocaleDateString()}
            </div>
            <div style="font-size:10px;color:#999;margin-top:4px;">
              ${receipt.receiptNumber}
            </div>
          </div>
        </body>
      </html>
    `;
  };

  // ============================================
  // LOADING / PERMISSION STATES
  // ============================================

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!authUser || !canViewReceipts) {
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
              >
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Receipts
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Manage customer receipts and transaction records
                  {totalReceipts > 0 && ` · ${totalReceipts} total receipts`}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => fetchReceipts(true)}
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
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50 focus-ring"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export All
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <StatCard title="Total" value={stats.total} color="brand" />
          <StatCard
            title="Issued"
            value={stats.issued}
            color="success"
            subtext="current page"
          />
          <StatCard
            title="Sent"
            value={stats.sent}
            color="brand"
            subtext="current page"
          />
          <StatCard
            title="Printed"
            value={stats.printed}
            color="brand-accent"
            subtext="current page"
          />
          <StatCard
            title="Cancelled"
            value={stats.cancelled}
            color="warning"
            subtext="current page"
          />
          <StatCard
            title="Void"
            value={stats.void}
            color="gray"
            subtext="current page"
          />
          <StatCard
            title="Total Amount"
            value={formatCurrency(stats.totalAmount)}
            color="brand"
          />
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="card-brand p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Average Receipt Amount
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              {formatCurrency(stats.averageAmount)}
            </p>
          </div>
          <div className="card-brand p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Payment Methods
              <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                (current page)
              </span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              <PaymentMethodBadge
                method="CASH"
                count={stats.byPaymentMethod.CASH}
              />
              <PaymentMethodBadge
                method="CREDIT_CARD"
                count={stats.byPaymentMethod.CREDIT_CARD}
                label="Credit"
              />
              <PaymentMethodBadge
                method="DEBIT_CARD"
                count={stats.byPaymentMethod.DEBIT_CARD}
                label="Debit"
              />
              <PaymentMethodBadge
                method="MOBILE_MONEY"
                count={stats.byPaymentMethod.MOBILE_MONEY}
                label="Mobile"
              />
              <PaymentMethodBadge
                method="BANK_TRANSFER"
                count={stats.byPaymentMethod.BANK_TRANSFER}
                label="Bank"
              />
              <PaymentMethodBadge
                method="GIFT_CARD"
                count={stats.byPaymentMethod.GIFT_CARD}
                label="Gift"
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
                placeholder="Search by receipt #, customer..."
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
              <option value="issued">Issued</option>
              <option value="sent">Sent</option>
              <option value="printed">Printed</option>
              <option value="cancelled">Cancelled</option>
              <option value="void">Void</option>
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
              onClick={() => fetchReceipts()}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors focus-ring"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {/* List */}
        {receipts.length === 0 ? (
          <div className="card-brand p-12 text-center">
            <div className="text-6xl mb-4">🧾</div>
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No Receipts Found
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              {filters.search || filters.status !== 'all'
                ? 'No receipts match your search criteria.'
                : 'No receipts have been generated yet.'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <AnimatePresence>
                {receipts.map((receipt: Receipt, index: number) => {
                  const hasBreakdown =
                    (receipt.promotionDiscount ?? 0) > 0 ||
                    (receipt.loyaltyPointsUsed ?? 0) > 0;

                  return (
                    <motion.div
                      key={receipt.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="card-brand p-0 overflow-hidden hover:shadow-card-hover transition-all"
                    >
                      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-success-600 dark:text-success-400 tabular-nums">
                            #{receipt.receiptNumber}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(receipt.createdAt)}
                          </span>
                          <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs">
                            {getReceiptTypeLabel(receipt.receiptType)}
                          </span>
                          {hasBreakdown && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 rounded-full text-xs">
                              <Sparkles className="w-3 h-3" />
                              Discounted
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              receipt.status
                            )} flex items-center gap-1`}
                          >
                            <StatusIcon status={receipt.status} />
                            {receipt.status.charAt(0).toUpperCase() +
                              receipt.status.slice(1)}
                          </span>
                          <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                            {formatCurrency(receipt.total)}
                          </span>
                        </div>
                      </div>

                      <div className="p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <User className="w-4 h-4" />
                                {receipt.customerName || 'Guest'}
                              </span>
                              <span className="flex items-center gap-1">
                                <MailIcon className="w-4 h-4" />
                                {receipt.customerEmail || 'N/A'}
                              </span>
                              <span className="flex items-center gap-1 tabular-nums">
                                <Package className="w-4 h-4" />
                                {receipt.items.length} items
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${getPaymentMethodColor(
                                  receipt.paymentMethod
                                )} flex items-center gap-1`}
                              >
                                {receipt.paymentMethod
                                  .replace(/_/g, ' ')
                                  .toUpperCase()}
                              </span>
                              {receipt.cashierName && (
                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs">
                                  Cashier: {receipt.cashierName}
                                </span>
                              )}
                              {receipt.terminalId && (
                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs">
                                  Terminal: {receipt.terminalId}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => {
                                setSelectedReceipt(receipt);
                                setShowDetailModal(true);
                              }}
                              className="px-3 py-1.5 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 focus-ring"
                            >
                              <Eye className="w-4 h-4" />
                              Details
                            </button>
                            <button
                              onClick={() => handlePrintReceipt(receipt)}
                              disabled={processing}
                              className="px-3 py-1.5 text-brand-accent-600 dark:text-brand-accent-400 hover:bg-brand-accent-50 dark:hover:bg-brand-accent-900/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-50 focus-ring"
                            >
                              <Printer className="w-4 h-4" />
                              Print
                            </button>
                            <button
                              onClick={() => handleDownloadPdf(receipt)}
                              disabled={downloadingPdf}
                              className="px-3 py-1.5 text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-50 focus-ring"
                            >
                              <FileText className="w-4 h-4" />
                              PDF
                            </button>
                            <button
                              onClick={() => {
                                setSelectedReceipt(receipt);
                                setEmailAddress(receipt.customerEmail || '');
                                setShowEmailModal(true);
                              }}
                              className="px-3 py-1.5 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 focus-ring"
                            >
                              <Mail className="w-4 h-4" />
                              Email
                            </button>
                            <button
                              onClick={() =>
                                handleCopyReceiptNumber(receipt.receiptNumber)
                              }
                              className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 focus-ring"
                              title="Copy receipt number"
                            >
                              {copied ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
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
                            ? 'bg-success-600 text-white'
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
        {showDetailModal && selectedReceipt && (
          <DetailModal
            receiptData={selectedReceipt}
            onClose={() => setShowDetailModal(false)}
            onPrint={() => handlePrintReceipt(selectedReceipt)}
            onEmail={() => {
              setShowDetailModal(false);
              setEmailAddress(selectedReceipt.customerEmail || '');
              setShowEmailModal(true);
            }}
            onDownloadPdf={() => handleDownloadPdf(selectedReceipt)}
            onVoid={() => {
              setShowDetailModal(false);
              setVoidReason('');
              setShowVoidModal(true);
            }}
            canManage={canManageReceipts}
            processing={processing}
            downloadingPdf={downloadingPdf}
          />
        )}
      </AnimatePresence>

      {/* Email Modal */}
      <AnimatePresence>
        {showEmailModal && selectedReceipt && (
          <EmailModal
            receiptData={selectedReceipt}
            emailAddress={emailAddress}
            setEmailAddress={setEmailAddress}
            onClose={() => {
              setShowEmailModal(false);
              setEmailAddress('');
            }}
            onConfirm={handleSendEmail}
            processing={processing}
          />
        )}
      </AnimatePresence>

      {/* Void Modal */}
      <AnimatePresence>
        {showVoidModal && selectedReceipt && (
          <VoidModal
            receiptData={selectedReceipt}
            onClose={() => setShowVoidModal(false)}
            onConfirm={handleVoidReceipt}
            reason={voidReason}
            setReason={setVoidReason}
            processing={processing}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// DETAIL MODAL
// ============================================

interface DetailModalProps {
  receiptData: Receipt;
  onClose: () => void;
  onPrint: () => void;
  onEmail: () => void;
  onDownloadPdf: () => void;
  onVoid: () => void;
  canManage: boolean;
  processing: boolean;
  downloadingPdf: boolean;
}

function DetailModal({
  receiptData,
  onClose,
  onPrint,
  onEmail,
  onDownloadPdf,
  onVoid,
  canManage,
  processing,
  downloadingPdf,
}: DetailModalProps) {
  const promotionDiscount = receiptData.promotionDiscount ?? 0;
  const promotionCode = receiptData.promotionCode ?? null;
  const loyaltyPointsUsed = receiptData.loyaltyPointsUsed ?? 0;
  const loyaltyDiscount = receiptData.loyaltyDiscount ?? 0;
  const hasBreakdown = promotionDiscount > 0 || loyaltyPointsUsed > 0;

  const promotionLabel = receiptData.discountType
    ? getDiscountTypeLabel(receiptData.discountType) || 'Promotion'
    : 'Promotion';

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
              Receipt #{receiptData.receiptNumber}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatDateTime(receiptData.createdAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
          >
            <XCircle className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Preview */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 max-w-sm mx-auto">
            <div className="text-center">
              <p className="font-bold text-gray-900 dark:text-white">
                {receiptData.businessUnitName || 'Store'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {receiptData.businessUnitAddress}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {receiptData.businessUnitPhone}
              </p>
              <div className="border-t border-dashed border-gray-300 dark:border-gray-600 my-2"></div>
              <p className="font-mono text-sm">#{receiptData.receiptNumber}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatDateTime(receiptData.createdAt)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Cashier: {receiptData.cashierName || 'N/A'}
              </p>
              <div className="border-t border-dashed border-gray-300 dark:border-gray-600 my-2"></div>
              <div className="space-y-1">
                {receiptData.items
                  .slice(0, 5)
                  .map((item: ReceiptItem) => (
                    <div
                      key={item.id}
                      className="flex justify-between text-sm"
                    >
                      <span>
                        {item.productName} × {item.quantity}
                      </span>
                      <span className="tabular-nums">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  ))}
                {receiptData.items.length > 5 && (
                  <p className="text-xs text-gray-400 tabular-nums">
                    + {receiptData.items.length - 5} more items
                  </p>
                )}
              </div>
              <div className="border-t border-dashed border-gray-300 dark:border-gray-600 my-2"></div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="tabular-nums">
                    {formatCurrency(receiptData.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax</span>
                  <span className="tabular-nums">
                    {formatCurrency(receiptData.tax)}
                  </span>
                </div>
                {promotionDiscount > 0 && (
                  <div className="flex justify-between text-sm text-success-600 dark:text-success-400">
                    <span>
                      {promotionLabel}
                      {promotionCode ? ` (${promotionCode})` : ''}
                    </span>
                    <span className="tabular-nums">
                      -{formatCurrency(promotionDiscount)}
                    </span>
                  </div>
                )}
                {loyaltyPointsUsed > 0 && (
                  <div className="flex justify-between text-sm text-success-600 dark:text-success-400">
                    <span className="tabular-nums">
                      {loyaltyPointsUsed} loyalty points
                    </span>
                    <span className="tabular-nums">
                      -{formatCurrency(loyaltyDiscount)}
                    </span>
                  </div>
                )}
                {receiptData.discount > 0 && !hasBreakdown && (
                  <div className="flex justify-between text-sm text-success-600 dark:text-success-400">
                    <span>Discount</span>
                    <span className="tabular-nums">
                      -{formatCurrency(receiptData.discount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {formatCurrency(receiptData.total)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Paid</span>
                  <span className="tabular-nums">
                    {formatCurrency(receiptData.paidAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Change</span>
                  <span className="tabular-nums">
                    {formatCurrency(receiptData.changeAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Payment</span>
                  <span>{receiptData.paymentMethod}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown summary */}
          {hasBreakdown && (
            <section
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-1.5"
              aria-label="Discount breakdown"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-brand-500" />
                Discount Breakdown
              </p>

              {promotionDiscount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Tag className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                    <span>{promotionLabel}</span>
                    {promotionCode && (
                      <code className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-[10px] font-mono tabular-nums">
                        {promotionCode}
                      </code>
                    )}
                  </span>
                  <span className="tabular-nums font-medium text-success-600 dark:text-success-400 shrink-0">
                    -{formatCurrency(promotionDiscount)}
                  </span>
                </div>
              )}

              {loyaltyPointsUsed > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Star className="w-3.5 h-3.5 text-warning-500 fill-current shrink-0" />
                    <span className="tabular-nums">
                      {loyaltyPointsUsed} loyalty points
                    </span>
                  </span>
                  <span className="tabular-nums font-medium text-success-600 dark:text-success-400 shrink-0">
                    -{formatCurrency(loyaltyDiscount)}
                  </span>
                </div>
              )}
            </section>
          )}

          {/* Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Customer
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {receiptData.customerName || 'Guest'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {receiptData.customerEmail || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Type</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {getReceiptTypeLabel(receiptData.receiptType)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Status
              </p>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                  receiptData.status
                )}`}
              >
                {receiptData.status.charAt(0).toUpperCase() +
                  receiptData.status.slice(1)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onPrint}
              disabled={processing}
              className="px-4 py-2 bg-brand-accent-600 text-white rounded-lg hover:bg-brand-accent-700 flex items-center gap-2 disabled:opacity-50 focus-ring"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={onEmail}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2 focus-ring"
            >
              <Mail className="w-4 h-4" />
              Email
            </button>
            <button
              onClick={onDownloadPdf}
              disabled={downloadingPdf}
              className="px-4 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-700 flex items-center gap-2 disabled:opacity-50 focus-ring"
            >
              {downloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {downloadingPdf ? 'Preparing...' : 'PDF'}
            </button>
            {canManage &&
              receiptData.status !== 'void' &&
              receiptData.status !== 'cancelled' && (
                <button
                  onClick={onVoid}
                  className="px-4 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-700 flex items-center gap-2 focus-ring"
                >
                  <XCircle className="w-4 h-4" />
                  Void
                </button>
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
// EMAIL MODAL
// ============================================

interface EmailModalProps {
  receiptData: Receipt;
  emailAddress: string;
  setEmailAddress: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  processing: boolean;
}

function EmailModal({
  receiptData,
  emailAddress,
  setEmailAddress,
  onClose,
  onConfirm,
  processing,
}: EmailModalProps) {
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
          Email Receipt
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Send receipt #{receiptData.receiptNumber} via email
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email Address <span className="text-danger-500">*</span>
          </label>
          <input
            type="email"
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Enter email address..."
            required
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={processing || !emailAddress.trim()}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2 disabled:opacity-50 focus-ring"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {processing ? 'Sending...' : 'Send Email'}
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
  receiptData: Receipt;
  onClose: () => void;
  onConfirm: () => void;
  reason: string;
  setReason: (value: string) => void;
  processing: boolean;
}

function VoidModal({
  receiptData,
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
          Void Receipt
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to void receipt #{receiptData.receiptNumber}?
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
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={processing || !reason.trim()}
            className="px-4 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-700 flex items-center gap-2 disabled:opacity-50 focus-ring"
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
