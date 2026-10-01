// packages/web/components/sales/SaleDetail.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
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
  ArrowRightLeft,
} from 'lucide-react';

import {
  saleService,
  DISCOUNT_TYPE_LABELS,
} from '../../services/saleService';
import type { DiscountType, SaleBreakdown } from '../../services/saleService';
import type { Sale } from '../../types/sale';
import { toast } from '../../utils/toast-manager';
import { formatCurrency, formatDate } from '../../utils/formatters';

const DEFAULT_CURRENCY = 'USD';

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
  DELETED: {
    label: 'Deleted',
    className:
      'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
    icon: XCircle,
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
  PROCESSED:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  PENDING:
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  REJECTED:
    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  CANCELLED:
    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};
const DEFAULT_RETURN_STATUS_STYLE =
  'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function parseMoney(input: string): number {
  if (!input) return 0;
  const n = parseFloat(input);
  return Number.isFinite(n) ? n : 0;
}

function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function toIsoString(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function calculateLoyaltyLevel(totalSpent: number): string {
  if (!Number.isFinite(totalSpent) || totalSpent < 0) return 'BRONZE';
  if (totalSpent >= 10000) return 'DIAMOND';
  if (totalSpent >= 5000) return 'PLATINUM';
  if (totalSpent >= 2000) return 'GOLD';
  if (totalSpent >= 500) return 'SILVER';
  return 'BRONZE';
}

function resolveSaleCurrency(sale: Sale): string {
  const payment = (sale as any).payments?.[0];

  const candidates = [
    payment?.displayCurrency,
    (sale as any).currency,
    payment?.currency,
  ];

  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) {
      return c.trim().toUpperCase();
    }
  }
  return DEFAULT_CURRENCY;
}

function resolveCustomerName(sale: Sale): string {
  const customer = sale.customer;
  if (!customer) return 'Guest';

  const fullName = [customer.firstName, customer.lastName]
    .filter((p) => typeof p === 'string' && p.trim().length > 0)
    .join(' ')
    .trim();

  if (fullName) return fullName;

  const email = (customer as any).email;
  if (typeof email === 'string' && email.trim().length > 0) return email;

  return 'Customer';
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config = STATUS_MAP[status];
  if (!config) {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
        <AlertCircle className="w-3 h-3" aria-hidden="true" />
        {status || 'Unknown'}
      </span>
    );
  }
  const Icon = config.icon;
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${config.className}`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
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
}> = ({ label, value, icon: Icon, color, subtext }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <div
        className={`p-1.5 rounded-lg ${
          STAT_CARD_COLORS[color] || STAT_CARD_COLORS.blue
        }`}
      >
        <Icon className="w-4 h-4" aria-hidden="true" />
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

const SaleBreakdownPanel: React.FC<{
  breakdown: SaleBreakdown;
  currency: string;
}> = ({ breakdown, currency }) => {
  const promotionLabel = breakdown.discountType
    ? DISCOUNT_TYPE_LABELS[breakdown.discountType as DiscountType] ??
      String(breakdown.discountType)
    : 'Discount';

  const hasPromotion = (breakdown.promotionDiscount ?? 0) > 0;
  const hasLoyalty = (breakdown.loyaltyPointsUsed ?? 0) > 0;

  if (!hasPromotion && !hasLoyalty) return null;

  return (
    <section
      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-2 mb-6"
      aria-label="Discount breakdown"
    >
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-500" aria-hidden="true" />
        Discount breakdown
      </h3>

      {hasPromotion && (
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400 flex-wrap">
            <Tag
              className="w-3.5 h-3.5 text-blue-500 shrink-0"
              aria-hidden="true"
            />
            <span>{promotionLabel}</span>
            {breakdown.promotionCode && (
              <code className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-[11px] font-mono tabular-nums">
                {breakdown.promotionCode}
              </code>
            )}
          </span>
          <span className="tabular-nums font-medium text-green-600 dark:text-green-400 shrink-0">
            -{formatCurrency(breakdown.promotionDiscount ?? 0, currency)}
          </span>
        </div>
      )}

      {hasLoyalty && (
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Star
              className="w-3.5 h-3.5 text-yellow-500 fill-current shrink-0"
              aria-hidden="true"
            />
            <span className="tabular-nums">
              {breakdown.loyaltyPointsUsed} loyalty points
            </span>
          </span>
          <span className="tabular-nums font-medium text-green-600 dark:text-green-400 shrink-0">
            -{formatCurrency(breakdown.loyaltyDiscount ?? 0, currency)}
          </span>
        </div>
      )}
    </section>
  );
};

export function SaleDetail() {
  const params = useParams();

  const id =
    typeof params?.id === 'string'
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : null;

  const mountedRef = useRef(true);
  const fetchRequestIdRef = useRef(0);

  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const [email, setEmail] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundAmountInput, setRefundAmountInput] = useState('');

  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadSale = useCallback(
    async (showLoading = true): Promise<boolean> => {
      if (!id) {
        setLoading(false);
        return false;
      }

      const requestId = ++fetchRequestIdRef.current;
      if (showLoading) setLoading(true);
      else setRefreshing(true);
      setLoadError(null);

      try {
        const data = await saleService.getSaleById(id);
        if (requestId !== fetchRequestIdRef.current) return false;
        if (!mountedRef.current) return false;
        setSale(data);
        return true;
      } catch (error) {
        if (requestId !== fetchRequestIdRef.current) return false;
        if (!mountedRef.current) return false;
        const message = extractErrorMessage(
          error,
          'Failed to load sale details',
        );
        console.error('[SaleDetail] load failed:', message);
        setLoadError(message);
        toast.error(message);
        return false;
      } finally {
        if (requestId === fetchRequestIdRef.current && mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [id],
  );

  useEffect(() => {
    void loadSale(true);
  }, [loadSale]);

  const handleRefresh = useCallback(async () => {
    const ok = await loadSale(false);
    if (ok) toast.success('Sale refreshed');
    else toast.error('Failed to refresh sale');
  }, [loadSale]);

  const items = useMemo(() => sale?.items ?? [], [sale?.items]);
  const payments = useMemo(() => sale?.payments ?? [], [sale?.payments]);
  const returns = useMemo(() => sale?.returns ?? [], [sale?.returns]);
  const refunds = useMemo(() => sale?.refunds ?? [], [sale?.refunds]);

  const currency = useMemo(
    () => (sale ? resolveSaleCurrency(sale) : DEFAULT_CURRENCY),
    [sale],
  );

  const totalUnits = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const customerName = useMemo(
    () => (sale ? resolveCustomerName(sale) : 'Guest'),
    [sale],
  );

  const customerEmail = sale?.customer?.email || 'N/A';
  const customerPhone = sale?.customer?.phoneNumber || 'N/A';

  const loyaltyLevel = useMemo(() => {
    if (!sale?.customer) return null;
    return calculateLoyaltyLevel(sale.customer.totalSpent);
  }, [sale?.customer]);

  const breakdown: SaleBreakdown = useMemo(() => {
    if (!sale) return {};
    return saleService.extractBreakdown(sale);
  }, [sale]);

  const hasBreakdown = useMemo(
    () => (sale ? saleService.hasBreakdown(sale) : false),
    [sale],
  );

  const discountSummary = useMemo(() => {
    if (!sale) return { hasAny: false, describe: '' };
    const describe = hasBreakdown ? saleService.describeBreakdown(sale) : '';
    return { hasAny: hasBreakdown, describe };
  }, [sale, hasBreakdown]);

  const refundableAmount = useMemo(() => {
    if (!sale) return 0;
    const refundedTotal = refunds
      .filter((r) => r.status === 'COMPLETED' || r.status === 'APPROVED')
      .reduce((sum, r) => sum + (r.total ?? 0), 0);
    const returnedTotal = returns
      .filter((r) => r.status === 'APPROVED' || r.status === 'PROCESSED')
      .reduce((sum, r) => sum + (r.total ?? 0), 0);
    return round2(Math.max(0, sale.total - refundedTotal - returnedTotal));
  }, [sale, refunds, returns]);

  const chargeInfo = useMemo(() => {
    if (!sale) return null;
    const payment = (sale as any).payments?.[0];
    const gatewayCurrency =
      typeof payment?.gatewayCurrency === 'string' &&
      payment.gatewayCurrency.trim().length > 0
        ? payment.gatewayCurrency.trim().toUpperCase()
        : undefined;
    const gatewayAmount =
      typeof payment?.gatewayAmount === 'number'
        ? payment.gatewayAmount
        : undefined;
    const rate =
      typeof payment?.exchangeRate === 'number'
        ? payment.exchangeRate
        : undefined;
    const rateSource =
      typeof payment?.exchangeRateSource === 'string'
        ? payment.exchangeRateSource
        : undefined;

    if (!gatewayCurrency || gatewayCurrency === currency) {
      return null;
    }
    if (typeof gatewayAmount !== 'number') return null;

    return { gatewayCurrency, gatewayAmount, rate, rateSource };
  }, [sale, currency]);

  const handlePrint = useCallback(() => {
    if (!sale) return;

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
    const fmt = (amount: number): string =>
      e(formatCurrency(amount, currency));

    const businessName = e(sale.businessUnit?.name || 'Store');
    const businessAddress = e(sale.businessUnit?.address || '');
    const businessPhone = e(sale.businessUnit?.phone || '');
    const receiptNumber = e(sale.receiptNumber);
    const saleDate = e(new Date(sale.saleDate).toLocaleString());
    const cashierName = e(
      `${sale.user?.firstName || ''} ${sale.user?.lastName || ''}`.trim(),
    );

    const itemRows = items
      .map(
        (item) => `
          <div class="item">
            <span class="name">${e(item.product?.name ?? 'Unknown')}</span>
            <span class="qty">x${e(item.quantity)}</span>
            <span class="price">${fmt(item.total)}</span>
          </div>
        `,
      )
      .join('');

    const promotionDiscount = breakdown.promotionDiscount ?? 0;
    const promotionCode = breakdown.promotionCode;
    const loyaltyPointsUsed = breakdown.loyaltyPointsUsed ?? 0;
    const loyaltyDiscount = breakdown.loyaltyDiscount ?? 0;

    const promotionLine =
      promotionDiscount > 0
        ? `<div class="total-row"><span>Promotion${
            promotionCode ? ` (${e(promotionCode)})` : ''
          }</span><span>-${fmt(promotionDiscount)}</span></div>`
        : '';

    const loyaltyLine =
      loyaltyPointsUsed > 0
        ? `<div class="total-row"><span>${e(
            loyaltyPointsUsed,
          )} loyalty points</span><span>-${fmt(
            loyaltyDiscount,
          )}</span></div>`
        : '';

    const genericDiscountLine =
      sale.discount > 0 && promotionDiscount === 0 && loyaltyDiscount === 0
        ? `<div class="total-row"><span>Discount</span><span>-${fmt(
            sale.discount,
          )}</span></div>`
        : '';

    const paymentRows = payments
      .map(
        (p) => `<p>${e(p.paymentMethod)}: ${fmt(p.amount)}</p>`,
      )
      .join('');

    const changeLine =
      sale.changeAmount > 0
        ? `<p>Change: ${fmt(sale.changeAmount)}</p>`
        : '';

    const customerBlock = sale.customer
      ? `
        <div class="payment">
          <p><strong>Customer</strong></p>
          <p>${e(customerName)}</p>
          <p>${e(sale.customer.email || '')}</p>
        </div>
      `
      : '';

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Receipt #${receiptNumber}</title>
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
            <h3>${businessName}</h3>
            <p>${businessAddress}</p>
            <p>${businessPhone}</p>
            <p style="margin-top: 5px;"><strong>Receipt #${receiptNumber}</strong></p>
            <p>${saleDate}</p>
            <p>Cashier: ${cashierName}</p>
          </div>
          <div class="items">${itemRows}</div>
          <div class="total">
            <div class="total-row"><span>Subtotal</span><span>${fmt(
              sale.subtotal,
            )}</span></div>
            <div class="total-row"><span>Tax</span><span>${fmt(
              sale.tax,
            )}</span></div>
            ${promotionLine}
            ${loyaltyLine}
            ${genericDiscountLine}
            <div class="total-row grand"><span>Total</span><span>${fmt(
              sale.total,
            )}</span></div>
          </div>
          <div class="payment">
            <p><strong>Payment</strong></p>
            ${paymentRows}
            ${changeLine}
          </div>
          ${customerBlock}
          <div class="footer">
            <p>Thank you for your business!</p>
            <p>${businessName}</p>
          </div>
          <script>
            window.addEventListener('load', function () {
              setTimeout(function () { window.print(); }, 50);
            });
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [
    sale,
    items,
    payments,
    breakdown,
    customerName,
    currency,
  ]);

  const handleDownloadReceipt = useCallback(() => {
    if (!sale) return;
    toast.info(
      'Choose "Save as PDF" as the destination in the print dialog.',
    );
    handlePrint();
  }, [sale, handlePrint]);

  const openEmailModal = useCallback(() => {
    setEmail(sale?.customer?.email || '');
    setShowEmailModal(true);
  }, [sale?.customer?.email]);

  const handleSendEmail = useCallback(async () => {
    if (!id || !sale) return;

    const trimmed = email.trim();
    if (!trimmed) {
      toast.error('Please enter an email address');
      return;
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSendingEmail(true);
    try {
      await saleService.sendReceiptEmail(id, trimmed);
      if (!mountedRef.current) return;
      toast.success(`Receipt sent to ${trimmed}`);
      setShowEmailModal(false);
      setEmail('');
      await loadSale(false);
    } catch (error) {
      if (!mountedRef.current) return;
      const message = extractErrorMessage(error, 'Failed to send receipt');
      console.error('[SaleDetail] send email failed:', message);
      toast.error(message);
    } finally {
      if (mountedRef.current) setIsSendingEmail(false);
    }
  }, [id, sale, email, loadSale]);

  const openRefundModal = useCallback(() => {
    setRefundReason('');
    setRefundAmountInput(refundableAmount.toFixed(2));
    setShowRefundModal(true);
  }, [refundableAmount]);

  const handleRefund = useCallback(async () => {
    if (!id || !sale) return;

    const trimmed = refundReason.trim();
    if (!trimmed) {
      toast.error('Please enter a reason for the refund');
      return;
    }

    const amount = round2(parseMoney(refundAmountInput));
    if (amount <= 0) {
      toast.error('Refund amount must be greater than zero');
      return;
    }
    if (amount > refundableAmount) {
      toast.error(
        `Refund amount cannot exceed ${formatCurrency(
          refundableAmount,
          currency,
        )}`,
      );
      return;
    }

    setIsRefunding(true);
    try {
      await saleService.refundSale(id, trimmed, amount);
      if (!mountedRef.current) return;
      toast.success(`Refunded ${formatCurrency(amount, currency)}`);
      setShowRefundModal(false);
      setRefundReason('');
      setRefundAmountInput('');
      await loadSale(false);
    } catch (error) {
      if (!mountedRef.current) return;
      const message = extractErrorMessage(error, 'Failed to refund sale');
      console.error('[SaleDetail] refund failed:', message);
      toast.error(message);
    } finally {
      if (mountedRef.current) setIsRefunding(false);
    }
  }, [
    id,
    sale,
    currency,
    refundReason,
    refundAmountInput,
    refundableAmount,
    loadSale,
  ]);

  useEffect(() => {
    if (!showEmailModal && !showRefundModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isSendingEmail || isRefunding) return;
      setShowEmailModal(false);
      setShowRefundModal(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showEmailModal, showRefundModal, isSendingEmail, isRefunding]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2
            className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4"
            aria-hidden="true"
          />
          <p className="text-gray-500 dark:text-gray-400">
            Loading sale details…
          </p>
        </div>
      </div>
    );
  }

  if (loadError && !sale) {
    return (
      <div className="p-6 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle
            className="w-8 h-8 text-red-500 dark:text-red-400"
            aria-hidden="true"
          />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          Failed to load sale
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{loadError}</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => void loadSale(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus-ring"
          >
            Retry
          </button>
          <Link
            href="/sales"
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus-ring"
          >
            Back to Sales
          </Link>
        </div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="p-6 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle
            className="w-8 h-8 text-gray-400"
            aria-hidden="true"
          />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          Sale not found
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          The sale you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/sales"
          className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus-ring"
        >
          Back to Sales
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href="/sales"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0 focus-ring"
            aria-label="Back to sales"
          >
            <ArrowLeft
              className="w-5 h-5 text-gray-600 dark:text-gray-400"
              aria-hidden="true"
            />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                Sale #{sale.receiptNumber}
              </h1>
              <StatusBadge status={sale.status} />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                {formatDate(toIsoString(sale.saleDate))}
              </span>
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" aria-hidden="true" />
                {customerName}
              </span>
              <span className="flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                {payments[0]?.paymentMethod || 'N/A'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
            title="Refresh"
            aria-label="Refresh sale"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
            title="Print"
            aria-label="Print receipt"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleDownloadReceipt}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
            title="Save as PDF"
            aria-label="Save as PDF"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={openEmailModal}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
            title="Email receipt"
            aria-label="Email receipt"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
          </button>
          {sale.status === 'COMPLETED' && refundableAmount > 0 && (
            <button
              type="button"
              onClick={openRefundModal}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors text-sm focus-ring"
            >
              <TrendingDown className="w-4 h-4" aria-hidden="true" />
              Refund
            </button>
          )}
        </div>
      </div>

      {chargeInfo && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200">
          <ArrowRightLeft
            className="w-4 h-4 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="font-medium">
              Charged in {chargeInfo.gatewayCurrency}
            </p>
            <p className="text-xs text-amber-700/90 dark:text-amber-300/90 mt-0.5 tabular-nums">
              Gateway billed{' '}
              {formatCurrency(
                chargeInfo.gatewayAmount,
                chargeInfo.gatewayCurrency,
              )}
              {chargeInfo.rate != null && (
                <>
                  {' '}at rate {chargeInfo.rate.toFixed(6)}
                  {chargeInfo.rateSource
                    ? ` (${chargeInfo.rateSource})`
                    : ''}
                </>
              )}
              . The ledger records this sale in {currency}.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          label="Total"
          value={formatCurrency(sale.total, currency)}
          icon={DollarSign}
          color="green"
          subtext={`Paid: ${formatCurrency(sale.paidAmount, currency)}`}
        />
        <StatCard
          label="Subtotal"
          value={formatCurrency(sale.subtotal, currency)}
          icon={ShoppingBag}
          color="blue"
          subtext={`${items.length} item${items.length === 1 ? '' : 's'}`}
        />
        <StatCard
          label="Tax"
          value={formatCurrency(sale.tax, currency)}
          icon={FileText}
          color="purple"
          subtext={sale.tax > 0 ? 'Included' : 'No tax'}
        />
        <StatCard
          label="Discount"
          value={
            sale.discount > 0
              ? `-${formatCurrency(sale.discount, currency)}`
              : 'None'
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
          value={formatCurrency(sale.changeAmount, currency)}
          icon={CreditCard}
          color="orange"
          subtext={
            sale.changeAmount > 0 ? 'Returned to customer' : 'Exact amount'
          }
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500" aria-hidden="true" />
            Customer Information
          </h3>
          <div className="space-y-2">
            <p className="text-gray-900 dark:text-white font-medium">
              {customerName}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <Mail
                className="w-3.5 h-3.5 flex-shrink-0"
                aria-hidden="true"
              />
              <span className="truncate">{customerEmail}</span>
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <Phone
                className="w-3.5 h-3.5 flex-shrink-0"
                aria-hidden="true"
              />
              {customerPhone}
            </p>
            {sale.customer && loyaltyLevel && (
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Award
                  className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0"
                  aria-hidden="true"
                />
                {loyaltyLevel} · {sale.customer.loyaltyPoints} points
              </p>
            )}
            {sale.customer?.lastPurchaseAt && (
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Calendar
                  className="w-3.5 h-3.5 flex-shrink-0"
                  aria-hidden="true"
                />
                Last purchase:{' '}
                {formatDate(toIsoString(sale.customer.lastPurchaseAt))}
              </p>
            )}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <CreditCard
              className="w-4 h-4 text-green-500"
              aria-hidden="true"
            />
            Payment Information
          </h3>
          <div className="space-y-2">
            {payments.map((payment) => {
              const paymentCurrency =
                typeof (payment as any).currency === 'string' &&
                (payment as any).currency.trim().length > 0
                  ? (payment as any).currency.trim().toUpperCase()
                  : currency;
              return (
                <div
                  key={payment.id}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {payment.paymentMethod}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(payment.amount, paymentCurrency)}
                  </span>
                </div>
              );
            })}
            {sale.changeAmount > 0 && (
              <div className="flex items-center justify-between border-t dark:border-gray-700 pt-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Change
                </span>
                <span className="font-medium text-green-600 dark:text-green-400 tabular-nums">
                  {formatCurrency(sale.changeAmount, currency)}
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

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Package
              className="w-5 h-5 text-blue-500"
              aria-hidden="true"
            />
            Items ({items.length})
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            Total: {totalUnits} unit{totalUnits === 1 ? '' : 's'}
          </span>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[400px] overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                  {item.product?.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.product.images[0]}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <Package
                      className="w-6 h-6 text-gray-400"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {item.product?.name ?? 'Unknown product'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <span>SKU: {item.product?.sku ?? 'N/A'}</span>
                    {item.variant && (
                      <span>Variant: {item.variant.name}</span>
                    )}
                    <span className="tabular-nums">
                      ×{item.quantity}
                    </span>
                    <span className="tabular-nums">
                      @ {formatCurrency(item.unitPrice, currency)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-gray-900 dark:text-white tabular-nums">
                  {formatCurrency(item.total, currency)}
                </p>
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
              <span className="text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(sale.subtotal, currency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Tax</span>
              <span className="text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(sale.tax, currency)}
              </span>
            </div>
            {(breakdown.promotionDiscount ?? 0) > 0 && (
              <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" aria-hidden="true" />
                  Promotion
                  {breakdown.promotionCode && (
                    <code className="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-950/40 text-[10px] font-mono">
                      {breakdown.promotionCode}
                    </code>
                  )}
                </span>
                <span className="tabular-nums">
                  -{formatCurrency(breakdown.promotionDiscount ?? 0, currency)}
                </span>
              </div>
            )}
            {(breakdown.loyaltyPointsUsed ?? 0) > 0 && (
              <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                <span className="flex items-center gap-1.5">
                  <Star
                    className="w-3.5 h-3.5 fill-current"
                    aria-hidden="true"
                  />
                  <span className="tabular-nums">
                    {breakdown.loyaltyPointsUsed} loyalty points
                  </span>
                </span>
                <span className="tabular-nums">
                  -{formatCurrency(breakdown.loyaltyDiscount ?? 0, currency)}
                </span>
              </div>
            )}
            {sale.discount > 0 && !hasBreakdown && (
              <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                <span>Discount</span>
                <span className="tabular-nums">
                  -{formatCurrency(sale.discount, currency)}
                </span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-900 dark:text-white">Total</span>
              <span className="text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(sale.total, currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <SaleBreakdownPanel breakdown={breakdown} currency={currency} />

      {sale.notes && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <FileText
              className="w-4 h-4 text-gray-500"
              aria-hidden="true"
            />
            Notes
          </h4>
          <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
            {sale.notes}
          </p>
        </div>
      )}

      {returns.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <History
                className="w-5 h-5 text-purple-500"
                aria-hidden="true"
              />
              Return History
            </h4>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {returns.map((ret) => (
              <div
                key={ret.id}
                className="p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Return #{ret.returnNumber}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                    {formatDate(toIsoString(ret.createdAt))} ·{' '}
                    {ret.items?.length ?? 0} item
                    {ret.items?.length === 1 ? '' : 's'}
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
                  <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(ret.total, currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showEmailModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sale-email-modal-title"
        >
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !isSendingEmail && setShowEmailModal(false)}
            aria-hidden="true"
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 m-4">
            <button
              type="button"
              onClick={() => !isSendingEmail && setShowEmailModal(false)}
              disabled={isSendingEmail}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring disabled:opacity-50"
              aria-label="Close"
            >
              <XCircle
                className="w-5 h-5 text-gray-500 dark:text-gray-400"
                aria-hidden="true"
              />
            </button>
            <h3
              id="sale-email-modal-title"
              className="text-lg font-bold text-gray-900 dark:text-white mb-4"
            >
              Send Receipt via Email
            </h3>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="receipt-email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Email Address
                </label>
                <input
                  id="receipt-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@email.com"
                  disabled={isSendingEmail}
                  autoComplete="email"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring disabled:opacity-50"
                disabled={isSendingEmail}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSendEmail()}
                disabled={isSendingEmail || !email.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 focus-ring"
              >
                {isSendingEmail ? (
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Send className="w-4 h-4" aria-hidden="true" />
                )}
                Send Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {showRefundModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sale-refund-modal-title"
        >
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !isRefunding && setShowRefundModal(false)}
            aria-hidden="true"
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 m-4">
            <button
              type="button"
              onClick={() => !isRefunding && setShowRefundModal(false)}
              disabled={isRefunding}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring disabled:opacity-50"
              aria-label="Close"
            >
              <XCircle
                className="w-5 h-5 text-gray-500 dark:text-gray-400"
                aria-hidden="true"
              />
            </button>
            <h3
              id="sale-refund-modal-title"
              className="text-lg font-bold text-gray-900 dark:text-white mb-2"
            >
              Refund Sale
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Refundable amount:{' '}
              <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(refundableAmount, currency)}
              </span>
              {refundableAmount < sale.total && (
                <span className="block text-xs text-gray-400 mt-0.5">
                  (Sale total was {formatCurrency(sale.total, currency)}; partial
                  refunds and returns have been deducted.)
                </span>
              )}
            </p>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="refund-amount"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Refund Amount
                </label>
                <div className="relative">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-sm font-medium"
                    aria-hidden="true"
                  >
                    {currency}
                  </span>
                  <input
                    id="refund-amount"
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
                    className="w-full pl-14 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums disabled:opacity-50"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="refund-reason"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Reason for Refund
                </label>
                <textarea
                  id="refund-reason"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  disabled={isRefunding}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 resize-none"
                  placeholder="Enter reason for refund…"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring disabled:opacity-50"
                disabled={isRefunding}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRefund()}
                disabled={isRefunding || !refundReason.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 focus-ring"
              >
                {isRefunding ? (
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <TrendingDown
                    className="w-4 h-4"
                    aria-hidden="true"
                  />
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
