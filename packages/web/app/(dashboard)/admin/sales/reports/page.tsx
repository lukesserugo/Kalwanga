'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Search,
  RefreshCw,
  Download,
  Loader2,
  Calendar,
  Filter,
  BarChart3,
  PieChart,
  LineChart,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Users,
  Package,
  FileText,
  FileSpreadsheet,
  Printer,
  Eye,
  ChevronDown,
  ChevronRight,
  XCircle,
  CheckCircle,
  Clock,
  AlertCircle,
  CreditCard,
  Banknote,
  Wallet,
  Smartphone,
  Gift,
  Building,
  Mail,
  Send,
  Copy,
  Check,
  Share2,
  Globe,
  MapPin,
  Phone,
  User,
  CalendarDays,
  ChartBar,
  ChartPie,
  ChartLine,
  Activity,
  Target,
  Award,
  Star,
  Zap,
  Flame
} from 'lucide-react';
import { saleService } from '../../../../../services/saleService';
import { formatCurrency, formatDate, formatDateTime } from '../../../../../utils/formatters';
import { useAuth } from '../../../../../hooks/useAuth';
import { toast } from '../../../../../utils/toast-manager';
import { FilePdf } from '../../../../../components/icons/FilePdf';

// ============================================
// INTERFACES
// ============================================

interface ReportFilter {
  dateRange: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'custom';
  startDate: string;
  endDate: string;
  businessUnitId?: string;
  reportType: 'sales' | 'revenue' | 'products' | 'customers' | 'payment_methods' | 'tax' | 'comprehensive';
  groupBy: 'day' | 'week' | 'month' | 'quarter' | 'year';
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
  topCustomers: Array<{
    id: string;
    name: string;
    email: string;
    totalSpent: number;
    orderCount: number;
    averageTicket: number;
  }>;
  paymentMethods: Array<{
    method: string;
    count: number;
    total: number;
    percentage: number;
  }>;
  dailyStats: Array<{
    date: string;
    revenue: number;
    sales: number;
    average: number;
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
// API SERVICE FUNCTIONS
// ============================================

const reportService = {
  async generateReport(filters: ReportFilter): Promise<SalesReportData> {
    const queryParams = new URLSearchParams();
    queryParams.append('dateRange', filters.dateRange);
    queryParams.append('reportType', filters.reportType);
    queryParams.append('groupBy', filters.groupBy);
    queryParams.append('format', filters.format);
    if (filters.startDate) queryParams.append('startDate', filters.startDate);
    if (filters.endDate) queryParams.append('endDate', filters.endDate);
    if (filters.businessUnitId) queryParams.append('businessUnitId', filters.businessUnitId);
    
    const url = `/api/reports/sales?${queryParams.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to generate report');
    }
    return response.json();
  },

  async downloadReport(filters: ReportFilter): Promise<Blob> {
    const queryParams = new URLSearchParams();
    queryParams.append('dateRange', filters.dateRange);
    queryParams.append('reportType', filters.reportType);
    queryParams.append('groupBy', filters.groupBy);
    queryParams.append('format', filters.format);
    if (filters.startDate) queryParams.append('startDate', filters.startDate);
    if (filters.endDate) queryParams.append('endDate', filters.endDate);
    if (filters.businessUnitId) queryParams.append('businessUnitId', filters.businessUnitId);
    
    const url = `/api/reports/sales/download?${queryParams.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to download report');
    }
    return response.blob();
  },

  async getReportFormats(): Promise<string[]> {
    const response = await fetch('/api/reports/formats');
    if (!response.ok) {
      throw new Error('Failed to fetch report formats');
    }
    return response.json();
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const getDateRangeLabel = (range: string): string => {
  const labels: Record<string, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    this_week: 'This Week',
    last_week: 'Last Week',
    this_month: 'This Month',
    last_month: 'Last Month',
    this_quarter: 'This Quarter',
    last_quarter: 'Last Quarter',
    this_year: 'This Year',
    custom: 'Custom Range',
  };
  return labels[range] || range;
};

const getReportTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    sales: 'Sales Report',
    revenue: 'Revenue Report',
    products: 'Product Performance',
    customers: 'Customer Analytics',
    payment_methods: 'Payment Methods',
    tax: 'Tax Report',
    comprehensive: 'Comprehensive Report',
  };
  return labels[type] || type;
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

const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

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
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reportType: 'comprehensive',
    groupBy: 'day',
    format: 'csv',
  });
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf'>('csv');
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'products' | 'customers'>('overview');

  // Check user permissions
  const userRole = authUser?.role as string || 'EMPLOYEE';
  const canViewReports = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userRole);

  // Redirect if not authorized
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

  // Generate report
  const generateReport = useCallback(async () => {
    if (!authUser) return;

    try {
      setGenerating(true);
      const data = await reportService.generateReport(filters);
      setReportData(data);
      toast.success('Report generated successfully');
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast.error(error.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  }, [authUser, filters]);

  useEffect(() => {
    generateReport();
  }, [generateReport]);

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
      case 'this_quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'last_quarter':
        const lastQuarter = Math.floor((now.getMonth() - 3) / 3);
        const lastQuarterYear = now.getFullYear();
        startDate = new Date(lastQuarterYear, lastQuarter * 3, 1);
        endDate = new Date(lastQuarterYear, lastQuarter * 3 + 3, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'custom':
        // Keep existing custom dates
        return;
      default:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
    }

    setFilters(prev => ({
      ...prev,
      dateRange: range as any,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    }));
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const blob = await reportService.downloadReport({
        ...filters,
        format: exportFormat,
      });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension = exportFormat === 'csv' ? 'csv' : exportFormat === 'excel' ? 'xlsx' : 'pdf';
      a.download = `sales-report-${new Date().toISOString().split('T')[0]}.${extension}`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Report downloaded successfully');
      setShowExportModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to download report');
    } finally {
      setDownloading(false);
    }
  };

  // Loading state
  if (loading || generating) {
    return <LoadingSkeleton />;
  }

  // Permission check
  if (!authUser || !canViewReports) {
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
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date Range
              </label>
              <select
                value={filters.dateRange}
                onChange={(e) => handleDateRangeChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Report Type
              </label>
              <select
                value={filters.reportType}
                onChange={(e) => setFilters(prev => ({ ...prev, reportType: e.target.value as any }))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="sales">Sales Report</option>
                <option value="revenue">Revenue Report</option>
                <option value="products">Product Performance</option>
                <option value="customers">Customer Analytics</option>
                <option value="payment_methods">Payment Methods</option>
                <option value="tax">Tax Report</option>
                <option value="comprehensive">Comprehensive Report</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Group By
              </label>
              <select
                value={filters.groupBy}
                onChange={(e) => setFilters(prev => ({ ...prev, groupBy: e.target.value as any }))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
              color="blue"
            />
            <SummaryCard
              title="Total Sales"
              value={reportData.summary.totalSales}
              icon={ShoppingBag}
              color="green"
            />
            <SummaryCard
              title="Average Ticket"
              value={formatCurrency(reportData.summary.averageTicket)}
              icon={TrendingUp}
              color="purple"
            />
            <SummaryCard
              title="Items Sold"
              value={reportData.summary.totalItems}
              icon={Package}
              color="orange"
            />
            <SummaryCard
              title="Customers"
              value={reportData.summary.uniqueCustomers}
              icon={Users}
              color="indigo"
            />
            <SummaryCard
              title="Total Tax"
              value={formatCurrency(reportData.summary.totalTax)}
              icon={FileText}
              color="yellow"
            />
            <SummaryCard
              title="Total Discount"
              value={formatCurrency(reportData.summary.totalDiscount)}
              icon={TrendingDown}
              color="red"
            />
          </div>
        )}

        {/* Tabs */}
        {reportData && (
          <div className="mb-6">
            <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'trends', label: 'Trends', icon: LineChart },
                { id: 'products', label: 'Top Products', icon: Package },
                { id: 'customers', label: 'Top Customers', icon: Users },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
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
            {activeTab === 'overview' && (
              <OverviewTab data={reportData} />
            )}
            {activeTab === 'trends' && (
              <TrendsTab data={reportData} groupBy={filters.groupBy} />
            )}
            {activeTab === 'products' && (
              <ProductsTab data={reportData} />
            )}
            {activeTab === 'customers' && (
              <CustomersTab data={reportData} />
            )}
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
// HELPER COMPONENTS
// ============================================

function SummaryCard({ title, value, change, icon: Icon, color }: any) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      {change !== undefined && change !== null && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>{Math.abs(change)}% vs previous</span>
        </div>
      )}
    </motion.div>
  );
}

function OverviewTab({ data }: { data: SalesReportData }) {
  return (
    <div className="space-y-6">
      {/* Payment Methods */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-blue-500" />
          Payment Methods
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {data.paymentMethods.map((method) => (
            <div key={method.method} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{method.method}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(method.total)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{method.count} transactions</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">{method.percentage}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <PieChart className="w-5 h-5 text-green-500" />
          Category Breakdown
        </h3>
        <div className="space-y-3">
          {data.categoryBreakdown.map((category) => (
            <div key={category.category} className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-32 truncate">
                {category.category}
              </span>
              <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${category.percentage}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                {formatCurrency(category.revenue)}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 w-12 text-right">
                {category.percentage}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Hour Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-orange-500" />
          Hourly Distribution
        </h3>
        <div className="grid grid-cols-6 md:grid-cols-12 lg:grid-cols-24 gap-1">
          {data.hourDistribution.map((hour) => (
            <div key={hour.hour} className="text-center">
              <div
                className="mx-auto rounded-sm bg-blue-600 dark:bg-blue-500 transition-all duration-500 hover:bg-blue-700 dark:hover:bg-blue-600"
                style={{
                  height: `${Math.max(4, (hour.revenue / Math.max(...data.hourDistribution.map(h => h.revenue))) * 100)}px`,
                  width: '100%',
                }}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{hour.hour}:00</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrendsTab({ data, groupBy }: { data: SalesReportData; groupBy: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <LineChart className="w-5 h-5 text-blue-500" />
        {getGroupByLabel(groupBy)} Trends
      </h3>
      <div className="overflow-x-auto">
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
              const prevRevenue = index > 0 ? data.trends[index - 1].revenue : trend.revenue;
              const change = prevRevenue > 0 ? ((trend.revenue - prevRevenue) / prevRevenue) * 100 : 0;
              return (
                <tr key={trend.period} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {trend.period}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                    {formatCurrency(trend.revenue)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">
                    {trend.sales}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">
                    {formatCurrency(trend.average)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={change >= 0 ? 'text-green-500' : 'text-red-500'}>
                      {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductsTab({ data }: { data: SalesReportData }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Package className="w-5 h-5 text-green-500" />
        Top Products
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                #</th>
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
              <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{index + 1}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                  {product.name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{product.sku}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">
                  {product.quantity}
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                  {formatCurrency(product.revenue)}
                </td>
                <td className="px-4 py-3 text-sm text-right text-blue-600 dark:text-blue-400">
                  {product.percentage}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomersTab({ data }: { data: SalesReportData }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-purple-500" />
        Top Customers
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Orders
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Total Spent
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Average
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.topCustomers.map((customer, index) => (
              <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{index + 1}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                  {customer.name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{customer.email}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">
                  {customer.orderCount}
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                  {formatCurrency(customer.totalSpent)}
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-500 dark:text-gray-400">
                  {formatCurrency(customer.averageTicket)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExportModal({ onClose, onExport, format, setFormat, downloading }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Export Report
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['csv', 'excel', 'pdf'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    format === f
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
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
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onExport}
              disabled={downloading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
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
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 h-24"></div>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 h-16 mb-6"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 h-20"></div>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 h-64"></div>
    </div>
  );
}
