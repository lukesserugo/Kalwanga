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
  Check,
  X,
  Loader2,
  Users,
  DollarSign,
  Package,
  FileText,
  CreditCard,
  Calendar,
  Filter,
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
  Mail,
  Send,
  Edit,
  Trash2,
  MoreVertical,
  FileSpreadsheet,
  FileImage,
  Building,
  MapPin,
  Phone,
  Globe,
  Hash,
  Percent,
  Calculator
} from 'lucide-react';
import { saleService } from '../../../../../services/saleService';
import { formatCurrency, formatDate, formatDateTime } from '../../../../../utils/formatters';
import { useAuth } from '../../../../../hooks/useAuth';
import { toast } from '../../../../../utils/toast-manager';
import { FilePdf } from '../../../../../components/icons/FilePdf';

// ============================================
// INTERFACES
// ============================================

interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  discount?: number;
  taxRate?: number;
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
  customerCompany?: string;
  customerTaxId?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'void';
  paymentTerms: 'net_7' | 'net_15' | 'net_30' | 'net_60' | 'due_on_receipt';
  dueDate: string;
  notes?: string;
  terms?: string;
  createdAt: string;
  sentAt?: string;
  paidAt?: string;
  paidBy?: string;
  paymentMethod?: string;
  currency: string;
  taxRate: number;
  discountRate?: number;
  businessUnitId: string;
  businessUnitName?: string;
  businessUnitAddress?: string;
  businessUnitPhone?: string;
  businessUnitEmail?: string;
  businessUnitTaxId?: string;
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
// API SERVICE FUNCTIONS
// ============================================

const invoiceService = {
  async getAllInvoices(params: InvoiceFilters): Promise<{ data: Invoice[]; total: number; page: number; totalPages: number }> {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append('search', params.search);
    if (params.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.page) queryParams.append('page', String(params.page));
    if (params.limit) queryParams.append('limit', String(params.limit));
    
    const url = `/api/invoices?${queryParams.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch invoices');
    }
    return response.json();
  },

  async getInvoiceById(id: string): Promise<Invoice> {
    const response = await fetch(`/api/invoices/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch invoice');
    }
    return response.json();
  },

  async sendInvoice(id: string): Promise<Invoice> {
    const response = await fetch(`/api/invoices/${id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error('Failed to send invoice');
    }
    return response.json();
  },

  async markAsPaid(id: string, paymentMethod?: string): Promise<Invoice> {
    const response = await fetch(`/api/invoices/${id}/paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod }),
    });
    if (!response.ok) {
      throw new Error('Failed to mark invoice as paid');
    }
    return response.json();
  },

  async voidInvoice(id: string, reason?: string): Promise<Invoice> {
    const response = await fetch(`/api/invoices/${id}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) {
      throw new Error('Failed to void invoice');
    }
    return response.json();
  },

  async cancelInvoice(id: string, reason?: string): Promise<Invoice> {
    const response = await fetch(`/api/invoices/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) {
      throw new Error('Failed to cancel invoice');
    }
    return response.json();
  },

  async getInvoiceStats(params?: { startDate?: string; endDate?: string }): Promise<InvoiceStats> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    
    const url = `/api/invoices/stats?${queryParams.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch invoice stats');
    }
    return response.json();
  },

  async exportInvoices(params: { startDate?: string; endDate?: string; format?: 'csv' | 'excel' | 'pdf' }): Promise<Blob> {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.format) queryParams.append('format', params.format);
    
    const url = `/api/invoices/export?${queryParams.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to export invoices');
    }
    return response.blob();
  },

  async downloadInvoicePdf(id: string): Promise<Blob> {
    const response = await fetch(`/api/invoices/${id}/pdf`);
    if (!response.ok) {
      throw new Error('Failed to download invoice PDF');
    }
    return response.blob();
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400',
    sent: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    paid: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    overdue: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    cancelled: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    void: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400',
  };
  return colors[status] || 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400';
};

const getStatusIcon = (status: string) => {
  const icons: Record<string, any> = {
    draft: FileText,
    sent: Send,
    paid: CheckCircle,
    overdue: AlertCircle,
    cancelled: XCircle,
    void: XCircle,
  };
  return icons[status] || AlertCircle;
};

const StatusIcon = ({ status }: { status: string }) => {
  const Icon = getStatusIcon(status);
  return <Icon className="w-4 h-4 inline mr-1" />;
};

const getPaymentTermsLabel = (terms: string): string => {
  const labels: Record<string, string> = {
    net_7: 'Net 7',
    net_15: 'Net 15',
    net_30: 'Net 30',
    net_60: 'Net 60',
    due_on_receipt: 'Due on Receipt',
  };
  return labels[terms] || terms;
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
  const [stats, setStats] = useState<InvoiceStats>({
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
  });
  
  const [filters, setFilters] = useState<InvoiceFilters>({
    search: '',
    status: 'all',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Check user permissions
  const userRole = authUser?.role as string || 'EMPLOYEE';
  const canManageInvoices = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userRole);
  const canViewInvoices = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'CASHIER'].includes(userRole);

  // Redirect if not authorized
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

  // Fetch invoices
  const fetchInvoices = useCallback(async (silent = false) => {
    if (!authUser) return;

    try {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);

      const result = await invoiceService.getAllInvoices(filters);
      setInvoices(result.data || []);
      setTotalInvoices(result.total || 0);
      setTotalPages(result.totalPages || 1);
      
      // Fetch stats
      const statsData = await invoiceService.getInvoiceStats({
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
      setStats(statsData);

    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      toast.error(error.message || 'Failed to load invoices');
      setInvoices([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [authUser, filters]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }));
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }));
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setFilters(prev => ({ ...prev, [field]: value, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const handleSendInvoice = async () => {
    if (!selectedInvoice) return;
    
    try {
      setProcessing(true);
      await invoiceService.sendInvoice(selectedInvoice.id);
      toast.success('Invoice sent successfully');
      setShowSendModal(false);
      fetchInvoices();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invoice');
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!selectedInvoice) return;
    
    try {
      setProcessing(true);
      await invoiceService.markAsPaid(selectedInvoice.id, paymentMethod);
      toast.success('Invoice marked as paid');
      setShowPaidModal(false);
      fetchInvoices();
    } catch (error: any) {
      toast.error(error.message || 'Failed to mark invoice as paid');
    } finally {
      setProcessing(false);
    }
  };

  const handleVoidInvoice = async () => {
    if (!selectedInvoice || !voidReason.trim()) return;
    
    try {
      setProcessing(true);
      await invoiceService.voidInvoice(selectedInvoice.id, voidReason);
      toast.success('Invoice voided successfully');
      setShowVoidModal(false);
      setVoidReason('');
      fetchInvoices();
    } catch (error: any) {
      toast.error(error.message || 'Failed to void invoice');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!selectedInvoice || !cancelReason.trim()) return;
    
    try {
      setProcessing(true);
      await invoiceService.cancelInvoice(selectedInvoice.id, cancelReason);
      toast.success('Invoice cancelled successfully');
      setShowCancelModal(false);
      setCancelReason('');
      fetchInvoices();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel invoice');
    } finally {
      setProcessing(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await invoiceService.exportInvoices({
        startDate: filters.startDate,
        endDate: filters.endDate,
        format: 'csv',
      });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Invoices exported successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to export invoices');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadPdf = async (invoice: Invoice) => {
    try {
      setDownloadingPdf(true);
      const blob = await invoiceService.downloadInvoicePdf(invoice.id);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice.invoiceNumber}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Invoice PDF downloaded');
    } catch (error: any) {
      toast.error(error.message || 'Failed to download invoice PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Loading state
  if (loading) {
    return <LoadingSkeleton />;
  }

  // Permission check
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
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <StatCard title="Total" value={stats.total} color="blue" />
          <StatCard title="Draft" value={stats.draft} color="gray" />
          <StatCard title="Sent" value={stats.sent} color="blue" />
          <StatCard title="Paid" value={stats.paid} color="green" />
          <StatCard title="Overdue" value={stats.overdue} color="red" />
          <StatCard title="Cancelled" value={stats.cancelled} color="yellow" />
          <StatCard title="Total Amount" value={formatCurrency(stats.totalAmount)} color="blue" isCurrency />
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Paid</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(stats.totalPaid)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Balance Due</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(stats.totalBalance)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Average Invoice</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {formatCurrency(stats.averageInvoice)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by invoice #, receipt, customer..."
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
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
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
              onClick={() => fetchInvoices()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {/* Invoices List */}
        {invoices.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center border border-gray-200 dark:border-gray-700">
            <div className="text-6xl mb-4">📄</div>
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No Invoices Found</h2>
            <p className="text-gray-500 dark:text-gray-400">
              {filters.search || filters.status !== 'all'
                ? 'No invoices match your search criteria.'
                : "No invoices have been created yet."}
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
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all overflow-hidden border border-gray-200 dark:border-gray-700"
                  >
                    {/* Invoice Header */}
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                          #{invoice.invoiceNumber}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(invoice.createdAt)}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Due: {formatDate(invoice.dueDate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)} flex items-center gap-1`}>
                          <StatusIcon status={invoice.status} />
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {formatCurrency(invoice.total)}
                        </span>
                      </div>
                    </div>

                    {/* Invoice Body */}
                    <div className="p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {invoice.customerName}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="w-4 h-4" />
                              Receipt: #{invoice.receiptNumber}
                            </span>
                            <span className="flex items-center gap-1">
                              <Package className="w-4 h-4" />
                              {invoice.items.length} items
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs font-medium">
                              {getPaymentTermsLabel(invoice.paymentTerms)}
                            </span>
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs">
                              Balance: {formatCurrency(invoice.balanceDue)}
                            </span>
                            {invoice.notes && (
                              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs">
                                📝 {invoice.notes}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowDetailModal(true);
                            }}
                            className="px-3 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            Details
                          </button>
                          <button
                            onClick={() => handleDownloadPdf(invoice)}
                            disabled={downloadingPdf}
                            className="px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            <FilePdf className="w-4 h-4" />
                            PDF
                          </button>
                          {canManageInvoices && invoice.status === 'draft' && (
                            <button
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setShowSendModal(true);
                              }}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors flex items-center gap-1"
                            >
                              <Send className="w-4 h-4" />
                              Send
                            </button>
                          )}
                          {canManageInvoices && invoice.status === 'sent' && (
                            <button
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setShowPaidModal(true);
                              }}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors flex items-center gap-1"
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
                  onClick={() => handlePageChange(Math.max(1, filters.page - 1))}
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
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => handlePageChange(Math.min(totalPages, filters.page + 1))}
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
              setShowVoidModal(true);
            }}
            onCancel={() => {
              setShowDetailModal(false);
              setShowCancelModal(true);
            }}
            onDownloadPdf={handleDownloadPdf}
            canManage={canManageInvoices}
            downloadingPdf={downloadingPdf}
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
// HELPER COMPONENTS
// ============================================

function StatCard({ title, value, color, isCurrency = false }: { title: string; value: number | string; color: string; isCurrency?: boolean }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-600 dark:text-blue-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
    gray: 'text-gray-600 dark:text-gray-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <p className={`text-xl font-bold ${colors[color] || 'text-gray-900 dark:text-white'}`}>
        {value}
      </p>
    </div>
  );
}

function DetailModal({ 
  invoiceData, 
  onClose, 
  onSend, 
  onPaid, 
  onVoid, 
  onCancel,
  onDownloadPdf,
  canManage,
  downloadingPdf
}: any) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Invoice #{invoiceData.invoiceNumber}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatDateTime(invoiceData.createdAt)}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <XCircle className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status and Total */}
          <div className="flex items-center justify-between">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(invoiceData.status)} flex items-center gap-2`}>
              <StatusIcon status={invoiceData.status} />
              {invoiceData.status.charAt(0).toUpperCase() + invoiceData.status.slice(1)}
            </span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(invoiceData.total)}
            </span>
          </div>

          {/* Business Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Business</p>
              <p className="font-medium text-gray-900 dark:text-white">{invoiceData.businessUnitName || 'N/A'}</p>
              {invoiceData.businessUnitAddress && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{invoiceData.businessUnitAddress}</p>
              )}
              {invoiceData.businessUnitPhone && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{invoiceData.businessUnitPhone}</p>
              )}
              {invoiceData.businessUnitEmail && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{invoiceData.businessUnitEmail}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Customer</p>
              <p className="font-medium text-gray-900 dark:text-white">{invoiceData.customerName}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{invoiceData.customerEmail}</p>
              {invoiceData.customerPhone && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{invoiceData.customerPhone}</p>
              )}
              {invoiceData.customerCompany && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{invoiceData.customerCompany}</p>
              )}
            </div>
          </div>

          {/* Invoice Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Receipt</p>
              <p className="font-medium text-gray-900 dark:text-white">#{invoiceData.receiptNumber}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Payment Terms</p>
              <p className="font-medium text-gray-900 dark:text-white">{getPaymentTermsLabel(invoiceData.paymentTerms)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Due Date</p>
              <p className="font-medium text-gray-900 dark:text-white">{formatDate(invoiceData.dueDate)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Currency</p>
              <p className="font-medium text-gray-900 dark:text-white">{invoiceData.currency}</p>
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Items</h3>
            <div className="space-y-2">
              {invoiceData.items.map((item: InvoiceItem) => (
                <div key={item.id} className="flex justify-between items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{item.productName}</p>
                    <div className="flex flex-wrap gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>SKU: {item.sku}</span>
                      <span>× {item.quantity}</span>
                      {item.discount && item.discount > 0 && (
                        <span className="text-green-600 dark:text-green-400">Discount: {item.discount}%</span>
                      )}
                    </div>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white">
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
                <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                <span className="text-gray-900 dark:text-white">{formatCurrency(invoiceData.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Tax ({invoiceData.taxRate}%)</span>
                <span className="text-gray-900 dark:text-white">{formatCurrency(invoiceData.tax)}</span>
              </div>
              {invoiceData.discount > 0 && (
                <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                  <span>Discount</span>
                  <span>-{formatCurrency(invoiceData.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-900 dark:text-white">Total</span>
                <span className="text-blue-600 dark:text-blue-400">{formatCurrency(invoiceData.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Paid</span>
                <span className="text-green-600 dark:text-green-400">{formatCurrency(invoiceData.paidAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold text-sm pt-1 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-700 dark:text-gray-300">Balance Due</span>
                <span className="text-orange-600 dark:text-orange-400">{formatCurrency(invoiceData.balanceDue)}</span>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          {(invoiceData.notes || invoiceData.terms) && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
              {invoiceData.notes && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Notes</p>
                  <p className="text-gray-700 dark:text-gray-300">{invoiceData.notes}</p>
                </div>
              )}
              {invoiceData.terms && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Terms & Conditions</p>
                  <p className="text-gray-700 dark:text-gray-300">{invoiceData.terms}</p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => onDownloadPdf(invoiceData)}
              disabled={downloadingPdf}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
            >
              {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePdf className="w-4 h-4" />}
              {downloadingPdf ? 'Downloading...' : 'Download PDF'}
            </button>
            <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2">
              <Printer className="w-4 h-4" />
              Print
            </button>
            {canManage && invoiceData.status === 'draft' && (
              <button
                onClick={onSend}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send Invoice
              </button>
            )}
            {canManage && invoiceData.status === 'sent' && (
              <button
                onClick={onPaid}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Mark as Paid
              </button>
            )}
            {canManage && invoiceData.status !== 'paid' && invoiceData.status !== 'cancelled' && invoiceData.status !== 'void' && (
              <>
                <button
                  onClick={onVoid}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Void
                </button>
                <button
                  onClick={onCancel}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </>
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

function SendModal({ invoiceData, onClose, onConfirm, processing }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Send Invoice
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Send invoice #{invoiceData.invoiceNumber} to {invoiceData.customerEmail}?
          <br />
          <span className="text-sm">
            Total amount: {formatCurrency(invoiceData.total)}
          </span>
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={processing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {processing ? 'Sending...' : 'Send Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaidModal({ invoiceData, onClose, onConfirm, paymentMethod, setPaymentMethod, processing }: any) {
  const methods = ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'GIFT_CARD'];
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
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
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {methods.map((method) => (
              <option key={method} value={method}>
                {method.replace('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
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
            disabled={processing}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {processing ? 'Processing...' : 'Confirm Paid'}
          </button>
        </div>
      </div>
    </div>
  );
}

function VoidModal({ invoiceData, onClose, onConfirm, reason, setReason, processing }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Void Invoice
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to void invoice #{invoiceData.invoiceNumber}?
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
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            {processing ? 'Voiding...' : 'Confirm Void'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CancelModal({ invoiceData, onClose, onConfirm, reason, setReason, processing }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Cancel Invoice
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to cancel invoice #{invoiceData.invoiceNumber}?
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Reason for Cancellation <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Enter reason for cancellation..."
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
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2 disabled:opacity-50"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            {processing ? 'Cancelling...' : 'Confirm Cancel'}
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
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 h-20"></div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 h-20"></div>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 h-16 mb-6"></div>
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 h-32"></div>
        ))}
      </div>
    </div>
  );
}
