// packages/web/app/(dashboard)/admin/sales/reports/page.tsx

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  RefreshCw,
  Download,
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Users,
  Package,
  FileText,
  BarChart3,
  PieChart,
  LineChart,
  Clock,
  CreditCard,
} from 'lucide-react';
import { saleService } from '../../../../../services/saleService';
import { formatCurrency } from '../../../../../utils/formatters';
import { useAuth } from '../../../../../hooks/useAuth';
import { toast } from '../../../../../utils/toast-manager';

// ============================================
// INTERFACES
// ============================================

type GroupBy = 'day' | 'week' | 'month' | 'quarter' | 'year';

interface ReportFilter {
  dateRange:
    | 'today'
    | 'yesterday'
    | 'this_week'
    | 'last_week'
    | 'this_month'
    | 'last_month'
    | 'this_quarter'
    | 'last_quarter'
    | 'this_year'
    | 'custom';
  startDate: string;
  endDate: string;
  reportType: 'overview' | 'products' | 'trends' | 'payments';
  groupBy: GroupBy;
  format: 'csv' | 'excel' | 'pdf' | 'json';
}

interface SalesReportData {
  summary: {
    totalRevenue: number;
    totalSales: number;
    averageTicket: number;
    totalItems: number;
    uniqueCustomers: number;
    totalTax: number;
    totalDiscount: number;
    growthRate: number;
  };
  trends: Array<{
    period: string;
    revenue: number;
    sales: number;
    average: number;
  }>;
  topProducts: Array<{
    id: string;
    name: string;
    sku: string;
    quantity: number;
    revenue: number;
    percentage: number;
  }>;
  paymentMethods: Array<{
    method: string;
    count: number;
    total: number;
    percentage: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    revenue: number;
    percentage: number;
  }>;
  hourDistribution: Array<{
    hour: number;
    sales: number;
    revenue: number;
  }>;
}

// ============================================
// HELPERS
// ============================================

const toIso = (d: Date): string => d.toISOString().split('T')[0];

/** Map the UI's groupBy to what `getAggregatedSales` accepts. */
const toAggregateGroupBy = (
  group: GroupBy
): 'hour' | 'day' | 'week' | 'month' => {
  if (group === 'quarter' || group === 'year') return 'month';
  return group;
};

const getGroupByLabel = (group: string): string => {
  const labels: Record<string, string> = {
    day: 'Daily',
    week: 'Weekly',
    month: 'Monthly',
    quarter: 'Quarterly',
    year: 'Yearly',
  };
  return labels[group] || group;
};

const humanizePaymentMethod = (method: string): string =>
  method.replace(/_/g, ' ');

// ============================================
// MAIN COMPONENT
// ============================================

export default function SalesReportsPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { user: authUser } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [reportData, setReportData] = useState<SalesReportData | null>(null);

  const [filters, setFilters] = useState<ReportFilter>({
    dateRange: 'this_month',
    startDate: toIso(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    ),
    endDate: toIso(new Date()),
    reportType: 'overview',
    groupBy: 'day',
    format: 'csv',
  });

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf'>(
    'csv'
  );
  const [activeTab, setActiveTab] = useState<
    'overview' | 'trends' | 'products' | 'payments'
  >('overview');

  const userRole = ((authUser?.role as string) || 'EMPLOYEE').toUpperCase();
  const canViewReports = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userRole);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/login?redirect=/admin/sales/reports');
      return;
    }
    if (isLoaded && isSignedIn && !canViewReports) {
      router.push('/admin/sales');
      toast.error('You do not have permission to view reports');
    }
  }, [isLoaded, isSignedIn, router, canViewReports]);

  // ============================================
  // GENERATE
  // ============================================
  //
  // Composed entirely from endpoints the backend exposes under
  // `/api/sales/*`. Nothing here hits a fictional `/api/reports/*`.

  const generateReport = useCallback(async () => {
    if (!authUser) return;

    try {
      setGenerating(true);
      setLoading(true);

      const startIso = new Date(`${filters.startDate}T00:00:00.000Z`);
      const endIso = new Date(`${filters.endDate}T23:59:59.999Z`);

      // ── Parallel fetches ────────────────────────────────────
      const [
        stats,
        analytics,
        aggregated,
        paymentMethods,
        summary,
      ] = await Promise.all([
        saleService
          .getSalesStats({
            startDate: startIso.toISOString(),
            endDate: endIso.toISOString(),
          })
          .catch((err) => {
            console.warn('getSalesStats failed:', err);
            return null;
          }),

        saleService
          .getSalesAnalytics({
            startDate: startIso.toISOString(),
            endDate: endIso.toISOString(),
          })
          .catch((err) => {
            console.warn('getSalesAnalytics failed:', err);
            return null;
          }),

        saleService
          .getAggregatedSales({
            startDate: startIso.toISOString(),
            endDate: endIso.toISOString(),
            groupBy: toAggregateGroupBy(filters.groupBy),
          })
          .catch((err) => {
            console.warn('getAggregatedSales failed:', err);
            return [];
          }),

        saleService
          .getSalesByPaymentMethod({
            startDate: startIso.toISOString(),
            endDate: endIso.toISOString(),
          })
          .catch((err) => {
            console.warn('getSalesByPaymentMethod failed:', err);
            return [];
          }),

        saleService
          .getSalesSummary({
            period: 'month',
            date: endIso.toISOString(),
          })
          .catch((err) => {
            console.warn('getSalesSummary failed:', err);
            return null;
          }),
      ]);

      // ── Growth rate via compare ─────────────────────────────
      const periodMs = endIso.getTime() - startIso.getTime();
      const prevStart = new Date(startIso.getTime() - periodMs);
      const prevEnd = new Date(startIso.getTime() - 1);

      const comparison = await saleService
        .getSalesComparison({
          period1Start: prevStart.toISOString(),
          period1End: prevEnd.toISOString(),
          period2Start: startIso.toISOString(),
          period2End: endIso.toISOString(),
        })
        .catch((err) => {
          console.warn('getSalesComparison failed:', err);
          return null;
        });

      const growthRate =
        (comparison as any)?.percentageChange?.revenue ?? 0;

      // ── Build the report payload ────────────────────────────
      const totalRevenue = (stats as any)?.totalRevenue ?? 0;
      const totalSales = (stats as any)?.totalSales ?? 0;
      const averageTicket = (stats as any)?.averageTicket ?? 0;
      const totalItems = (stats as any)?.totalItemsSold ?? 0;
      const uniqueCustomers = (stats as any)?.totalCustomers ?? 0;
      const totalTax = (stats as any)?.totalTax ?? 0;
      const totalDiscount = (stats as any)?.totalDiscount ?? 0;

      const trends = Array.isArray(aggregated)
        ? aggregated.map((row: any) => ({
            period: row.group || row.date || '',
            revenue: row.revenue ?? 0,
            sales: row.sales ?? 0,
            average: row.average ?? 0,
          }))
        : [];

      const rawTopProducts = Array.isArray((stats as any)?.topProducts)
        ? (stats as any).topProducts
        : [];
      const topProductsRevenue = rawTopProducts.reduce(
        (sum: number, p: any) => sum + (p._sum?.total ?? p.total ?? 0),
        0
      );
      const topProducts = rawTopProducts.map((p: any) => {
        const revenue = p._sum?.total ?? p.total ?? 0;
        return {
          id: p.productId ?? p.id,
          name: p.productName ?? p.name ?? 'Unknown',
          sku: p.productSku ?? p.sku ?? 'N/A',
          quantity: p._sum?.quantity ?? p.quantity ?? 0,
          revenue,
          percentage:
            topProductsRevenue > 0
              ? Math.round((revenue / topProductsRevenue) * 1000) / 10
              : 0,
        };
      });

      const totalPaymentRevenue = Array.isArray(paymentMethods)
        ? paymentMethods.reduce((sum: number, m: any) => sum + (m.total ?? 0), 0)
        : 0;
      const normalizedPaymentMethods = Array.isArray(paymentMethods)
        ? paymentMethods.map((m: any) => ({
            method: humanizePaymentMethod(m.paymentMethod ?? m.method ?? 'OTHER'),
            count: m.count ?? 0,
            total: m.total ?? 0,
            percentage:
              m.percentage ??
              (totalPaymentRevenue > 0
                ? Math.round(((m.total ?? 0) / totalPaymentRevenue) * 1000) / 10
                : 0),
          }))
        : [];

      const rawCategoryBreakdown = Array.isArray(
        (summary as any)?.categoryBreakdown
      )
        ? (summary as any).categoryBreakdown
        : [];
      const totalCategoryRevenue = rawCategoryBreakdown.reduce(
        (sum: number, c: any) => sum + (c.revenue ?? 0),
        0
      );
      const categoryBreakdown = rawCategoryBreakdown.map((c: any) => ({
        category: c.categoryName ?? c.categoryId ?? c.name ?? 'Uncategorized',
        revenue: c.revenue ?? 0,
        percentage:
          totalCategoryRevenue > 0
            ? Math.round(((c.revenue ?? 0) / totalCategoryRevenue) * 1000) / 10
            : 0,
      }));

      const hourDistribution = Array.isArray((analytics as any)?.peakHours)
        ? (analytics as any).peakHours.map((h: any) => ({
            hour: h.hour ?? 0,
            sales: h.sales ?? 0,
            revenue: h.revenue ?? 0,
          }))
        : Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            sales: 0,
            revenue: 0,
          }));

      setReportData({
        summary: {
          totalRevenue,
          totalSales,
          averageTicket,
          totalItems,
          uniqueCustomers,
          totalTax,
          totalDiscount,
          growthRate,
        },
        trends,
        topProducts,
        paymentMethods: normalizedPaymentMethods,
        categoryBreakdown,
        hourDistribution,
      });
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast.error(error?.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  }, [authUser, filters]);

  useEffect(() => {
    generateReport();
  }, [generateReport]);

  // ============================================
  // DATE RANGE
  // ============================================

  const handleDateRangeChange = (range: string) => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (range) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'yesterday':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'this_week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - startDate.getDay());
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'last_week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - startDate.getDay() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'this_quarter': {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      }
      case 'last_quarter': {
        const lastQuarter = Math.floor((now.getMonth() - 3) / 3);
        startDate = new Date(now.getFullYear(), lastQuarter * 3, 1);
        endDate = new Date(now.getFullYear(), lastQuarter * 3 + 3, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      }
      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'custom':
        return;
      default:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
    }

    setFilters((prev) => ({
      ...prev,
      dateRange: range as ReportFilter['dateRange'],
      startDate: toIso(startDate),
      endDate: toIso(endDate),
    }));
  };

  // ============================================
  // EXPORT — via the real sales export endpoint
  // ============================================

  const handleDownload = async () => {
    try {
      setDownloading(true);

      const result = await saleService.exportSales({
        startDate: filters.startDate,
        endDate: filters.endDate,
        format: exportFormat,
      });

      // The backend returns `{ data: [...], format, total, ... }` for
      // JSON, or a raw list for other formats. Normalise to a CSV
      // string when we didn't get a Blob back.
      const rowsData: any[] =
        (result as any)?.data || (Array.isArray(result) ? result : []);

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
      const rows = rowsData.map((sale: any) => [
        sale.receiptNumber ?? sale.id ?? '',
        sale.date ??
          (sale.saleDate
            ? new Date(sale.saleDate).toISOString().split('T')[0]
            : ''),
        sale.customer ?? 'Guest',
        (sale.subtotal ?? 0).toFixed(2),
        (sale.tax ?? 0).toFixed(2),
        (sale.discount ?? 0).toFixed(2),
        (sale.total ?? 0).toFixed(2),
        sale.paymentMethod ?? 'N/A',
        sale.status ?? 'COMPLETED',
        String(sale.items ?? sale.totalQuantity ?? 0),
      ]);

      const csv = [
        headers.join(','),
        ...rows.map((row: (string | number)[]) => row.join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension =
        exportFormat === 'csv'
          ? 'csv'
          : exportFormat === 'excel'
          ? 'xlsx'
          : 'pdf';
      a.download = `sales-report-${toIso(new Date())}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Report downloaded successfully');
      setShowExportModal(false);
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error?.message || 'Failed to download report');
    } finally {
      setDownloading(false);
    }
  };

  // ============================================
  // RENDER GUARDS
  // ============================================

  if (loading || generating) {
    return <LoadingSkeleton />;
  }

  if (!authUser || !canViewReports) {
    return null;
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'trends', label: 'Trends', icon: LineChart },
    { id: 'products', label: 'Top Products', icon: Package },
    { id: 'payments', label: 'Payments', icon: CreditCard },
  ] as const;

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
                  Sales Reports
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Generate and analyze sales performance reports
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => generateReport()}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50 focus-ring"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {generating ? 'Generating...' : 'Refresh Report'}
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              disabled={!reportData}
              className="flex items-center gap-2 px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors disabled:opacity-50 focus-ring"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card-brand p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date Range
              </label>
              <select
                value={filters.dateRange}
                onChange={(e) => handleDateRangeChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="this_week">This Week</option>
                <option value="last_week">Last Week</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="this_quarter">This Quarter</option>
                <option value="last_quarter">Last Quarter</option>
                <option value="this_year">This Year</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            {filters.dateRange === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Group By
              </label>
              <select
                value={filters.groupBy}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    groupBy: e.target.value as GroupBy,
                  }))
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="quarter">Quarterly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {reportData && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
            <SummaryCard
              title="Total Revenue"
              value={formatCurrency(reportData.summary.totalRevenue)}
              change={reportData.summary.growthRate}
              icon={DollarSign}
              color="brand"
            />
            <SummaryCard
              title="Total Sales"
              value={reportData.summary.totalSales}
              icon={ShoppingBag}
              color="success"
            />
            <SummaryCard
              title="Average Ticket"
              value={formatCurrency(reportData.summary.averageTicket)}
              icon={TrendingUp}
              color="secondary"
            />
            <SummaryCard
              title="Items Sold"
              value={reportData.summary.totalItems}
              icon={Package}
              color="brand-accent"
            />
            <SummaryCard
              title="Customers"
              value={reportData.summary.uniqueCustomers}
              icon={Users}
              color="secondary"
            />
            <SummaryCard
              title="Total Tax"
              value={formatCurrency(reportData.summary.totalTax)}
              icon={FileText}
              color="warning"
            />
            <SummaryCard
              title="Total Discount"
              value={formatCurrency(reportData.summary.totalDiscount)}
              icon={TrendingDown}
              color="danger"
            />
          </div>
        )}

        {/* Tabs */}
        {reportData && (
          <div className="mb-6">
            <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 focus-ring ${
                    activeTab === tab.id
                      ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content */}
        {reportData && (
          <div className="space-y-6">
            {activeTab === 'overview' && <OverviewTab data={reportData} />}
            {activeTab === 'trends' && (
              <TrendsTab data={reportData} groupBy={filters.groupBy} />
            )}
            {activeTab === 'products' && <ProductsTab data={reportData} />}
            {activeTab === 'payments' && <PaymentsTab data={reportData} />}
          </div>
        )}
      </div>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <ExportModal
            onClose={() => setShowExportModal(false)}
            onExport={handleDownload}
            format={exportFormat}
            setFormat={setExportFormat}
            downloading={downloading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface SummaryCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  color: string;
}

function SummaryCard({
  title,
  value,
  change,
  icon: Icon,
  color,
}: SummaryCardProps) {
  const colors: Record<string, string> = {
    brand: 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400',
    'brand-accent':
      'bg-brand-accent-50 dark:bg-brand-accent-900/20 text-brand-accent-600 dark:text-brand-accent-400',
    secondary:
      'bg-secondary-50 dark:bg-secondary-900/20 text-secondary-600 dark:text-secondary-400',
    success:
      'bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400',
    warning:
      'bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400',
    danger:
      'bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-brand p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {title}
        </p>
        <div className={`p-2 rounded-lg ${colors[color] || colors.brand}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
        {value}
      </p>
      {change !== undefined && change !== null && change !== 0 && (
        <div
          className={`flex items-center gap-1 mt-1 text-xs tabular-nums ${
            change >= 0 ? 'text-success-500' : 'text-danger-500'
          }`}
        >
          {change >= 0 ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          <span>{Math.abs(change).toFixed(1)}% vs previous</span>
        </div>
      )}
    </motion.div>
  );
}

function OverviewTab({ data }: { data: SalesReportData }) {
  const maxHourlyRevenue = Math.max(
    ...data.hourDistribution.map((h) => h.revenue),
    1
  );

  return (
    <div className="space-y-6">
      {/* Category Breakdown */}
      {data.categoryBreakdown.length > 0 && (
        <div className="card-brand p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-success-500" />
            Category Breakdown
          </h3>
          <div className="space-y-3">
            {data.categoryBreakdown.map((category) => (
              <div
                key={category.category}
                className="flex items-center gap-4"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-32 truncate">
                  {category.category}
                </span>
                <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all duration-500"
                    style={{ width: `${category.percentage}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap tabular-nums">
                  {formatCurrency(category.revenue)}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400 w-12 text-right tabular-nums">
                  {category.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hour Distribution */}
      <div className="card-brand p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-brand-accent-500" />
          Hourly Distribution
        </h3>
        <div className="grid grid-cols-6 md:grid-cols-12 lg:grid-cols-24 gap-1">
          {data.hourDistribution.map((hour) => (
            <div key={hour.hour} className="text-center">
              <div
                className="mx-auto rounded-sm bg-brand-500 dark:bg-brand-400 transition-all duration-500 hover:bg-brand-600 dark:hover:bg-brand-500"
                style={{
                  height: `${Math.max(
                    4,
                    (hour.revenue / maxHourlyRevenue) * 100
                  )}px`,
                  width: '100%',
                }}
                title={`${hour.sales} sales · ${formatCurrency(hour.revenue)}`}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
                {hour.hour}:00
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrendsTab({
  data,
  groupBy,
}: {
  data: SalesReportData;
  groupBy: string;
}) {
  return (
    <div className="card-brand p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <LineChart className="w-5 h-5 text-brand-500" />
        {getGroupByLabel(groupBy)} Trends
      </h3>
      {data.trends.length === 0 ? (
        <p className="text-center py-8 text-gray-500 dark:text-gray-400">
          No trend data available for this period.
        </p>
      ) : (
        <div className="overflow-x-auto sidebar-scroll">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Sales
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Average
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Change
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.trends.map((trend, index) => {
                const prevRevenue =
                  index > 0 ? data.trends[index - 1].revenue : trend.revenue;
                const change =
                  prevRevenue > 0
                    ? ((trend.revenue - prevRevenue) / prevRevenue) * 100
                    : 0;
                return (
                  <tr
                    key={trend.period}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {trend.period}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white tabular-nums">
                      {formatCurrency(trend.revenue)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400 tabular-nums">
                      {trend.sales}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400 tabular-nums">
                      {formatCurrency(trend.average)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums">
                      <span
                        className={
                          change >= 0 ? 'text-success-500' : 'text-danger-500'
                        }
                      >
                        {change >= 0 ? '+' : ''}
                        {change.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProductsTab({ data }: { data: SalesReportData }) {
  return (
    <div className="card-brand p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Package className="w-5 h-5 text-success-500" />
        Top Products
      </h3>
      {data.topProducts.length === 0 ? (
        <p className="text-center py-8 text-gray-500 dark:text-gray-400">
          No product data available for this period.
        </p>
      ) : (
        <div className="overflow-x-auto sidebar-scroll">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  %
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.topProducts.map((product, index) => (
                <tr
                  key={product.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {product.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {product.sku}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400 tabular-nums">
                    {product.quantity}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(product.revenue)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-brand-600 dark:text-brand-400 tabular-nums">
                    {product.percentage}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PaymentsTab({ data }: { data: SalesReportData }) {
  return (
    <div className="card-brand p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-brand-500" />
        Payment Methods
      </h3>
      {data.paymentMethods.length === 0 ? (
        <p className="text-center py-8 text-gray-500 dark:text-gray-400">
          No payment data available for this period.
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {data.paymentMethods.map((method) => (
            <div
              key={method.method}
              className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center"
            >
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 truncate">
                {method.method}
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(method.total)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                {method.count} transactions
              </p>
              <p className="text-xs text-brand-600 dark:text-brand-400 tabular-nums">
                {method.percentage.toFixed(1)}%
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ExportModalProps {
  onClose: () => void;
  onExport: () => void;
  format: 'csv' | 'excel' | 'pdf';
  setFormat: (value: 'csv' | 'excel' | 'pdf') => void;
  downloading: boolean;
}

function ExportModal({
  onClose,
  onExport,
  format,
  setFormat,
  downloading,
}: ExportModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-modal"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Export Report
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['csv', 'excel', 'pdf'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors focus-ring ${
                    format === f
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
              onClick={onClose}
              disabled={downloading}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onExport}
              disabled={downloading}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2 disabled:opacity-50 focus-ring"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {downloading ? 'Downloading...' : 'Export'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 h-24"
          ></div>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 h-16 mb-6"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 h-20"
          ></div>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 h-64"></div>
    </div>
  );
}
