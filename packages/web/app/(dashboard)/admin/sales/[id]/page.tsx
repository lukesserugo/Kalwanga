// packages/web/app/(dashboard)/admin/sales/[id]/page.tsx

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Printer,
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
  Lock,
  Receipt as ReceiptIcon,
} from 'lucide-react';
import {
  saleService,
  getDiscountTypeLabel,
} from '../../../../../services/saleService';
import {
  formatCurrency,
  formatDate,
  formatTime,
} from '../../../../../utils/formatters';
import { toast } from '../../../../../utils/toast-manager';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import type {
  Sale,
  SaleItem,
  Return,
  Refund,
} from '../../../../../types/sale';

// ============================================
// TYPES
// ============================================

type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MANAGER'
  | 'EMPLOYEE'
  | 'CASHIER'
  | 'VIEWER';

/**
 * Fields the backend adds on top of the raw `Sale` when the detail
 * endpoint is called, plus a couple of fields that exist on the
 * backend models but aren't on every version of the frontend types.
 *
 * Declaring them here as optional means this file compiles
 * regardless of whether `types/sale.ts` / `types/customer.ts` were
 * updated to include them.
 */
interface SaleResponse extends Sale {
  itemCount?: number;
  totalQuantity?: number;
  totalReturns?: number;
  totalRefunds?: number;
  customerName?: string;
  customerTotalPurchases?: number;
  hasReturns?: boolean;
  hasRefunds?: boolean;
}

/** Narrow view of the customer fields we read off the sale. */
interface CustomerMeta {
  loyaltyLevel?: string;
  loyaltyPoints?: number;
}

/** Narrow view of a SaleItem that may carry a per-line discount. */
interface SaleItemWithDiscount extends SaleItem {
  discount?: number;
}

// ============================================
// SUB-COMPONENTS
// ============================================

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const statusConfig: Record<
    string,
    { label: string; color: string; icon: React.ElementType }
  > = {
    COMPLETED: {
      label: 'Completed',
      color:
        'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
      icon: CheckCircle,
    },
    PENDING: {
      label: 'Pending',
      color:
        'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
      icon: Clock,
    },
    PROCESSING: {
      label: 'Processing',
      color:
        'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
      icon: RefreshCw,
    },
    CANCELLED: {
      label: 'Cancelled',
      color:
        'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
      icon: XCircle,
    },
    REFUNDED: {
      label: 'Refunded',
      color:
        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      icon: AlertCircle,
    },
    ON_HOLD: {
      label: 'On Hold',
      color:
        'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300',
      icon: Clock,
    },
    VOID: {
      label: 'Void',
      color:
        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      icon: XCircle,
    },
    RETURNED: {
      label: 'Returned',
      color:
        'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300',
      icon: TrendingDown,
    },
  };

  const config = statusConfig[status] || statusConfig.PENDING;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}
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
  const colorClasses: Record<string, string> = {
    brand: 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400',
    success:
      'bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400',
    warning:
      'bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400',
    danger:
      'bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400',
    secondary:
      'bg-secondary-50 dark:bg-secondary-900/20 text-secondary-600 dark:text-secondary-400',
    gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <div
          className={`p-1.5 rounded-lg ${
            colorClasses[color] || colorClasses.gray
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
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
 * Uses `saleService.hasBreakdown` to short-circuit and
 * `getDiscountTypeLabel` for the label lookup — unknown legacy
 * strings fall back to the raw value without a TS cast.
 */
const BreakdownPanel: React.FC<{ sale: SaleResponse }> = ({ sale }) => {
  if (!saleService.hasBreakdown(sale)) return null;

  const breakdown = saleService.extractBreakdown(sale);
  const hasPromotion = (breakdown.promotionDiscount ?? 0) > 0;
  const hasLoyalty = (breakdown.loyaltyPointsUsed ?? 0) > 0;

  const promotionLabel = breakdown.discountType
    ? getDiscountTypeLabel(breakdown.discountType) || 'Discount'
    : 'Discount';

  return (
    <section
      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-2"
      aria-label="Discount breakdown"
    >
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-brand-500" />
        Discount breakdown
      </h3>

      {hasPromotion && (
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400 flex-wrap">
            <Tag className="w-3.5 h-3.5 text-brand-500 shrink-0" />
            <span>{promotionLabel}</span>
            {breakdown.promotionCode && (
              <code className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-[11px] font-mono tabular-nums">
                {breakdown.promotionCode}
              </code>
            )}
          </span>
          <span className="tabular-nums font-medium text-success-600 dark:text-success-400 shrink-0">
            -{formatCurrency(breakdown.promotionDiscount ?? 0)}
          </span>
        </div>
      )}

      {hasLoyalty && (
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Star className="w-3.5 h-3.5 text-warning-500 fill-current shrink-0" />
            <span className="tabular-nums">
              {breakdown.loyaltyPointsUsed} loyalty points
            </span>
          </span>
          <span className="tabular-nums font-medium text-success-600 dark:text-success-400 shrink-0">
            -{formatCurrency(breakdown.loyaltyDiscount ?? 0)}
          </span>
        </div>
      )}
    </section>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function SaleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { canView, canManage } = usePermission();

  const saleId = params?.id as string | undefined;

  const [sale, setSale] = useState<SaleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [email, setEmail] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const userRole = (authUser?.role || 'VIEWER') as UserRole;

  // ============================================
  // PERMISSIONS
  // ============================================

  const canViewSales = useCallback(() => {
    return (
      canView?.(`${PermissionResource.SALE}:view`) ||
      ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'CASHIER'].includes(
        userRole
      )
    );
  }, [userRole, canView]);

  const canManageSales = useCallback(() => {
    return (
      canManage?.(`${PermissionResource.SALE}:manage`) ||
      ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userRole)
    );
  }, [userRole, canManage]);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadSale = useCallback(
    async (silent = false) => {
      if (!saleId) return;

      try {
        if (!silent) setLoading(true);
        else setRefreshing(true);

        const data = await saleService.getSaleById(saleId);
        setSale(data as SaleResponse);
      } catch (error: any) {
        console.error('Failed to load sale:', error);

        if (error?.response?.status === 404) {
          toast.error('Sale not found');
          router.push('/admin/sales');
          return;
        }
        if (error?.response?.status === 403) {
          toast.error('You do not have permission to view this sale');
          router.push('/admin/sales');
          return;
        }

        toast.error('Failed to load sale details');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [saleId, router]
  );

  useEffect(() => {
    if (authUser && canViewSales() && saleId) {
      loadSale();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, saleId]);

  const handleRefresh = useCallback(async () => {
    await loadSale(true);
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

    const breakdown = saleService.extractBreakdown(sale);
    const promotionDiscount = breakdown.promotionDiscount ?? 0;
    const promotionCode = breakdown.promotionCode ?? null;
    const loyaltyPointsUsed = breakdown.loyaltyPointsUsed ?? 0;
    const loyaltyDiscount = breakdown.loyaltyDiscount ?? 0;

    const promotionLine =
      promotionDiscount > 0
        ? `<div class="total-row"><span>Promotion${
            promotionCode ? ` (${promotionCode})` : ''
          }</span><span>-${formatCurrency(promotionDiscount)}</span></div>`
        : '';

    const loyaltyLine =
      loyaltyPointsUsed > 0
        ? `<div class="total-row"><span>${loyaltyPointsUsed} loyalty points</span><span>-${formatCurrency(loyaltyDiscount)}</span></div>`
        : '';

    const rawDiscountLine =
      sale.discount > 0 && promotionDiscount === 0 && loyaltyDiscount === 0
        ? `<div class="total-row"><span>Discount</span><span>-${formatCurrency(sale.discount)}</span></div>`
        : '';

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt #${sale.receiptNumber}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; max-width: 320px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 10px; margin-bottom: 10px; }
            .header h3 { margin: 0 0 4px; font-size: 16px; }
            .header p { margin: 2px 0; font-size: 12px; color: #666; }
            .items { margin: 10px 0; }
            .item { display: flex; justify-content: space-between; padding: 2px 0; font-size: 13px; }
            .totals { border-top: 2px dashed #333; padding-top: 10px; margin-top: 10px; }
            .total-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 13px; }
            .total-row.grand { font-weight: bold; font-size: 16px; border-top: 1px solid #333; padding-top: 8px; margin-top: 4px; }
            .payment { border-top: 1px dashed #ccc; padding-top: 10px; margin-top: 10px; }
            .payment p { margin: 2px 0; font-size: 12px; }
            .footer { text-align: center; border-top: 2px dashed #333; padding-top: 10px; margin-top: 10px; font-size: 11px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h3>${sale.businessUnit?.name || 'Store'}</h3>
            <p>${sale.businessUnit?.address || ''}</p>
            <p>${sale.businessUnit?.phone || ''}</p>
            <p style="margin-top: 5px;"><strong>Receipt #${sale.receiptNumber}</strong></p>
            <p>${formatDate(sale.saleDate || sale.createdAt)} ${formatTime(
      sale.saleDate || sale.createdAt
    )}</p>
            <p>Cashier: ${sale.user?.firstName || ''} ${sale.user?.lastName || ''}</p>
            ${
              sale.customer
                ? `<p>Customer: ${sale.customer.firstName} ${sale.customer.lastName}</p>`
                : ''
            }
          </div>
          <div class="items">
            ${(sale.items || [])
              .map(
                (item: SaleItem) => `
              <div class="item">
                <span>${item.product?.name || 'Item'} × ${item.quantity}</span>
                <span>${formatCurrency(item.total)}</span>
              </div>
            `
              )
              .join('')}
          </div>
          <div class="totals">
            <div class="total-row"><span>Subtotal</span><span>${formatCurrency(sale.subtotal)}</span></div>
            <div class="total-row"><span>Tax</span><span>${formatCurrency(sale.tax)}</span></div>
            ${promotionLine}
            ${loyaltyLine}
            ${rawDiscountLine}
            <div class="total-row grand"><span>Total</span><span>${formatCurrency(sale.total)}</span></div>
          </div>
          <div class="payment">
            <p><strong>Payment</strong></p>
            ${(sale.payments || [])
              .map(
                (p: any) =>
                  `<p>${p.paymentMethod}: ${formatCurrency(p.amount)}</p>`
              )
              .join('')}
            ${
              (sale.changeAmount ?? 0) > 0
                ? `<p>Change: ${formatCurrency(sale.changeAmount)}</p>`
                : ''
            }
          </div>
          <div class="footer">
            <p>Thank you for your business!</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    toast.success('Receipt sent to printer');
  }, [sale]);

  // ============================================
  // EMAIL
  // ============================================
  //
  // Backend primitive: `POST /api/sales/:id/email-receipt` with
  // `{ email }`. Exposed on the web client as either
  // `saleService.sendReceiptEmail(id, email)` or (for the customer's
  // saved address) `saleService.resendReceiptEmail(id)`.

  const handleSendEmail = useCallback(async () => {
    if (!saleId) return;
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error('Please enter an email address');
      return;
    }

    setSubmitting(true);
    try {
      const svc = saleService as any;
      if (typeof svc.sendReceiptEmail === 'function') {
        await svc.sendReceiptEmail(saleId, trimmed);
      } else if (typeof svc.resendReceiptEmail === 'function') {
        await svc.resendReceiptEmail(saleId);
      } else {
        throw new Error(
          'Receipt email is not available on this build of the sales service.'
        );
      }

      toast.success(`Receipt sent to ${trimmed}`);
      setShowEmailModal(false);
      setEmail('');
      await loadSale(true);
    } catch (error) {
      console.error('Failed to send receipt:', error);
      toast.error('Failed to send receipt');
    } finally {
      setSubmitting(false);
    }
  }, [saleId, email, loadSale]);

  // ============================================
  // REFUND
  // ============================================
  //
  // Backend primitive: `POST /api/sales/:id/refund` with
  // `{ reason }`. Exposed on the web client as
  // `saleService.refundSale(id, reason)`.

  const handleRefund = useCallback(async () => {
    if (!saleId) return;
    const trimmed = refundReason.trim();
    if (!trimmed) {
      toast.error('Please enter a reason for the refund');
      return;
    }

    setSubmitting(true);
    try {
      const svc = saleService as any;
      if (typeof svc.refundSale === 'function') {
        await svc.refundSale(saleId, trimmed);
      } else {
        // Fall back to the shared api client so this compiles even
        // when the web service wrapper doesn't expose refundSale.
        const { api } = await import('../../../../../services/api');
        await api.post(`/sales/${saleId}/refund`, { reason: trimmed });
      }

      toast.success('Sale refunded successfully');
      setShowRefundModal(false);
      setRefundReason('');
      await loadSale(true);
    } catch (error) {
      console.error('Failed to refund sale:', error);
      toast.error('Failed to refund sale');
    } finally {
      setSubmitting(false);
    }
  }, [saleId, refundReason, loadSale]);

  // ============================================
  // DERIVED
  // ============================================

  const customerName = useMemo(() => {
    if (!sale) return 'Guest';
    if (sale.customer) {
      return `${sale.customer.firstName} ${sale.customer.lastName}`.trim();
    }
    return (sale as SaleResponse).customerName || 'Guest';
  }, [sale]);

  const customerMeta = useMemo<CustomerMeta>(() => {
    if (!sale?.customer) return {};
    return sale.customer as CustomerMeta;
  }, [sale]);

  const discountSummary = useMemo(() => {
    if (!sale) return { hasAny: false, describe: '' };
    const hasAny = saleService.hasBreakdown(sale);
    const describe = hasAny ? saleService.describeBreakdown(sale) : '';
    return { hasAny, describe };
  }, [sale]);

  const breakdown = useMemo(() => {
    if (!sale) return null;
    return saleService.extractBreakdown(sale);
  }, [sale]);

  // ============================================
  // EARLY RETURNS
  // ============================================

  if (!authUser || !canViewSales()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view sale details.
        </p>
        <Link
          href="/admin/sales"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors focus-ring"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sales
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 pt-8 pb-12 animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-3"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-96 mb-8"></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 h-24"
              ></div>
            ))}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 h-64 mb-6"></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 h-40"></div>
        </div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            Sale not found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            The sale you're looking for doesn't exist.
          </p>
          <Link
            href="/admin/sales"
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors focus-ring"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sales
          </Link>
        </div>
      </div>
    );
  }

  const saleDate = sale.saleDate || sale.createdAt;
  const items = sale.items || [];
  const payments = sale.payments || [];
  const returns = sale.returns || [];
  const refunds = sale.refunds || [];

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 pt-8 pb-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-start justify-between gap-4 mb-8"
        >
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/admin/sales"
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0 focus-ring"
              aria-label="Back to Sales"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate tabular-nums">
                  Sale #{sale.receiptNumber}
                </h1>
                <StatusBadge status={sale.status} />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(saleDate)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTime(saleDate)}
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  {customerName}
                </span>
                <span className="flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" />
                  {payments[0]?.paymentMethod || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
              title="Refresh"
            >
              <RefreshCw
                className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${
                  refreshing ? 'animate-spin' : ''
                }`}
              />
            </button>
            <button
              onClick={handlePrint}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
              title="Print receipt"
            >
              <Printer className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={() => {
                setEmail(sale.customer?.email || '');
                setShowEmailModal(true);
              }}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
              title="Email receipt"
            >
              <Send className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            {canManageSales() &&
              (sale.status === 'COMPLETED' || sale.status === 'PENDING') && (
                <button
                  onClick={() => {
                    setRefundReason('');
                    setShowRefundModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-700 transition-colors text-sm focus-ring"
                >
                  <TrendingDown className="w-4 h-4" />
                  Refund
                </button>
              )}
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <StatCard
            label="Total"
            value={formatCurrency(sale.total)}
            icon={DollarSign}
            color="success"
            subtext={`Paid: ${formatCurrency(sale.paidAmount)}`}
          />
          <StatCard
            label="Subtotal"
            value={formatCurrency(sale.subtotal)}
            icon={ShoppingBag}
            color="brand"
            subtext={`${items.length} items`}
          />
          <StatCard
            label="Tax"
            value={formatCurrency(sale.tax)}
            icon={FileText}
            color="secondary"
            subtext={sale.tax > 0 ? 'Included' : 'No tax'}
          />
          <StatCard
            label="Discount"
            value={
              sale.discount > 0 ? `-${formatCurrency(sale.discount)}` : 'None'
            }
            icon={TrendingDown}
            color={sale.discount > 0 ? 'success' : 'gray'}
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
            value={formatCurrency(sale.changeAmount ?? 0)}
            icon={CreditCard}
            color="warning"
            subtext={
              (sale.changeAmount ?? 0) > 0
                ? 'Returned to customer'
                : 'Exact amount'
            }
          />
        </div>

        {/* Customer & Payment Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-brand-500" />
              Customer Information
            </h3>
            <div className="space-y-2">
              <p className="text-gray-900 dark:text-white font-medium">
                {customerName}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" />
                {sale.customer?.email || 'N/A'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5" />
                {sale.customer?.phoneNumber || 'N/A'}
              </p>
              {customerMeta.loyaltyLevel && (
                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-warning-500" />
                  {customerMeta.loyaltyLevel} •{' '}
                  {customerMeta.loyaltyPoints || 0} points
                </p>
              )}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-success-500" />
              Payment Information
            </h3>
            <div className="space-y-2">
              {payments.map((payment: any) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {payment.paymentMethod}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
              ))}
              {(sale.changeAmount ?? 0) > 0 && (
                <div className="flex items-center justify-between border-t dark:border-gray-700 pt-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Change
                  </span>
                  <span className="font-medium text-success-600 dark:text-success-400 tabular-nums">
                    {formatCurrency(sale.changeAmount ?? 0)}
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
              <Package className="w-5 h-5 text-brand-500" />
              Items ({items.length})
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
              Total:{' '}
              {items.reduce(
                (sum: number, item: SaleItem) => sum + item.quantity,
                0
              )}{' '}
              units
            </span>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[400px] overflow-y-auto sidebar-scroll">
            {items.map((item: SaleItem) => {
              const itemWithDiscount = item as SaleItemWithDiscount;
              const itemDiscount = itemWithDiscount.discount ?? 0;

              return (
                <div
                  key={item.id}
                  className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {item.product?.images?.[0] ? (
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
                        {item.product?.name || 'Product'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        {item.product?.sku && (
                          <span>SKU: {item.product.sku}</span>
                        )}
                        {item.variant && (
                          <span>Variant: {item.variant.name}</span>
                        )}
                        <span className="tabular-nums">×{item.quantity}</span>
                        <span className="tabular-nums">
                          @ {formatCurrency(item.unitPrice)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-900 dark:text-white tabular-nums">
                      {formatCurrency(item.total)}
                    </p>
                    {itemDiscount > 0 && (
                      <p className="text-xs text-success-600 dark:text-success-400 tabular-nums">
                        -{formatCurrency(itemDiscount)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700">
            <div className="space-y-1 max-w-xs ml-auto">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Subtotal
                </span>
                <span className="text-gray-900 dark:text-white tabular-nums">
                  {formatCurrency(sale.subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Tax</span>
                <span className="text-gray-900 dark:text-white tabular-nums">
                  {formatCurrency(sale.tax)}
                </span>
              </div>
              {breakdown && (breakdown.promotionDiscount ?? 0) > 0 && (
                <div className="flex justify-between text-sm text-success-600 dark:text-success-400">
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    Promotion
                    {breakdown.promotionCode && (
                      <code className="px-1.5 py-0.5 rounded bg-success-100 dark:bg-success-950/40 text-[10px] font-mono">
                        {breakdown.promotionCode}
                      </code>
                    )}
                  </span>
                  <span className="tabular-nums">
                    -{formatCurrency(breakdown.promotionDiscount ?? 0)}
                  </span>
                </div>
              )}
              {breakdown && (breakdown.loyaltyPointsUsed ?? 0) > 0 && (
                <div className="flex justify-between text-sm text-success-600 dark:text-success-400">
                  <span className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span className="tabular-nums">
                      {breakdown.loyaltyPointsUsed} loyalty points
                    </span>
                  </span>
                  <span className="tabular-nums">
                    -{formatCurrency(breakdown.loyaltyDiscount ?? 0)}
                  </span>
                </div>
              )}
              {sale.discount > 0 && !discountSummary.hasAny && (
                <div className="flex justify-between text-sm text-success-600 dark:text-success-400">
                  <span>Discount</span>
                  <span className="tabular-nums">
                    -{formatCurrency(sale.discount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-900 dark:text-white">Total</span>
                <span className="text-brand-600 dark:text-brand-400 tabular-nums">
                  {formatCurrency(sale.total)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown panel */}
        <div className="mb-6">
          <BreakdownPanel sale={sale} />
        </div>

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
        {returns.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-secondary-500" />
                Return History
              </h4>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {returns.map((ret: Return) => (
                <div
                  key={ret.id}
                  className="p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Return #{ret.returnNumber}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(ret.createdAt)} • {ret.items?.length || 0}{' '}
                      items
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                      {ret.status}
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                      {formatCurrency(ret.total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Refund History */}
        {refunds.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-danger-500" />
                Refund History
              </h4>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {refunds.map((refund: Refund) => (
                <div
                  key={refund.id}
                  className="p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Refund #{refund.refundNumber}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(refund.createdAt)} • {refund.reason}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                      {refund.status}
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                      {formatCurrency(refund.total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Receipt link */}
        {sale.receipt && (
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href={`/admin/sales/receipts?receipt=${sale.receipt.receiptNumber}`}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-300 focus-ring"
            >
              <ReceiptIcon className="w-4 h-4" />
              View saved receipt
            </Link>
          </div>
        )}
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-modal p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Send Receipt via Email
              </h3>
              <button
                onClick={() => setShowEmailModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                aria-label="Close"
              >
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowEmailModal(false)}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-300 focus-ring disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={submitting || !email.trim()}
                className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 text-sm focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-modal p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Refund Sale
              </h3>
              <button
                onClick={() => setShowRefundModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                aria-label="Close"
              >
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Total amount:{' '}
              <span className="font-medium text-gray-900 dark:text-white tabular-nums">
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  placeholder="Enter reason for refund..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowRefundModal(false)}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-300 focus-ring disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRefund}
                disabled={submitting || !refundReason.trim()}
                className="px-4 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-700 transition-colors flex items-center gap-2 text-sm focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
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
