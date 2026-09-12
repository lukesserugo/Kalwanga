// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\sales\receipts\page.tsx

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
  Filter,
  Mail,
  Send,
  FileSpreadsheet,
  Receipt as ReceiptIcon,
  CreditCard,
  Banknote,
  Wallet,
  Smartphone,
  Gift,
  Building,
  User,
  Phone,
  Mail as MailIcon,
  Copy,
  Check,
  Share2,
} from 'lucide-react';
import { saleService } from '../../../../../services/saleService';
import { formatCurrency, formatDate, formatDateTime } from '../../../../../utils/formatters';
import { useAuth } from '../../../../../hooks/useAuth';
import { toast } from '../../../../../utils/toast-manager';
import { FilePdf } from '../../../../../components/icons/FilePdf';

// ============================================
// INTERFACES
// ============================================

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
  paymentMethod:
    | 'CASH'
    | 'CREDIT_CARD'
    | 'DEBIT_CARD'
    | 'MOBILE_MONEY'
    | 'BANK_TRANSFER'
    | 'GIFT_CARD';
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
  byPaymentMethod: {
    CASH: number;
    CREDIT_CARD: number;
    DEBIT_CARD: number;
    MOBILE_MONEY: number;
    BANK_TRANSFER: number;
    GIFT_CARD: number;
  };
}

// ============================================
// HELPERS — map a Sale from the backend to a Receipt
// ============================================

/** Map backend payment method to a receipt payment method. */
function normalizePaymentMethod(raw: string): Receipt['paymentMethod'] {
  const value = (raw || 'CASH').toUpperCase();
  if (
    value === 'CASH' ||
    value === 'CREDIT_CARD' ||
    value === 'DEBIT_CARD' ||
    value === 'MOBILE_MONEY' ||
    value === 'BANK_TRANSFER' ||
    value === 'GIFT_CARD'
  ) {
    return value as Receipt['paymentMethod'];
  }
  return 'CASH';
}

/** Map backend sale status to a receipt status. */
function normalizeReceiptStatus(raw: string): Receipt['status'] {
  const value = (raw || 'COMPLETED').toUpperCase();
  switch (value) {
    case 'COMPLETED':
      return 'issued';
    case 'PROCESSING':
    case 'PENDING':
      return 'issued';
    case 'CANCELLED':
      return 'cancelled';
    case 'VOIDED':
    case 'VOID':
      return 'void';
    case 'REFUNDED':
    case 'RETURNED':
      return 'void';
    default:
      return 'issued';
  }
}

/** Map a raw sale object (from saleService) → Receipt shape used by this page. */
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
  };
}

// ============================================
// STAT CARD COMPONENT
// ============================================

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number | string;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'text-blue-600 dark:text-blue-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
    gray: 'text-gray-600 dark:text-gray-400',
    purple: 'text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <p
        className={`text-xl font-bold ${
          colors[color] || 'text-gray-900 dark:text-white'
        }`}
      >
        {value}
      </p>
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
  const displayLabel = label || method.replace('_', ' ').toUpperCase();
  const color = getPaymentMethodColor(method);

  return (
    <div className={`px-2 py-1 rounded-lg text-center ${color}`}>
      <p className="text-xs font-medium">{displayLabel}</p>
      <p className="text-sm font-bold">{count}</p>
    </div>
  );
}

// ============================================
// STYLE HELPERS
// ============================================

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    issued:
      'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    sent: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    printed:
      'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    cancelled:
      'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    void: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400',
  };
  return (
    colors[status] ||
    'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400'
  );
};

const getPaymentMethodColor = (method: string): string => {
  const colors: Record<string, string> = {
    CASH: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    CREDIT_CARD:
      'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    DEBIT_CARD:
      'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    MOBILE_MONEY:
      'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
    BANK_TRANSFER:
      'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
    GIFT_CARD:
      'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
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
  const icons: Record<string, any> = {
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
              params.status = 'COMPLETED';
              break;
            case 'sent':
              params.status = 'COMPLETED';
              break;
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

        const response = await saleService.getAllSales(params);

        const rawSales: any[] = (response as any).data || [];
        const mapped: Receipt[] = rawSales.map(saleToReceipt);

        setReceipts(mapped);
        setTotalReceipts((response as any).total || mapped.length);
        setTotalPages((response as any).totalPages || 1);

        // ✅ FIXED: Explicitly typed reduce parameters
        const totalAmount = mapped.reduce(
          (sum: number, receipt: Receipt) => sum + (receipt.total || 0),
          0
        );

        const computed: ReceiptStats = {
          total: (response as any).total || mapped.length,
          issued: mapped.filter((receipt: Receipt) => receipt.status === 'issued')
            .length,
          sent: mapped.filter((receipt: Receipt) => receipt.status === 'sent')
            .length,
          printed: mapped.filter((receipt: Receipt) => receipt.status === 'printed')
            .length,
          cancelled: mapped.filter(
            (receipt: Receipt) => receipt.status === 'cancelled'
          ).length,
          void: mapped.filter((receipt: Receipt) => receipt.status === 'void')
            .length,
          totalAmount,
          averageAmount: mapped.length > 0 ? totalAmount / mapped.length : 0,
          byPaymentMethod: {
            CASH: mapped.filter(
              (receipt: Receipt) => receipt.paymentMethod === 'CASH'
            ).length,
            CREDIT_CARD: mapped.filter(
              (receipt: Receipt) => receipt.paymentMethod === 'CREDIT_CARD'
            ).length,
            DEBIT_CARD: mapped.filter(
              (receipt: Receipt) => receipt.paymentMethod === 'DEBIT_CARD'
            ).length,
            MOBILE_MONEY: mapped.filter(
              (receipt: Receipt) => receipt.paymentMethod === 'MOBILE_MONEY'
            ).length,
            BANK_TRANSFER: mapped.filter(
              (receipt: Receipt) => receipt.paymentMethod === 'BANK_TRANSFER'
            ).length,
            GIFT_CARD: mapped.filter(
              (receipt: Receipt) => receipt.paymentMethod === 'GIFT_CARD'
            ).length,
          },
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

    try {
      setProcessing(true);
      const res = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
        }/sales/${selectedReceipt.saleId}/email-receipt`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailAddress || selectedReceipt.customerEmail,
          }),
        }
      );
      if (!res.ok) throw new Error('Failed to send receipt email');
      toast.success(
        `Receipt sent to ${emailAddress || selectedReceipt.customerEmail}`
      );
      setShowEmailModal(false);
      setEmailAddress('');
      fetchReceipts(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send receipt email');
    } finally {
      setProcessing(false);
    }
  };

  const handlePrintReceipt = async (receipt: Receipt) => {
    try {
      setProcessing(true);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        const receiptHTML = generateReceiptHTML(receipt);
        printWindow.document.write(receiptHTML);
        printWindow.document.close();
        printWindow.print();
      }
      toast.success('Receipt sent to printer');
    } catch (error: any) {
      toast.error(error.message || 'Failed to print receipt');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadPdf = async (receipt: Receipt) => {
    try {
      setDownloadingPdf(true);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(generateReceiptHTML(receipt));
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 300);
      }
      toast.success('Receipt ready to save as PDF');
    } catch (error: any) {
      toast.error(error.message || 'Failed to prepare receipt PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  /**
   * ✅ FIXED: Use status 'VOID' (not 'VOIDED') to match the SaleStatus type.
   * The backend controller maps this correctly.
   */
  const handleVoidReceipt = async () => {
    if (!selectedReceipt || !voidReason.trim()) return;

    try {
      setProcessing(true);
      await saleService.updateSale(selectedReceipt.saleId, {
        status: 'VOID' as any,
        notes: voidReason,
      } as any);
      toast.success('Receipt voided successfully');
      setShowVoidModal(false);
      setVoidReason('');
      fetchReceipts(true);
    } catch (error: any) {
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

  const handleExport = async () => {
    try {
      setExporting(true);

      // ✅ FIXED: Explicitly typed map parameters
      const headers = [
        'Receipt',
        'Date',
        'Customer',
        'Subtotal',
        'Tax',
        'Discount',
        'Total',
        'Payment',
        'Status',
        'Items',
      ];
      const rows = receipts.map((receipt: Receipt) => [
        receipt.receiptNumber,
        new Date(receipt.createdAt).toISOString().split('T')[0],
        receipt.customerName,
        receipt.subtotal.toFixed(2),
        receipt.tax.toFixed(2),
        receipt.discount.toFixed(2),
        receipt.total.toFixed(2),
        receipt.paymentMethod,
        receipt.status,
        receipt.items.length,
      ]);
      const csv = [
        headers.join(','),
        ...rows.map((row: (string | number)[]) => row.join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipts-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success('Receipts exported successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to export receipts');
    } finally {
      setExporting(false);
    }
  };

  // ============================================
  // RECEIPT HTML (for print / PDF)
  // ============================================

  const generateReceiptHTML = (receipt: Receipt): string => {
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
            ${
              receipt.discount > 0
                ? `<div class="row" style="color:#e74c3c;"><span>Discount</span><span>-$${receipt.discount.toFixed(
                    2
                  )}</span></div>`
                : ''
            }
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
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <StatCard title="Total" value={stats.total} color="blue" />
          <StatCard title="Issued" value={stats.issued} color="green" />
          <StatCard title="Sent" value={stats.sent} color="blue" />
          <StatCard title="Printed" value={stats.printed} color="purple" />
          <StatCard title="Cancelled" value={stats.cancelled} color="yellow" />
          <StatCard title="Void" value={stats.void} color="gray" />
          <StatCard
            title="Total Amount"
            value={formatCurrency(stats.totalAmount)}
            color="blue"
          />
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Average Receipt Amount
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(stats.averageAmount)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Payment Methods
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
              <PaymentMethodBadge                method="GIFT_CARD"
                count={stats.byPaymentMethod.GIFT_CARD}
                label="Gift"
              />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by receipt #, customer..."
                value={filters.search}
                onChange={handleSearch}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <select
              value={filters.status}
              onChange={handleStatusChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleDateChange('endDate', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              onClick={() => fetchReceipts()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {/* List */}
        {receipts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center border border-gray-200 dark:border-gray-700">
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
                {receipts.map((receipt: Receipt, index: number) => (
                  <motion.div
                    key={receipt.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all overflow-hidden border border-gray-200 dark:border-gray-700"
                  >
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-green-600 dark:text-green-400">
                          #{receipt.receiptNumber}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(receipt.createdAt)}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs">
                          {getReceiptTypeLabel(receipt.receiptType)}
                        </span>
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
                        <span className="font-bold text-gray-900 dark:text-white">
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
                            <span className="flex items-center gap-1">
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
                                .replace('_', ' ')
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
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedReceipt(receipt);
                              setShowDetailModal(true);
                            }}
                            className="px-3 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            Details
                          </button>
                          <button
                            onClick={() => handlePrintReceipt(receipt)}
                            disabled={processing}
                            className="px-3 py-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            <Printer className="w-4 h-4" />
                            Print
                          </button>
                          <button
                            onClick={() => handleDownloadPdf(receipt)}
                            disabled={downloadingPdf}
                            className="px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            <FilePdf className="w-4 h-4" />
                            PDF
                          </button>
                          <button
                            onClick={() => {
                              setSelectedReceipt(receipt);
                              setEmailAddress(receipt.customerEmail || '');
                              setShowEmailModal(true);
                            }}
                            className="px-3 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                          >
                            <Mail className="w-4 h-4" />
                            Email
                          </button>
                          <button
                            onClick={() =>
                              handleCopyReceiptNumber(receipt.receiptNumber)
                            }
                            className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
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
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-300"
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
                        className={`w-9 h-9 rounded-lg text-sm transition-colors ${
                          filters.page === pageNum
                            ? 'bg-green-600 text-white'
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
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-300"
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
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Receipt #{receiptData.receiptNumber}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatDateTime(receiptData.createdAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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
                      <span>{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                {receiptData.items.length > 5 && (
                  <p className="text-xs text-gray-400">
                    + {receiptData.items.length - 5} more items
                  </p>
                )}
              </div>
              <div className="border-t border-dashed border-gray-300 dark:border-gray-600 my-2"></div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(receiptData.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax</span>
                  <span>{formatCurrency(receiptData.tax)}</span>
                </div>
                {receiptData.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(receiptData.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(receiptData.total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Paid</span>
                  <span>{formatCurrency(receiptData.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Change</span>
                  <span>{formatCurrency(receiptData.changeAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Payment</span>
                  <span>{receiptData.paymentMethod}</span>
                </div>
              </div>
            </div>
          </div>

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
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={onEmail}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              Email
            </button>
            <button
              onClick={onDownloadPdf}
              disabled={downloadingPdf}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
            >
              {downloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FilePdf className="w-4 h-4" />
              )}
              {downloadingPdf ? 'Preparing...' : 'PDF'}
            </button>
            {canManage &&
              receiptData.status !== 'void' &&
              receiptData.status !== 'cancelled' && (
                <button
                  onClick={onVoid}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Void
                </button>
              )}
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
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
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
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
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Enter email address..."
            required
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={processing || !emailAddress.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
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
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
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
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Reason for Voiding <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Enter reason for voiding..."
            required
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={processing || !reason.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
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
