// packages/web/app/(dashboard)/admin/sales/dashboard/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Users,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Download,
  RefreshCw,
  Eye,
  Printer,
  ChevronRight,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Package,
  User,
  Tag,
  Lock,
  ArrowLeft,
  List,
  ShoppingCart,
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
  formatTime,
} from '../../../../../utils/formatters';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { toast } from '../../../../../utils/toast-manager';

// ============================================
// TYPES
// ============================================

interface DashboardStats {
  today: {
    totalSales: number;
    totalRevenue: number;
    averageTicket?: number;
  };
  week: {
    totalSales: number;
    totalRevenue: number;
  };
  month: {
    totalSales: number;
    totalRevenue: number;
  };
  allTime: {
    totalSales: number;
    totalRevenue: number;
    averageTicket?: number;
  };
  recentSales: any[];
  topProducts?: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  salesByHour?: Array<{ hour: number; sales: number; revenue: number }>;
  salesByDay?: Array<{ day: string; sales: number; revenue: number }>;
}

// ============================================
// SUB-COMPONENTS
// ============================================

const StatsCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  change?: number;
  subtext?: string;
}> = ({ title, value, icon: Icon, color, change, subtext }) => {
  const isPositive = change !== undefined ? change >= 0 : true;
  const colorClasses: Record<string, { bg: string; text: string }> = {
    brand: {
      bg: 'bg-brand-50 dark:bg-brand-900/20',
      text: 'text-brand-600 dark:text-brand-400',
    },
    'brand-accent': {
      bg: 'bg-brand-accent-50 dark:bg-brand-accent-900/20',
      text: 'text-brand-accent-600 dark:text-brand-accent-400',
    },
    secondary: {
      bg: 'bg-secondary-50 dark:bg-secondary-900/20',
      text: 'text-secondary-600 dark:text-secondary-400',
    },
    success: {
      bg: 'bg-success-50 dark:bg-success-900/20',
      text: 'text-success-600 dark:text-success-400',
    },
    warning: {
      bg: 'bg-warning-50 dark:bg-warning-900/20',
      text: 'text-warning-600 dark:text-warning-400',
    },
    danger: {
      bg: 'bg-danger-50 dark:bg-danger-900/20',
      text: 'text-danger-600 dark:text-danger-400',
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-brand p-6 hover:shadow-card-hover transition-shadow"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
            {value}
          </p>
          {subtext && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {subtext}
            </p>
          )}
        </div>
        <div
          className={`p-3 rounded-lg ${
            colorClasses[color]?.bg || 'bg-gray-100 dark:bg-gray-700'
          }`}
        >
          <Icon
            className={`w-6 h-6 ${
              colorClasses[color]?.text || 'text-gray-600 dark:text-gray-400'
            }`}
          />
        </div>
      </div>
      {change !== undefined && change !== 0 && (
        <div className="flex items-center gap-1 mt-3">
          {isPositive ? (
            <ArrowUpRight className="w-4 h-4 text-success-500" />
          ) : (
            <ArrowDownRight className="w-4 h-4 text-danger-500" />
          )}
          <span
            className={`text-sm font-medium tabular-nums ${
              isPositive ? 'text-success-500' : 'text-danger-500'
            }`}
          >
            {Math.abs(change)}%
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            vs last period
          </span>
        </div>
      )}
    </motion.div>
  );
};

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
      icon: Loader2,
    },
    CANCELLED: {
      label: 'Cancelled',
      color:
        'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
      icon: X,
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
      icon: X,
    },
    RETURNED: {
      label: 'Returned',
      color:
        'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300',
      icon: AlertCircle,
    },
  };

  const config = statusConfig[status] || statusConfig.PENDING;
  const Icon = config.icon;

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${config.color}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

const RevenueChart: React.FC<{
  data: Array<{ day: string; revenue: number; sales: number }>;
}> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <p>No data available</p>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
  const minRevenue = Math.min(...data.map((d) => d.revenue));

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex items-end gap-2">
        {data.map((item, index) => (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-brand-500 dark:bg-brand-400 rounded-t transition-all duration-500 hover:bg-brand-600 dark:hover:bg-brand-300"
              style={{
                height: `${(item.revenue / maxRevenue) * 80}%`,
                minHeight: '4px',
              }}
              title={`${item.day}: ${formatCurrency(item.revenue)} (${
                item.sales
              } sales)`}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {item.day.slice(0, 3)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-400 dark:text-gray-500 tabular-nums">
        <span>${minRevenue.toFixed(0)}</span>
        <span>${maxRevenue.toFixed(0)}</span>
      </div>
    </div>
  );
};

/**
 * Compact inline hint showing the promotion / loyalty attribution of
 * a sale. Returns `null` when the sale has neither, so it can be
 * rendered unconditionally.
 */
const BreakdownHint: React.FC<{ sale: any }> = ({ sale }) => {
  if (!saleService.hasBreakdown(sale)) return null;

  const breakdown = saleService.extractBreakdown(sale);
  const hasPromotion = (breakdown.promotionDiscount ?? 0) > 0;
  const hasLoyalty = (breakdown.loyaltyPointsUsed ?? 0) > 0;
  const label = saleService.describeBreakdown(sale);

  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-1"
      title={label}
    >
      {hasPromotion && <Tag className="w-3 h-3 text-brand-500 shrink-0" />}
      {hasLoyalty && (
        <Star className="w-3 h-3 text-warning-500 fill-current shrink-0" />
      )}
      <span className="truncate max-w-[200px]">{label}</span>
    </span>
  );
};

/**
 * Expanded breakdown block for the sale detail modal.
 */
const BreakdownPanel: React.FC<{ sale: any }> = ({ sale }) => {
  if (!saleService.hasBreakdown(sale)) return null;

  const breakdown = saleService.extractBreakdown(sale);
  const hasPromotion = (breakdown.promotionDiscount ?? 0) > 0;
  const hasLoyalty = (breakdown.loyaltyPointsUsed ?? 0) > 0;

  const promotionLabel = breakdown.discountType
    ? getDiscountTypeLabel(breakdown.discountType) || 'Discount'
    : 'Discount';

  return (
    <section
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-3 space-y-1.5"
      aria-label="Discount breakdown"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
        <Sparkles className="w-3 h-3 text-brand-500" />
        Discount Breakdown
      </p>

      {hasPromotion && (
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Tag className="w-3.5 h-3.5 text-brand-500 shrink-0" />
            <span>{promotionLabel}</span>
            {breakdown.promotionCode && (
              <code className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-[10px] font-mono tabular-nums">
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

export default function SalesDashboard() {
  const { user } = useAuth();
  const { canView } = usePermission();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timeRange, setTimeRange] = useState<
    'today' | 'week' | 'month' | 'year'
  >('today');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf'>(
    'csv'
  );
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const canViewStats =
    canView?.(`${PermissionResource.SALE}:view_stats`) ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ADMIN' ||
    user?.role === 'MANAGER' ||
    false;

  // Navigation handlers
  const goToSalesList = () => {
    router.push('/admin/sales');
  };

  const goToPos = () => {
    router.push('/admin/sales/pos');
  };

  useEffect(() => {
    if (canViewStats) {
      loadDashboardData();
    }
  }, [timeRange, canViewStats]);

  const loadDashboardData = useCallback(
    async (silent = false) => {
      if (!canViewStats) return;

      try {
        if (!silent) setLoading(true);
        else setRefreshing(true);

        const data = await saleService.getDashboardSalesData({
          businessUnitId: user?.businessUnits?.[0]?.businessUnitId,
        });

        setStats({
          today: {
            totalSales: data?.today?.totalSales || 0,
            totalRevenue: data?.today?.totalRevenue || 0,
            averageTicket: data?.today?.averageTicket || 0,
          },
          week: {
            totalSales: data?.week?.totalSales || 0,
            totalRevenue: data?.week?.totalRevenue || 0,
          },
          month: {
            totalSales: data?.month?.totalSales || 0,
            totalRevenue: data?.month?.totalRevenue || 0,
          },
          allTime: {
            totalSales: data?.allTime?.totalSales || 0,
            totalRevenue: data?.allTime?.totalRevenue || 0,
            averageTicket: data?.allTime?.averageTicket || 0,
          },
          recentSales: data?.recentSales || [],
          topProducts: data?.topProducts || [],
          salesByHour: data?.salesByHour || [],
          salesByDay: data?.salesByDay || [],
        });
      } catch (error) {
        console.error('Failed to load dashboard:', error);
        toast.error('Failed to load sales dashboard');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, canViewStats]
  );

  const handleExport = async () => {
    try {
      const now = new Date();
      let startDate = new Date();
      const endDate = new Date();

      switch (timeRange) {
        case 'today':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'year':
          startDate = new Date(now);
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      const result = await saleService.exportSales({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        format: exportFormat,
        businessUnitId: user?.businessUnits?.[0]?.businessUnitId,
      });

      const rowsData: any[] = (result as any)?.data || [];
      if (rowsData.length === 0) {
        toast.error('No data to export');
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
      const rows = rowsData.map((sale: any) => {
        const b = saleService.extractBreakdown(sale);
        return [
          sale.receiptNumber || sale.id,
          sale.date || sale.saleDate || '',
          sale.customer || 'Guest',
          sale.subtotal || 0,
          sale.tax || 0,
          sale.discount || 0,
          b.discountType ?? '',
          b.promotionCode ?? '',
          b.promotionDiscount ?? 0,
          b.loyaltyPointsUsed ?? 0,
          b.loyaltyDiscount ?? 0,
          sale.total || 0,
          sale.paymentMethod || 'N/A',
          sale.status || 'COMPLETED',
          sale.items || 0,
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map((row: any[]) => row.join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales-report-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Sales report exported successfully');
      setShowExportModal(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export sales report');
    }
  };

  const handleViewSale = (sale: any) => {
    setSelectedSale(sale);
    setShowDetailModal(true);
  };

  const handlePrintReceipt = (sale: any) => {
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
        ? `<div class="row"><span>Promotion${
            promotionCode ? ` (${promotionCode})` : ''
          }</span><span>-${formatCurrency(promotionDiscount)}</span></div>`
        : '';

    const loyaltyLine =
      loyaltyPointsUsed > 0
        ? `<div class="row"><span>${loyaltyPointsUsed} loyalty points</span><span>-${formatCurrency(loyaltyDiscount)}</span></div>`
        : '';

    const rawDiscountLine =
      sale.discount > 0 && promotionDiscount === 0 && loyaltyDiscount === 0
        ? `<div class="row"><span>Discount</span><span>-${formatCurrency(sale.discount)}</span></div>`
        : '';

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt #${sale.receiptNumber}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; max-width: 320px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 10px; margin-bottom: 10px; }
            .row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 13px; }
            .grand { font-weight: bold; font-size: 16px; border-top: 1px solid #333; padding-top: 8px; margin-top: 4px; }
            .items { margin: 10px 0; }
            .item { display: flex; justify-content: space-between; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h3>Receipt #${sale.receiptNumber}</h3>
            <p>${formatDate(sale.saleDate || sale.createdAt)}</p>
            <p>Customer: ${
              sale.customer
                ? `${sale.customer.firstName} ${sale.customer.lastName}`
                : 'Guest'
            }</p>
          </div>
          <div class="items">
            ${(sale.items || [])
              .map(
                (item: any) => `
              <div class="item">
                <span>${item.product?.name || 'Item'} × ${item.quantity}</span>
                <span>${formatCurrency(item.total)}</span>
              </div>
            `
              )
              .join('')}
          </div>
          <div>
            <div class="row"><span>Subtotal</span><span>${formatCurrency(sale.subtotal)}</span></div>
            <div class="row"><span>Tax</span><span>${formatCurrency(sale.tax)}</span></div>
            ${promotionLine}
            ${loyaltyLine}
            ${rawDiscountLine}
            <div class="row grand"><span>Total</span><span>${formatCurrency(sale.total)}</span></div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    toast.success('Receipt sent to printer');
  };

  if (!canViewStats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view sales statistics.
        </p>
        <button
          onClick={() => router.push('/admin/sales')}
          className="mt-4 px-6 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors focus-ring"
        >
          Go to Sales
        </button>
      </div>
    );
  }

  if (loading) {
    return <LoadingSkeleton />;
  }

  const getCurrentPeriodStats = () => {
    switch (timeRange) {
      case 'today':
        return (
          stats?.today || {
            totalRevenue: 0,
            totalSales: 0,
            averageTicket: 0,
          }
        );
      case 'week':
        return stats?.week || { totalRevenue: 0, totalSales: 0 };
      case 'month':
        return stats?.month || { totalRevenue: 0, totalSales: 0 };
      case 'year':
        return (
          stats?.allTime || {
            totalRevenue: 0,
            totalSales: 0,
            averageTicket: 0,
          }
        );
      default:
        return (
          stats?.today || {
            totalRevenue: 0,
            totalSales: 0,
            averageTicket: 0,
          }
        );
    }
  };

  const periodStats = getCurrentPeriodStats();
  const topProducts = stats?.topProducts || [];
  const salesByDay = stats?.salesByDay || [];
  const recentSales = stats?.recentSales || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      {/* Navigation Bar */}
      <div className="card-brand p-3 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/admin/sales')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus-ring"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Sales</span>
          </button>
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 hidden sm:block"></div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            Sales Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPos}
            className="px-3 py-1.5 text-sm bg-success-600 text-white hover:bg-success-700 rounded-lg transition-colors flex items-center gap-1.5 focus-ring"
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline">POS</span>
          </button>
          <button
            onClick={goToSalesList}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-1.5 text-gray-700 dark:text-gray-300 focus-ring"
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Sales List</span>
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Sales Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time sales analytics and performance metrics
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex bg-white dark:bg-gray-800 rounded-lg shadow-sm p-1 border border-gray-200 dark:border-gray-700">
            {['today', 'week', 'month', 'year'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-ring ${
                  timeRange === range
                    ? 'bg-brand-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 flex items-center gap-2 transition-colors focus-ring"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2 transition-colors disabled:opacity-50 focus-ring"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Revenue"
          value={formatCurrency(periodStats.totalRevenue || 0)}
          icon={DollarSign}
          color="success"
          subtext={`${periodStats.totalSales || 0} sales`}
        />
        <StatsCard
          title="Sales"
          value={periodStats.totalSales || 0}
          icon={ShoppingBag}
          color="brand"
          subtext={`${
            periodStats.totalRevenue
              ? Math.round(
                  periodStats.totalRevenue / (periodStats.totalSales || 1)
                )
              : 0
          } avg per sale`}
        />
        <StatsCard
          title="Average Ticket"
          value={formatCurrency((periodStats as any).averageTicket || 0)}
          icon={BarChart3}
          color="secondary"
        />
        <StatsCard
          title="Customers"
          value={stats?.today?.totalSales || 0}
          icon={Users}
          color="brand-accent"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 card-brand p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Revenue Overview
            </h3>
            <button
              onClick={goToSalesList}
              className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 flex items-center gap-1 focus-ring rounded"
            >
              View Details <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="h-64">
            <RevenueChart data={salesByDay} />
          </div>
          <div className="flex justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            <span>
              Total Revenue: {formatCurrency(stats?.today?.totalRevenue || 0)}
            </span>
            <span>Total Sales: {stats?.today?.totalSales || 0}</span>
          </div>
        </div>

        {/* Top Products */}
        <div className="card-brand p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            Top Products
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto sidebar-scroll">
            {topProducts.length > 0 ? (
              topProducts.slice(0, 5).map((product, index) => (
                <div key={product.id} className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-full text-sm font-medium text-gray-600 dark:text-gray-400 tabular-nums">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      {product.quantity} sold
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(product.revenue)}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No product data available</p>
              </div>
            )}
          </div>
          {topProducts.length > 5 && (
            <button
              onClick={goToSalesList}
              className="mt-4 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 focus-ring rounded"
            >
              View all products →
            </button>
          )}
        </div>
      </div>

      {/* Recent Sales */}
      <div className="card-brand p-0 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-wrap justify-between items-center gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Recent Sales
          </h3>
          <button
            onClick={goToSalesList}
            className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 flex items-center gap-1 focus-ring rounded"
          >
            View All <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto sidebar-scroll">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Receipt
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                  Items
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                  Status
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                  Date
                </th>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentSales.slice(0, 10).map((sale) => (
                <tr
                  key={sale.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                  onClick={() => handleViewSale(sale)}
                >
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <span className="font-mono font-medium text-brand-600 dark:text-brand-400 tabular-nums">
                      #{sale.receiptNumber}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <span className="text-gray-900 dark:text-white">
                      {sale.customer?.firstName || 'Guest'}{' '}
                      {sale.customer?.lastName || ''}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400 hidden sm:table-cell tabular-nums">
                    {sale.items?.length || 0}
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap font-semibold text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(sale.total)}
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                    <StatusBadge status={sale.status} />
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                    {formatDate(sale.saleDate || sale.createdAt)}
                  </td>
                  <td
                    className="px-4 sm:px-6 py-4 whitespace-nowrap text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleViewSale(sale)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                    >
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => handlePrintReceipt(sale)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors ml-2 focus-ring"
                    >
                      <Printer className="w-4 h-4 text-gray-500" />
                    </button>
                  </td>
                </tr>
              ))}
              {recentSales.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No recent sales</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-modal p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Export Sales Report
                </h3>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Format
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['csv', 'excel', 'pdf'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setExportFormat(f as any)}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors focus-ring ${
                          exportFormat === f
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                            : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExport}
                    className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 focus-ring"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sale Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedSale && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-modal p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl sidebar-scroll"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                    Sale #{selectedSale.receiptNumber}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(selectedSale.saleDate || selectedSale.createdAt)}{' '}
                    at{' '}
                    {formatTime(
                      selectedSale.saleDate || selectedSale.createdAt
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <StatusBadge status={selectedSale.status} />
                  <span className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(selectedSale.total)}
                  </span>
                </div>

                {/* Breakdown hint */}
                <BreakdownHint sale={selectedSale} />

                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Customer
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedSale.customer
                        ? `${selectedSale.customer.firstName} ${selectedSale.customer.lastName}`
                        : 'Guest'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Payment
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedSale.payments?.[0]?.paymentMethod || 'N/A'}
                    </p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    Items
                  </h4>
                  <div className="space-y-2">
                    {selectedSale.items?.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center p-2 border border-gray-200 dark:border-gray-700 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {item.product?.name || 'Product'}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                            × {item.quantity}
                          </p>
                        </div>
                        <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                          {formatCurrency(item.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Discount Breakdown */}
                <BreakdownPanel sale={selectedSale} />

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="space-y-1 max-w-xs ml-auto">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        Subtotal
                      </span>
                      <span className="tabular-nums">
                        {formatCurrency(selectedSale.subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        Tax
                      </span>
                      <span className="tabular-nums">
                        {formatCurrency(selectedSale.tax)}
                      </span>
                    </div>

                    {(() => {
                      const b = saleService.extractBreakdown(selectedSale);
                      const hasPromotion = (b.promotionDiscount ?? 0) > 0;
                      const hasLoyalty = (b.loyaltyPointsUsed ?? 0) > 0;
                      const hasBreakdown = hasPromotion || hasLoyalty;
                      return (
                        <>
                          {hasPromotion && (
                            <div className="flex justify-between text-sm text-success-600 dark:text-success-400">
                              <span className="flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5" />
                                Promotion
                                {b.promotionCode && (
                                  <code className="px-1.5 py-0.5 rounded bg-success-100 dark:bg-success-950/40 text-[10px] font-mono">
                                    {b.promotionCode}
                                  </code>
                                )}
                              </span>
                              <span className="tabular-nums">
                                -{formatCurrency(b.promotionDiscount ?? 0)}
                              </span>
                            </div>
                          )}
                          {hasLoyalty && (
                            <div className="flex justify-between text-sm text-success-600 dark:text-success-400">
                              <span className="flex items-center gap-1.5">
                                <Star className="w-3.5 h-3.5 fill-current" />
                                <span className="tabular-nums">
                                  {b.loyaltyPointsUsed} loyalty points
                                </span>
                              </span>
                              <span className="tabular-nums">
                                -{formatCurrency(b.loyaltyDiscount ?? 0)}
                              </span>
                            </div>
                          )}
                          {selectedSale.discount > 0 && !hasBreakdown && (
                            <div className="flex justify-between text-sm text-success-600 dark:text-success-400">
                              <span>Discount</span>
                              <span className="tabular-nums">
                                -{formatCurrency(selectedSale.discount)}
                              </span>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span>Total</span>
                      <span className="text-brand-600 tabular-nums">
                        {formatCurrency(selectedSale.total)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => handlePrintReceipt(selectedSale)}
                    className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2 focus-ring"
                  >
                    <Printer className="w-4 h-4" /> Print
                  </button>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus-ring"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// LOADING SKELETON
// ============================================

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 animate-pulse">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
        </div>
        <div className="flex gap-3">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-48"></div>
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-24"></div>
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-24"></div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 h-32 border border-gray-200 dark:border-gray-700"
          ></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-6 h-80 border border-gray-200 dark:border-gray-700"></div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 h-80 border border-gray-200 dark:border-gray-700"></div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 h-96 border border-gray-200 dark:border-gray-700"></div>
    </div>
  );
}
