// src/components/sales/SaleDetail.tsx

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Printer,
  Download,
  RefreshCw,
  DollarSign,
  User,
  Calendar,
  CreditCard,
  Package,
  ShoppingBag,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Phone,
  Mail,
  TrendingDown,
  History,
  Send,
  Award,
  Tag,
  Star,
  Sparkles,
} from 'lucide-react';
import { saleService, DISCOUNT_TYPE_LABELS } from '../../services/saleService';
import type { DiscountType } from '../../services/saleService';
import { toast } from '../../utils/toast-manager';
import { formatCurrency, formatDate } from '../../utils/formatters';

// ============================================
// TYPES
// ============================================

interface SaleItem {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    sku: string;
    unitPrice: number;
    images?: string[];
    barcode?: string;
    category?: { id: string; name: string };
  };
  variantId?: string;
  variant?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    attributes: any;
  };
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  notes?: string;
}

interface SalePayment {
  id: string;
  paymentMethod: string;
  amount: number;
  status: string;
  reference?: string;
  processedAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface SaleReturn {
  id: string;
  returnNumber: string;
  total: number;
  status: string;
  createdAt: string;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    total: number;
    reason?: string;
    product: { name: string; sku: string };
  }>;
}

interface SaleRefund {
  id: string;
  refundNumber: string;
  total: number;
  status: string;
  createdAt: string;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    total: number;
    reason?: string;
    product: { name: string; sku: string };
  }>;
}

interface SaleData {
  id: string;
  receiptNumber: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  notes?: string;
  status: string;
  saleDate: string;
  createdAt: string;
  updatedAt: string;

  // ── Promotion / loyalty breakdown ────────────────────────────
  // Persisted on the backend for every create path. All optional so
  // this shape stays compatible with sales created before the
  // migration added the columns.
  discountType?: DiscountType | string | null;
  promotionCode?: string | null;
  promotionDiscount?: number;
  loyaltyPointsUsed?: number;
  loyaltyDiscount?: number;

  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    loyaltyLevel: string;
    loyaltyPoints: number;
    totalSpent: number;
  };
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  businessUnit: {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  items: SaleItem[];
  payments: SalePayment[];
  returns?: SaleReturn[];
  refunds?: SaleRefund[];
  invoice?: {
    id: string;
    invoiceNumber: string;
    status: string;
    total: number;
    balanceDue: number;
    dueDate?: string;
  };
  receipt?: {
    id: string;
    receiptNumber: string;
    status: string;
    format: string;
    sentAt?: string;
    printedAt?: string;
  };
  cashRegister?: {
    id: string;
    name: string;
  };
  cashRegisterSession?: {
    id: string;
    openedAt: string;
    closedAt?: string;
    status: string;
  };
}

// ============================================
// STATIC MAPS — Tailwind can't see dynamic classes
// ============================================

const STATUS_MAP: Record<
  string,
  { label: string; className: string; icon: React.ElementType }
> = {
  COMPLETED: {
    label: 'Completed',
    className:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    icon: CheckCircle,
  },
  PENDING: {
    label: 'Pending',
    className:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    icon: Clock,
  },
  PROCESSING: {
    label: 'Processing',
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    icon: Loader2,
  },
  CANCELLED: {
    label: 'Cancelled',
    className:
      'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    icon: XCircle,
  },
  REFUNDED: {
    label: 'Refunded',
    className:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    icon: XCircle,
  },
  ON_HOLD: {
    label: 'On Hold',
    className:
      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    icon: Clock,
  },
  VOID: {
    label: 'Void',
    className:
      'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    icon: XCircle,
  },
  RETURNED: {
    label: 'Returned',
    className:
      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    icon: TrendingDown,
  },
};

const STAT_CARD_COLORS: Record<string, string> = {
  blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  green:
    'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
  yellow:
    'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
  red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  purple:
    'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  orange:
    'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
  teal: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400',
  gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
};

const RETURN_STATUS_STYLES: Record<string, string> = {
  APPROVED:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  PENDING:
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
};
const DEFAULT_RETURN_STATUS_STYLE =
  'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

// ============================================
// SUB-COMPONENTS
// ============================================

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config = STATUS_MAP[status] ?? STATUS_MAP.PENDING;
  const Icon = config.icon;
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${config.className}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtext?: string;
}> = ({ label, value, icon: Icon, color, subtext }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <div
          className={`p-1.5 rounded-lg ${
            STAT_CARD_COLORS[color] || STAT_CARD_COLORS.blue
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
        {value}
      </p>
      {subtext && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {subtext}
        </p>
      )}
    </div>
  );
};

/**
 * Promotion / loyalty breakdown panel.
 *
 * Reads the five breakdown fields off the sale via
 * `saleService.extractBreakdown`, and returns `null` when the sale
 * has none — so it's safe to render unconditionally.
 */
const SaleBreakdownPanel: React.FC<{
  sale: SaleData;
  currencySymbol?: string;
}> = ({ sale, currencySymbol = '$' }) => {
  if (!saleService.hasBreakdown(sale)) return null;

  const breakdown = saleService.extractBreakdown(sale);

  const promotionLabel = breakdown.discountType
    ? DISCOUNT_TYPE_LABELS[breakdown.discountType as DiscountType] ??
      String(breakdown.discountType)
    : 'Discount';

  const hasPromotion = (breakdown.promotionDiscount ?? 0) > 0;
  const hasLoyalty = (breakdown.loyaltyPointsUsed ?? 0) > 0;

  return (
    <section
      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-2 mb-6"
      aria-label="Discount breakdown"
    >
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-500" />
        Discount breakdown
      </h3>

      {hasPromotion && (
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400 flex-wrap">
            <Tag className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>{promotionLabel}</span>
            {breakdown.promotionCode && (
              <code className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-[11px] font-mono tabular-nums">
                {breakdown.promotionCode}
              </code>
            )}
          </span>
          <span className="tabular-nums font-medium text-green-600 dark:text-green-400 shrink-0">
            -{currencySymbol}
            {(breakdown.promotionDiscount ?? 0).toFixed(2)}
          </span>
        </div>
      )}

      {hasLoyalty && (
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Star className="w-3.5 h-3.5 text-yellow-500 fill-current shrink-0" />
            <span className="tabular-nums">
              {breakdown.loyaltyPointsUsed} loyalty points
            </span>
          </span>
          <span className="tabular-nums font-medium text-green-600 dark:text-green-400 shrink-0">
            -{currencySymbol}
            {(breakdown.loyaltyDiscount ?? 0).toFixed(2)}
          </span>
        </div>
      )}
    </section>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export function SaleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

  const [sale, setSale] = useState<SaleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [email, setEmail] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ============================================
  // LOAD
  // ============================================

  const loadSale = useCallback(
    async (showLoading = true) => {
      if (!id) return;
      try {
        if (showLoading) setLoading(true);
        else setRefreshing(true);

        const data = await saleService.getSaleById(id);
        setSale(data);
      } catch (error) {
        console.error('Failed to load sale:', error);
        toast.error('Failed to load sale details');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    loadSale(true);
  }, [loadSale]);

  const handleRefresh = useCallback(async () => {
    await loadSale(false);
    toast.success('Sale refreshed');
  }, [loadSale]);

  // ============================================
  // PRINT
  // ============================================

  const handlePrint = useCallback(() => {
    if (!sale) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print receipts');
      return;
    }

    // Build the breakdown snippet once so the template stays readable.
    const breakdown = saleService.extractBreakdown(sale);
    const promotionDiscount = breakdown.promotionDiscount ?? 0;
    const promotionCode = breakdown.promotionCode ?? null;
    const loyaltyPointsUsed = breakdown.loyaltyPointsUsed ?? 0;
    const loyaltyDiscount = breakdown.loyaltyDiscount ?? 0;

    const promotionLine =
      promotionDiscount > 0
        ? `
          <div class="total-row"><span>Promotion${
            promotionCode ? ` (${promotionCode})` : ''
          }</span><span>-$${promotionDiscount.toFixed(2)}</span></div>
        `
        : '';

    const loyaltyLine =
      loyaltyPointsUsed > 0
        ? `
          <div class="total-row"><span>${loyaltyPointsUsed} loyalty points</span><span>-$${loyaltyDiscount.toFixed(2)}</span></div>
        `
        : '';

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt #${sale.receiptNumber}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; max-width: 300px; margin: 0 auto; background: white; }
            .header { text-align: center; border-bottom: 1px dashed #ccc; padding-bottom: 10px; }
            .header h3 { margin: 0; font-size: 16px; }
            .header p { margin: 2px 0; font-size: 12px; color: #666; }
            .items { margin: 15px 0; }
            .item { display: flex; justify-content: space-between; padding: 2px 0; font-size: 13px; }
            .item .name { flex: 1; }
            .item .qty { margin: 0 10px; color: #666; }
            .item .price { font-weight: bold; }
            .total { border-top: 1px solid #ccc; padding-top: 10px; margin-top: 10px; }
            .total-row { display: flex; justify-content: space-between; font-size: 13px; padding: 2px 0; }
            .total-row.grand { font-weight: bold; font-size: 16px; border-top: 1px solid #ccc; padding-top: 5px; margin-top: 5px; }
            .payment { border-top: 1px solid #ccc; padding-top: 10px; margin-top: 10px; }
            .payment p { margin: 2px 0; font-size: 12px; }
            .footer { text-align: center; border-top: 1px dashed #ccc; padding-top: 10px; margin-top: 10px; }
            .footer p { margin: 2px 0; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h3>${sale.businessUnit?.name || 'Store'}</h3>
            <p>${sale.businessUnit?.address || ''}</p>
            <p>${sale.businessUnit?.phone || ''}</p>
            <p style="margin-top: 5px;"><strong>Receipt #${sale.receiptNumber}</strong></p>
            <p>${new Date(sale.saleDate).toLocaleString()}</p>
            <p>Cashier: ${sale.user?.firstName || ''} ${sale.user?.lastName || ''}</p>
          </div>
          <div class="items">
            ${sale.items
              .map(
                (item) => `
              <div class="item">
                <span class="name">${item.product.name}</span>
                <span class="qty">x${item.quantity}</span>
                <span class="price">$${item.total.toFixed(2)}</span>
              </div>
            `
              )
              .join('')}
          </div>
          <div class="total">
            <div class="total-row"><span>Subtotal</span><span>$${sale.subtotal.toFixed(2)}</span></div>
            <div class="total-row"><span>Tax</span><span>$${sale.tax.toFixed(2)}</span></div>
            ${promotionLine}
            ${loyaltyLine}
            ${
              sale.discount > 0 && promotionDiscount === 0 && loyaltyDiscount === 0
                ? `<div class="total-row"><span>Discount</span><span>-$${sale.discount.toFixed(2)}</span></div>`
                : ''
            }
            <div class="total-row grand"><span>Total</span><span>$${sale.total.toFixed(2)}</span></div>
          </div>
          <div class="payment">
            <p><strong>Payment</strong></p>
            ${sale.payments
              .map(
                (p) => `<p>${p.paymentMethod}: $${p.amount.toFixed(2)}</p>`
              )
              .join('')}
            ${
              sale.changeAmount > 0
                ? `<p>Change: $${sale.changeAmount.toFixed(2)}</p>`
                : ''
            }
          </div>
          ${
            sale.customer
              ? `
            <div class="payment">
              <p><strong>Customer</strong></p>
              <p>${sale.customer.firstName} ${sale.customer.lastName}</p>
              <p>${sale.customer.email || ''}</p>
            </div>
          `
              : ''
          }
          <div class="footer">
            <p>Thank you for your business!</p>
            <p>${sale.businessUnit?.name || ''}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }, [sale]);

  // ============================================
  // DOWNLOAD / EMAIL
  // ============================================

  const handleDownloadReceipt = useCallback(async () => {
    if (!id) return;
    try {
      const blob = await saleService.printReceipt(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${sale?.receiptNumber || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Receipt downloaded');
    } catch (error) {
      console.error('Failed to download receipt:', error);
      toast.error('Failed to download receipt');
    }
  }, [id, sale?.receiptNumber]);

  const handleSendEmail = useCallback(async () => {
    if (!id) return;
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error('Please enter an email address');
      return;
    }

    setSubmitting(true);
    try {
      await saleService.sendReceiptEmail(id, trimmed);
      toast.success(`Receipt sent to ${trimmed}`);
      setShowEmailModal(false);
      setEmail('');
      await loadSale(false);
    } catch (error) {
      console.error('Failed to send receipt:', error);
      toast.error('Failed to send receipt');
    } finally {
      setSubmitting(false);
    }
  }, [id, email, loadSale]);

  // ============================================
  // REFUND
  // ============================================

  const handleRefund = useCallback(
    async (reason: string, amount?: number) => {
      if (!id) return;
      const trimmed = reason.trim();
      if (!trimmed) {
        toast.error('Please enter a reason for the refund');
        return;
      }
      setSubmitting(true);
      try {
        await saleService.refundSale(id, trimmed, amount);
        toast.success('Sale refunded successfully');
        setShowRefundModal(false);
        setRefundReason('');
        await loadSale(false);
      } catch (error) {
        console.error('Failed to refund sale:', error);
        toast.error('Failed to refund sale');
      } finally {
        setSubmitting(false);
      }
    },
    [id, loadSale]
  );

  // ============================================
  // DERIVED
  // ============================================

  const customerName = useMemo(() => {
    if (!sale?.customer) return 'Guest';
    return `${sale.customer.firstName} ${sale.customer.lastName}`.trim();
  }, [sale?.customer]);

  const customerEmail = sale?.customer?.email || 'N/A';
  const customerPhone = sale?.customer?.phoneNumber || 'N/A';

  /**
   * A small summary of the applied discount, ready to render in the
   * StatCard subtext.
   */
  const discountSummary = useMemo(() => {
    if (!sale) return { hasAny: false, describe: '' };
    const hasAny = saleService.hasBreakdown(sale);
    const describe = hasAny ? saleService.describeBreakdown(sale) : '';
    return { hasAny, describe };
  }, [sale]);

  // ============================================
  // MODAL OPENERS (open with sensible defaults)
  // ============================================

  const openEmailModal = useCallback(() => {
    setEmail(sale?.customer?.email || '');
    setShowEmailModal(true);
  }, [sale?.customer?.email]);

  const openRefundModal = useCallback(() => {
    setRefundReason('');
    setShowRefundModal(true);
  }, []);

  // ============================================
  // EARLY RETURNS
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            Loading sale details...
          </p>
        </div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="p-6 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          Sale not found
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          The sale you're looking for doesn't exist.
        </p>
        <button
          onClick={() => navigate('/sales')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to Sales
        </button>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => navigate('/sales')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                Sale #{sale.receiptNumber}
              </h1>
              <StatusBadge status={sale.status} />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(sale.saleDate)}
              </span>
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {customerName}
              </span>
              <span className="flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5" />
                {sale.payments?.[0]?.paymentMethod || 'N/A'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            onClick={handlePrint}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Print"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={handleDownloadReceipt}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Download PDF"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={openEmailModal}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Email receipt"
          >
            <Send className="w-4 h-4" />
          </button>
          {(sale.status === 'COMPLETED' || sale.status === 'PENDING') && (
            <button
              onClick={openRefundModal}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors text-sm"
            >
              <TrendingDown className="w-4 h-4" />
              Refund
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          label="Total"
          value={formatCurrency(sale.total)}
          icon={DollarSign}
          color="green"
          subtext={`Paid: ${formatCurrency(sale.paidAmount)}`}
        />
        <StatCard
          label="Subtotal"
          value={formatCurrency(sale.subtotal)}
          icon={ShoppingBag}
          color="blue"
          subtext={`${sale.items.length} items`}
        />
        <StatCard
          label="Tax"
          value={formatCurrency(sale.tax)}
          icon={FileText}
          color="purple"
          subtext={sale.tax > 0 ? 'Included' : 'No tax'}
        />
        <StatCard
          label="Discount"
          value={
            sale.discount > 0 ? `-${formatCurrency(sale.discount)}` : 'None'
          }
          icon={TrendingDown}
          color={sale.discount > 0 ? 'green' : 'gray'}
          subtext={
            discountSummary.hasAny
              ? discountSummary.describe
              : sale.discount > 0
              ? 'Applied'
              : 'No discount'
          }
        />
        <StatCard
          label="Change"
          value={formatCurrency(sale.changeAmount)}
          icon={CreditCard}
          color="orange"
          subtext={
            sale.changeAmount > 0 ? 'Returned to customer' : 'Exact amount'
          }
        />
      </div>

      {/* Customer & Payment Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500" />
            Customer Information
          </h3>
          <div className="space-y-2">
            <p className="text-gray-900 dark:text-white font-medium">
              {customerName}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" />
              {customerEmail}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <Phone className="w-3.5 h-3.5" />
              {customerPhone}
            </p>
            {sale.customer?.loyaltyLevel && (
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Award className="w-3.5 h-3.5 text-yellow-500" />
                {sale.customer.loyaltyLevel} •{' '}
                {sale.customer.loyaltyPoints || 0} points
              </p>
            )}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-green-500" />
            Payment Information
          </h3>
          <div className="space-y-2">
            {sale.payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between"
              >
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {payment.paymentMethod}
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(payment.amount)}
                </span>
              </div>
            ))}
            {sale.changeAmount > 0 && (
              <div className="flex items-center justify-between border-t dark:border-gray-700 pt-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Change
                </span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {formatCurrency(sale.changeAmount)}
                </span>
              </div>
            )}
            {sale.cashRegister && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Register: {sale.cashRegister.name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-500" />
            Items ({sale.items.length})
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Total:{' '}
            {sale.items.reduce((sum, item) => sum + item.quantity, 0)} units
          </span>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[400px] overflow-y-auto">
          {sale.items.map((item) => (
            <div
              key={item.id}
              className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                  {item.product.images?.[0] ? (
                    <img
                      src={item.product.images[0]}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {item.product.name}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <span>SKU: {item.product.sku}</span>
                    {item.variant && (
                      <span>Variant: {item.variant.name}</span>
                    )}
                    <span>×{item.quantity}</span>
                    <span>@ {formatCurrency(item.unitPrice)}</span>
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-gray-900 dark:text-white">
                  {formatCurrency(item.total)}
                </p>
                {item.discount > 0 && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    -{formatCurrency(item.discount)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700">
          <div className="space-y-1 max-w-xs ml-auto">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Subtotal
              </span>
              <span className="text-gray-900 dark:text-white">
                {formatCurrency(sale.subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Tax</span>
              <span className="text-gray-900 dark:text-white">
                {formatCurrency(sale.tax)}
              </span>
            </div>
            {(saleService.extractBreakdown(sale).promotionDiscount ?? 0) > 0 && (
              <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Promotion
                  {saleService.extractBreakdown(sale).promotionCode && (
                    <code className="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-950/40 text-[10px] font-mono">
                      {saleService.extractBreakdown(sale).promotionCode}
                    </code>
                  )}
                </span>
                <span className="tabular-nums">
                  -{formatCurrency(
                    saleService.extractBreakdown(sale).promotionDiscount ?? 0
                  )}
                </span>
              </div>
            )}
            {(saleService.extractBreakdown(sale).loyaltyPointsUsed ?? 0) > 0 && (
              <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                <span className="flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span className="tabular-nums">
                    {saleService.extractBreakdown(sale).loyaltyPointsUsed}{' '}
                    loyalty points
                  </span>
                </span>
                <span className="tabular-nums">
                  -{formatCurrency(
                    saleService.extractBreakdown(sale).loyaltyDiscount ?? 0
                  )}
                </span>
              </div>
            )}
            {sale.discount > 0 &&
              !saleService.hasBreakdown(sale) && (
                <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                  <span>Discount</span>
                  <span>-{formatCurrency(sale.discount)}</span>
                </div>
              )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-900 dark:text-white">Total</span>
              <span className="text-gray-900 dark:text-white">
                {formatCurrency(sale.total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Discount breakdown panel — renders only when the sale
          carries a promotion / loyalty attribution. */}
      <SaleBreakdownPanel sale={sale} />

      {/* Notes */}
      {sale.notes && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" />
            Notes
          </h4>
          <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
            {sale.notes}
          </p>
        </div>
      )}

      {/* Return History */}
      {sale.returns && sale.returns.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-purple-500" />
              Return History
            </h4>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {sale.returns.map((ret) => (
              <div
                key={ret.id}
                className="p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Return #{ret.returnNumber}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(ret.createdAt)} • {ret.items.length} items
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      RETURN_STATUS_STYLES[ret.status] ??
                      DEFAULT_RETURN_STATUS_STYLE
                    }`}
                  >
                    {ret.status}
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {formatCurrency(ret.total)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowEmailModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 m-4">
            <button
              onClick={() => setShowEmailModal(false)}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <XCircle className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Send Receipt via Email
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@email.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={submitting || !email.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowRefundModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 m-4">
            <button
              onClick={() => setShowRefundModal(false)}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <XCircle className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Refund Sale
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Total amount:{' '}
              <span className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(sale.total)}
              </span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason for Refund
                </label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter reason for refund..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowRefundModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRefund(refundReason)}
                disabled={submitting || !refundReason.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                Process Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SaleDetail;
