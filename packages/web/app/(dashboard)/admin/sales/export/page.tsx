'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Download,
  RefreshCw,
  Loader2,
  Calendar,
  Filter,
  FileText,
  FileSpreadsheet,
  FileJson,
  FileImage,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Mail,
  Send,
  Copy,
  Check,
  Share2,
  User,
  Package,
  DollarSign,
  Users,
  ShoppingBag,
  CreditCard,
  Banknote,
  Wallet,
  Smartphone,
  Gift,
  Building,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  LineChart,
  CalendarDays,
  Globe,
  MapPin,
  Phone,
  Zap,
  Star,
  Award,
  Target,
  Flame
} from 'lucide-react';
import { saleService } from '../../../../../services/saleService';
import { formatCurrency, formatDate, formatDateTime } from '../../../../../utils/formatters';
import { useAuth } from '../../../../../hooks/useAuth';
import { toast } from '../../../../../utils/toast-manager';

// ============================================
// INTERFACES
// ============================================

interface ExportFilter {
  dateRange: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'custom';
  startDate: string;
  endDate: string;
  businessUnitId?: string;
  exportType: 'sales' | 'revenue' | 'products' | 'customers' | 'payment_methods' | 'tax' | 'inventory' | 'all';
  format: 'csv' | 'excel' | 'pdf' | 'json' | 'xml';
  includeHeaders: boolean;
  includeSummary: boolean;
  includeCharts: boolean;
  fileName?: string;
  emailTo?: string;
  schedule: 'now' | 'daily' | 'weekly' | 'monthly';
  scheduleTime?: string;
  scheduleDay?: string;
}

interface ExportHistory {
  id: string;
  fileName: string;
  format: string;
  size: number;
  status: 'completed' | 'processing' | 'failed' | 'scheduled';
  createdAt: string;
  downloadedAt?: string;
  downloadUrl?: string;
  errorMessage?: string;
}

interface ExportStats {
  totalExports: number;
  totalSize: number;
  lastExportDate: string;
  popularFormat: string;
  dailyExports: Array<{ date: string; count: number }>;
}

// ============================================
// API SERVICE FUNCTIONS
// ============================================

const exportService = {
  async exportSales(params: ExportFilter): Promise<Blob> {
    const queryParams = new URLSearchParams();
    queryParams.append('dateRange', params.dateRange);
    queryParams.append('exportType', params.exportType);
    queryParams.append('format', params.format);
    queryParams.append('includeHeaders', String(params.includeHeaders));
    queryParams.append('includeSummary', String(params.includeSummary));
    queryParams.append('includeCharts', String(params.includeCharts));
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.businessUnitId) queryParams.append('businessUnitId', params.businessUnitId);
    if (params.fileName) queryParams.append('fileName', params.fileName);
    
    const url = `/api/export/sales?${queryParams.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to export sales');
    }
    return response.blob();
  },

  async scheduleExport(params: ExportFilter): Promise<{ id: string; message: string }> {
    const response = await fetch('/api/export/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      throw new Error('Failed to schedule export');
    }
    return response.json();
  },

  async getExportHistory(params?: { page?: number; limit?: number }): Promise<{ data: ExportHistory[]; total: number; page: number; totalPages: number }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.limit) queryParams.append('limit', String(params.limit));
    
    const url = `/api/export/history?${queryParams.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch export history');
    }
    return response.json();
  },

  async getExportStats(): Promise<ExportStats> {
    const response = await fetch('/api/export/stats');
    if (!response.ok) {
      throw new Error('Failed to fetch export stats');
    }
    return response.json();
  },

  async sendExportEmail(id: string, email: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`/api/export/${id}/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      throw new Error('Failed to send export email');
    }
    return response.json();
  },

  async deleteExport(id: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`/api/export/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete export');
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

const getExportTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    sales: 'Sales Data',
    revenue: 'Revenue Data',
    products: 'Product Performance',
    customers: 'Customer Analytics',
    payment_methods: 'Payment Methods',
    tax: 'Tax Report',
    inventory: 'Inventory Report',
    all: 'Comprehensive Export',
  };
  return labels[type] || type;
};

const getFormatIcon = (format: string) => {
  const icons: Record<string, any> = {
    csv: FileText,
    excel: FileSpreadsheet,
    pdf: FileText,
    json: FileJson,
    xml: FileJson,
  };
  return icons[format] || FileText;
};

const getFormatLabel = (format: string): string => {
  return format.toUpperCase();
};

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    completed: 'text-green-500 bg-green-100 dark:bg-green-900/20',
    processing: 'text-blue-500 bg-blue-100 dark:bg-blue-900/20',
    failed: 'text-red-500 bg-red-100 dark:bg-red-900/20',
    scheduled: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/20',
  };
  return colors[status] || 'text-gray-500 bg-gray-100 dark:bg-gray-700/50';
};

const getStatusIcon = (status: string) => {
  const icons: Record<string, any> = {
    completed: CheckCircle,
    processing: RefreshCw,
    failed: XCircle,
    scheduled: Clock,
  };
  return icons[status] || AlertCircle;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function SalesExportPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { user: authUser } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState<ExportHistory[]>([]);
  const [stats, setStats] = useState<ExportStats | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedExport, setSelectedExport] = useState<ExportHistory | null>(null);
  const [emailAddress, setEmailAddress] = useState('');
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'export' | 'history'>('export');
  
  const [filters, setFilters] = useState<ExportFilter>({
    dateRange: 'this_month',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    exportType: 'all',
    format: 'csv',
    includeHeaders: true,
    includeSummary: true,
    includeCharts: false,
    schedule: 'now',
  });

  // Check user permissions
  const userRole = authUser?.role as string || 'EMPLOYEE';
  const canExport = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userRole);

  // Redirect if not authorized
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/login?redirect=/admin/sales/export');
      return;
    }
    if (isLoaded && isSignedIn && !canExport) {
      router.push('/admin/sales');
      toast.error('You do not have permission to export data');
    }
  }, [isLoaded, isSignedIn, router, canExport]);

  // Load data
  const loadData = useCallback(async () => {
    if (!authUser) return;

    try {
      setLoading(true);
      const [statsData, historyData] = await Promise.all([
        exportService.getExportStats(),
        exportService.getExportHistory({ page: historyPage, limit: 10 })
      ]);
      setStats(statsData);
      setHistory(historyData.data || []);
      setHistoryTotal(historyData.total || 0);
      setHistoryTotalPages(historyData.totalPages || 1);
    } catch (error: any) {
      console.error('Error loading export data:', error);
      toast.error(error.message || 'Failed to load export data');
    } finally {
      setLoading(false);
    }
  }, [authUser, historyPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
        return;
      default:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
    }

    setFilters((prev: ExportFilter) => ({
      ...prev,
      dateRange: range as any,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    }));
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await exportService.exportSales(filters);
      
      const extension = filters.format === 'csv' ? 'csv' : 
                        filters.format === 'excel' ? 'xlsx' : 
                        filters.format === 'pdf' ? 'pdf' :
                        filters.format === 'json' ? 'json' : 'xml';
      
      const fileName = filters.fileName || 
        `sales-export-${new Date().toISOString().split('T')[0]}.${extension}`;
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Sales data exported successfully');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const handleScheduleExport = async () => {
    try {
      setProcessing(true);
      const result = await exportService.scheduleExport(filters);
      toast.success(result.message || 'Export scheduled successfully');
      setShowScheduleModal(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to schedule export');
    } finally {
      setProcessing(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedExport || !emailAddress) return;
    
    try {
      setProcessing(true);
      const result = await exportService.sendExportEmail(selectedExport.id, emailAddress);
      toast.success(result.message || 'Export sent via email');
      setShowEmailModal(false);
      setEmailAddress('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send export email');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteExport = async (id: string) => {
    if (!confirm('Are you sure you want to delete this export?')) return;
    
    try {
      await exportService.deleteExport(id);
      toast.success('Export deleted successfully');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete export');
    }
  };

  const handleDownloadExport = async (exportItem: ExportHistory) => {
    try {
      setProcessing(true);
      if (exportItem.downloadUrl) {
        window.open(exportItem.downloadUrl, '_blank');
        toast.success('Download started');
        return;
      }
      
      toast.info('Regenerating export...');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to download export');
    } finally {
      setProcessing(false);
    }
  };

  // Loading state
  if (loading) {
    return <LoadingSkeleton />;
  }

  // Permission check
  if (!authUser || !canExport) {
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
                  Export Sales
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Export sales data in various formats
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Total Exports"
              value={stats.totalExports}
              icon={FileText}
              color="blue"
            />
            <StatCard
              title="Total Size"
              value={formatFileSize(stats.totalSize)}
              icon={Package}
              color="green"
            />
            <StatCard
              title="Last Export"
              value={stats.lastExportDate ? formatDate(stats.lastExportDate) : 'Never'}
              icon={Calendar}
              color="purple"
            />
            <StatCard
              title="Popular Format"
              value={stats.popularFormat.toUpperCase()}
              icon={getFormatIcon(stats.popularFormat)}
              color="orange"
            />
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
            {[
              { id: 'export', label: 'Export Data', icon: Download },
              { id: 'history', label: 'Export History', icon: Clock },
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

        {/* Tab Content */}
        {activeTab === 'export' ? (
          <ExportForm
            filters={filters}
            setFilters={setFilters}
            handleDateRangeChange={handleDateRangeChange}
            handleExport={handleExport}
            handleSchedule={() => setShowScheduleModal(true)}
            exporting={exporting}
          />
        ) : (
          <HistoryTab
            history={history}
            historyPage={historyPage}
            historyTotalPages={historyTotalPages}
            onPageChange={setHistoryPage}
            onDownload={handleDownloadExport}
            onEmail={(item: ExportHistory) => {
              setSelectedExport(item);
              setEmailAddress('');
              setShowEmailModal(true);
            }}
            onDelete={handleDeleteExport}
          />
        )}
      </div>

      {/* Schedule Modal */}
      <AnimatePresence>
        {showScheduleModal && (
          <ScheduleModal
            filters={filters}
            setFilters={setFilters}
            onClose={() => setShowScheduleModal(false)}
            onConfirm={handleScheduleExport}
            processing={processing}
          />
        )}
      </AnimatePresence>

      {/* Email Modal */}
      <AnimatePresence>
        {showEmailModal && selectedExport && (
          <EmailModal
            exportItem={selectedExport}
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
    </div>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

function StatCard({ title, value, icon: Icon, color }: any) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
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
    </motion.div>
  );
}

function ExportForm({ filters, setFilters, handleDateRangeChange, handleExport, handleSchedule, exporting }: any) {
  const exportTypes = [
    { value: 'sales', label: 'Sales Data', icon: ShoppingBag },
    { value: 'revenue', label: 'Revenue Data', icon: DollarSign },
    { value: 'products', label: 'Product Performance', icon: Package },
    { value: 'customers', label: 'Customer Analytics', icon: Users },
    { value: 'payment_methods', label: 'Payment Methods', icon: CreditCard },
    { value: 'tax', label: 'Tax Report', icon: FileText },
    { value: 'inventory', label: 'Inventory Report', icon: Package },
    { value: 'all', label: 'Comprehensive Export', icon: FileSpreadsheet },
  ];

  const formats = [
    { value: 'csv', label: 'CSV', icon: FileText },
    { value: 'excel', label: 'Excel', icon: FileSpreadsheet },
    { value: 'pdf', label: 'PDF', icon: FileText },
    { value: 'json', label: 'JSON', icon: FileJson },
    { value: 'xml', label: 'XML', icon: FileJson },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Export Configuration
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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

          {/* Export Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Export Type
            </label>
            <select
              value={filters.exportType}
              onChange={(e) => setFilters((prev: ExportFilter) => ({ ...prev, exportType: e.target.value as any }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {exportTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Format
            </label>
            <select
              value={filters.format}
              onChange={(e) => setFilters((prev: ExportFilter) => ({ ...prev, format: e.target.value as any }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {formats.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label}
                </option>
              ))}
            </select>
          </div>

          {/* File Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              File Name (Optional)
            </label>
            <input
              type="text"
              placeholder="sales-export"
              value={filters.fileName || ''}
              onChange={(e) => setFilters((prev: ExportFilter) => ({ ...prev, fileName: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Leave blank for auto-generated name
            </p>
          </div>
        </div>

        {/* Custom Date Range */}
        {filters.dateRange === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters((prev: ExportFilter) => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters((prev: ExportFilter) => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.includeHeaders}
              onChange={(e) => setFilters((prev: ExportFilter) => ({ ...prev, includeHeaders: e.target.checked }))}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Include Headers</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.includeSummary}
              onChange={(e) => setFilters((prev: ExportFilter) => ({ ...prev, includeSummary: e.target.checked }))}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Include Summary</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.includeCharts}
              onChange={(e) => setFilters((prev: ExportFilter) => ({ ...prev, includeCharts: e.target.checked }))}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Include Charts (PDF only)</span>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-lg font-medium"
        >
          {exporting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Download className="w-5 h-5" />
          )}
          {exporting ? 'Exporting...' : 'Export Now'}
        </button>
        <button
          onClick={handleSchedule}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-lg font-medium"
        >
          <Clock className="w-5 h-5" />
          Schedule Export
        </button>
      </div>
    </div>
  );
}

function HistoryTab({ history, historyPage, historyTotalPages, onPageChange, onDownload, onEmail, onDelete }: any) {
  if (history.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center border border-gray-200 dark:border-gray-700">
        <div className="text-6xl mb-4">📂</div>
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No Export History</h2>
        <p className="text-gray-500 dark:text-gray-400">
          Your exported files will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                File Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Format
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {history.map((item: ExportHistory) => {
              const StatusIcon = getStatusIcon(item.status);
              return (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.fileName}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs font-medium">
                      {item.format.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {formatFileSize(item.size || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                      <StatusIcon className="w-3 h-3" />
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDateTime(item.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      {item.status === 'completed' && (
                        <>
                          <button
                            onClick={() => onDownload(item)}
                            className="p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors text-blue-600 dark:text-blue-400"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onEmail(item)}
                            className="p-1 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors text-purple-600 dark:text-purple-400"
                            title="Email"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => onDelete(item.id)}
                        className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors text-red-600 dark:text-red-400"
                        title="Delete"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {historyTotalPages > 1 && (
        <div className="flex flex-wrap justify-center items-center gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => onPageChange(Math.max(1, historyPage - 1))}
            disabled={historyPage === 1}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-300"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {historyPage} of {historyTotalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(historyTotalPages, historyPage + 1))}
            disabled={historyPage === historyTotalPages}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-300"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function ScheduleModal({ filters, setFilters, onClose, onConfirm, processing }: { 
  filters: ExportFilter;
  setFilters: React.Dispatch<React.SetStateAction<ExportFilter>>;
  onClose: () => void;
  onConfirm: () => void;
  processing: boolean;
}) {
  const scheduleOptions = [
    { value: 'now', label: 'Now (One-time)' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ];

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Schedule Export
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Schedule
            </label>
            <select
              value={filters.schedule}
              onChange={(e) => setFilters((prev: ExportFilter) => ({ ...prev, schedule: e.target.value as any }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {scheduleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {filters.schedule !== 'now' && (
            <>
              {filters.schedule === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Day of Week
                  </label>
                  <select
                    value={filters.scheduleDay || 'Monday'}
                    onChange={(e) => setFilters((prev: ExportFilter) => ({ ...prev, scheduleDay: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {daysOfWeek.map((day) => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Time
                </label>
                <input
                  type="time"
                  value={filters.scheduleTime || '09:00'}
                  onChange={(e) => setFilters((prev: ExportFilter) => ({ ...prev, scheduleTime: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Notifications
                </label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={filters.emailTo || ''}
                  onChange={(e) => setFilters((prev: ExportFilter) => ({ ...prev, emailTo: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Receive notifications when export is ready
                </p>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={processing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
              {processing ? 'Scheduling...' : 'Schedule Export'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailModal({ exportItem, emailAddress, setEmailAddress, onClose, onConfirm, processing }: { 
  exportItem: ExportHistory;
  emailAddress: string;
  setEmailAddress: React.Dispatch<React.SetStateAction<string>>;
  onClose: () => void;
  onConfirm: () => void;
  processing: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Send Export via Email
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Send export "{exportItem.fileName}" via email
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
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {processing ? 'Sending...' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4"></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 h-20"></div>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 h-64"></div>
    </div>
  );
}
