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
  Banknote,
  Gift,
  Wallet,
  Calendar,
  Filter,
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3
} from 'lucide-react';
import { saleService } from '../../../../../services/saleService';
import { formatCurrency, formatDate, formatDateTime } from '../../../../../utils/formatters';
import { useAuth } from '../../../../../hooks/useAuth';
import { toast } from '../../../../../utils/toast-manager';

// ============================================
// INTERFACES
// ============================================

interface RefundItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  reason: string;
}

interface Refund {
  id: string;
  refundNumber: string;
  saleId: string;
  receiptNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items: RefundItem[];
  subtotal: number;
  tax: number;
  total: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  refundMethod: 'cash' | 'credit' | 'store_credit' | 'original_payment' | 'bank_transfer';
  refundType: 'full' | 'partial';
  notes?: string;
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectedReason?: string;
  completedAt?: string;
  completedBy?: string;
}

interface RefundFilters {
  search: string;
  status: string;
  startDate: string;
  endDate: string;
  page: number;
  limit: number;
}

interface RefundStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  completed: number;
  cancelled: number;
  totalAmount: number;
  averageRefund: number;
  byMethod: {
    cash: number;
    credit: number;
    store_credit: number;
    original_payment: number;
    bank_transfer: number;
  };
}

// ============================================
// API SERVICE FUNCTIONS
// ============================================

const refundService = {
  async getAllRefunds(params: RefundFilters): Promise<{ data: Refund[]; total: number; page: number; totalPages: number }> {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append('search', params.search);
    if (params.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.page) queryParams.append('page', String(params.page));
    if (params.limit) queryParams.append('limit', String(params.limit));
    
    const url = `/api/refunds?${queryParams.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch refunds');
    }
    return response.json();
  },

  async getRefundById(id: string): Promise<Refund> {
    const response = await fetch(`/api/refunds/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch refund');
    }
    return response.json();
  },

  async approveRefund(id: string): Promise<Refund> {
    const response = await fetch(`/api/refunds/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error('Failed to approve refund');
    }
    return response.json();
  },

  async rejectRefund(id: string, reason: string): Promise<Refund> {
    const response = await fetch(`/api/refunds/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) {
      throw new Error('Failed to reject refund');
    }
    return response.json();
  },

  async completeRefund(id: string): Promise<Refund> {
    const response = await fetch(`/api/refunds/${id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error('Failed to complete refund');
    }
    return response.json();
  },

  async getRefundStats(params?: { startDate?: string; endDate?: string }): Promise<RefundStats> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    
    const url = `/api/refunds/stats?${queryParams.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch refund stats');
    }
    return response.json();
  },

  async exportRefunds(params: { startDate?: string; endDate?: string; format?: 'csv' | 'excel' | 'pdf' }): Promise<Blob> {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.format) queryParams.append('format', params.format);
    
    const url = `/api/refunds/export?${queryParams.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to export refunds');
    }
    return response.blob();
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    approved: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    rejected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    completed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    cancelled: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400',
  };
  return colors[status] || 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400';
};

const getStatusIcon = (status: string) => {
  const icons: Record<string, any> = {
    pending: Clock,
    approved: CheckCircle,
    rejected: XCircle,
    completed: CheckCircle,
    cancelled: XCircle,
  };
  return icons[status] || AlertCircle;
};

const StatusIcon = ({ status }: { status: string }) => {
  const Icon = getStatusIcon(status);
  return <Icon className="w-4 h-4 inline mr-1" />;
};

const getRefundMethodIcon = (method: string) => {
  const icons: Record<string, any> = {
    cash: Banknote,
    credit: CreditCard,
    store_credit: Gift,
    original_payment: Wallet,
    bank_transfer: Wallet,
  };
  return icons[method] || Wallet;
};

const getRefundMethodColor = (method: string): string => {
  const colors: Record<string, string> = {
    cash: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    credit: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    store_credit: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    original_payment: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
    bank_transfer: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  };
  return colors[method] || 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400';
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function RefundsPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { user: authUser } = useAuth();
  const router = useRouter();
  
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState<RefundStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    completed: 0,
    cancelled: 0,
    totalAmount: 0,
    averageRefund: 0,
    byMethod: {
      cash: 0,
      credit: 0,
      store_credit: 0,
      original_payment: 0,
      bank_transfer: 0,
    }
  });
  
  const [filters, setFilters] = useState<RefundFilters>({
    search: '',
    status: 'all',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    page: 1,
    limit: 10,
  });
  
  const [totalPages, setTotalPages] = useState(1);
  const [totalRefunds, setTotalRefunds] = useState(0);
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [exporting, setExporting] = useState(false);

  // Check user permissions
  const userRole = authUser?.role as string || 'EMPLOYEE';
  const canManageRefunds = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userRole);
  const canViewRefunds = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'CASHIER'].includes(userRole);

  // Redirect if not authorized
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/login?redirect=/admin/sales/refunds');
      return;
    }
    if (isLoaded && isSignedIn && !canViewRefunds) {
      router.push('/admin/sales');
      toast.error('You do not have permission to view refunds');
    }
  }, [isLoaded, isSignedIn, router, canViewRefunds]);

  // Fetch refunds
  const fetchRefunds = useCallback(async (silent = false) => {
    if (!authUser) return;

    try {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);

      const result = await refundService.getAllRefunds(filters);
      setRefunds(result.data || []);
      setTotalRefunds(result.total || 0);
      setTotalPages(result.totalPages || 1);
      
      // Fetch stats
      const statsData = await refundService.getRefundStats({
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
      setStats(statsData);

    } catch (error: any) {
      console.error('Error fetching refunds:', error);
      toast.error(error.message || 'Failed to load refunds');
      setRefunds([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [authUser, filters]);

  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

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

  const handleApproveRefund = async () => {
    if (!selectedRefund) return;
    
    try {
      setProcessing(true);
      await refundService.approveRefund(selectedRefund.id);
      toast.success('Refund approved successfully');
      setShowApproveModal(false);
      fetchRefunds();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve refund');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectRefund = async () => {
    if (!selectedRefund || !rejectReason.trim()) return;
    
    try {
      setProcessing(true);
      await refundService.rejectRefund(selectedRefund.id, rejectReason);
      toast.success('Refund rejected successfully');
      setShowRejectModal(false);
      setRejectReason('');
      fetchRefunds();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject refund');
    } finally {
      setProcessing(false);
    }
  };

  const handleCompleteRefund = async () => {
    if (!selectedRefund) return;
    
    try {
      setProcessing(true);
      await refundService.completeRefund(selectedRefund.id);
      toast.success('Refund completed successfully');
      setShowCompleteModal(false);
      fetchRefunds();
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete refund');
    } finally {
      setProcessing(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await refundService.exportRefunds({
        startDate: filters.startDate,
        endDate: filters.endDate,
        format: 'csv',
      });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `refunds-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Refunds exported successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to export refunds');
    } finally {
      setExporting(false);
    }
  };

  // Loading state
  if (loading) {
    return <LoadingSkeleton />;
  }

  // Permission check
  if (!authUser || !canViewRefunds) {
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
                  Refunds
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Manage customer refunds and reimbursements
                  {totalRefunds > 0 && ` · ${totalRefunds} total refunds`}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => fetchRefunds(true)}
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
          <StatCard title="Pending" value={stats.pending} color="yellow" />
          <StatCard title="Approved" value={stats.approved} color="blue" />
          <StatCard title="Rejected" value={stats.rejected} color="red" />
          <StatCard title="Completed" value={stats.completed} color="green" />
          <StatCard title="Cancelled" value={stats.cancelled} color="gray" />
          <StatCard title="Total Amount" value={formatCurrency(stats.totalAmount)} color="blue" isCurrency />
        </div>

        {/* Additional Stats - Average & Methods */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Average Refund Amount</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(stats.averageRefund)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Refund Methods</p>
            <div className="grid grid-cols-5 gap-2">
              <MethodBadge method="cash" count={stats.byMethod.cash} />
              <MethodBadge method="credit" count={stats.byMethod.credit} />
              <MethodBadge method="store_credit" count={stats.byMethod.store_credit} label="Store Credit" />
              <MethodBadge method="original_payment" count={stats.byMethod.original_payment} label="Original Payment" />
              <MethodBadge method="bank_transfer" count={stats.byMethod.bank_transfer} label="Bank Transfer" />
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
                placeholder="Search by refund #, receipt, customer..."
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
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
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
              onClick={() => fetchRefunds()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {/* Refunds List */}
        {refunds.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center border border-gray-200 dark:border-gray-700">
            <div className="text-6xl mb-4">💰</div>
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No Refunds Found</h2>
            <p className="text-gray-500 dark:text-gray-400">
              {filters.search || filters.status !== 'all'
                ? 'No refunds match your search criteria.'
                : "No refunds have been processed yet."}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <AnimatePresence>
                {refunds.map((refund, index) => (
                  <motion.div
                    key={refund.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all overflow-hidden border border-gray-200 dark:border-gray-700"
                  >
                    {/* Refund Header */}
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                          #{refund.refundNumber}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(refund.createdAt)}
                        </span>
                        {refund.refundType && (
                          <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs">
                            {refund.refundType}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(refund.status)} flex items-center gap-1`}>
                          <StatusIcon status={refund.status} />
                          {refund.status.charAt(0).toUpperCase() + refund.status.slice(1)}
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {formatCurrency(refund.total)}
                        </span>
                      </div>
                    </div>

                    {/* Refund Body */}
                    <div className="p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {refund.customerName}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="w-4 h-4" />
                              Receipt: #{refund.receiptNumber}
                            </span>
                            <span className="flex items-center gap-1">
                              <Package className="w-4 h-4" />
                              {refund.items.length} items
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRefundMethodColor(refund.refundMethod)} flex items-center gap-1`}>
                              {refund.refundMethod.replace('_', ' ').toUpperCase()}
                            </span>
                            {refund.notes && (
                              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs">
                                📝 {refund.notes}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedRefund(refund);
                              setShowDetailModal(true);
                            }}
                            className="px-3 py-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            Details
                          </button>
                          {canManageRefunds && refund.status === 'pending' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedRefund(refund);
                                  setShowApproveModal(true);
                                }}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors flex items-center gap-1"
                              >
                                <Check className="w-4 h-4" />
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedRefund(refund);
                                  setShowRejectModal(true);
                                }}
                                className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors flex items-center gap-1"
                              >
                                <X className="w-4 h-4" />
                                Reject
                              </button>
                            </>
                          )}
                          {canManageRefunds && refund.status === 'approved' && (
                            <button
                              onClick={() => {
                                setSelectedRefund(refund);
                                setShowCompleteModal(true);
                              }}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors flex items-center gap-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Complete
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
                            ? 'bg-purple-600 text-white'
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
        {showDetailModal && selectedRefund && (
          <DetailModal
            refundData={selectedRefund}
            onClose={() => setShowDetailModal(false)}
            onApprove={() => {
              setShowDetailModal(false);
              setShowApproveModal(true);
            }}
            onComplete={() => {
              setShowDetailModal(false);
              setShowCompleteModal(true);
            }}
            canManage={canManageRefunds}
          />
        )}
      </AnimatePresence>

      {/* Approve Modal */}
      <AnimatePresence>
        {showApproveModal && selectedRefund && (
          <ApproveModal
            refundData={selectedRefund}
            onClose={() => setShowApproveModal(false)}
            onConfirm={handleApproveRefund}
            processing={processing}
          />
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && selectedRefund && (
          <RejectModal
            refundData={selectedRefund}
            onClose={() => setShowRejectModal(false)}
            onConfirm={handleRejectRefund}
            reason={rejectReason}
            setReason={setRejectReason}
            processing={processing}
          />
        )}
      </AnimatePresence>

      {/* Complete Modal */}
      <AnimatePresence>
        {showCompleteModal && selectedRefund && (
          <CompleteModal
            refundData={selectedRefund}
            onClose={() => setShowCompleteModal(false)}
            onConfirm={handleCompleteRefund}
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

function MethodBadge({ method, count, label }: { method: string; count: number; label?: string }) {
  const displayLabel = label || method.replace('_', ' ').toUpperCase();
  const color = getRefundMethodColor(method);
  
  return (
    <div className={`px-2 py-1 rounded-lg text-center ${color}`}>
      <p className="text-xs font-medium">{displayLabel}</p>
      <p className="text-sm font-bold">{count}</p>
    </div>
  );
}

function DetailModal({ refundData, onClose, onApprove, onComplete, canManage }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Refund #{refundData.refundNumber}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatDateTime(refundData.createdAt)}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <XCircle className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status and Total */}
          <div className="flex items-center justify-between">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(refundData.status)} flex items-center gap-2`}>
              <StatusIcon status={refundData.status} />
              {refundData.status.charAt(0).toUpperCase() + refundData.status.slice(1)}
            </span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(refundData.total)}
            </span>
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Customer</p>
              <p className="font-medium text-gray-900 dark:text-white">{refundData.customerName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
              <p className="font-medium text-gray-900 dark:text-white">{refundData.customerEmail}</p>
            </div>
            {refundData.customerPhone && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                <p className="font-medium text-gray-900 dark:text-white">{refundData.customerPhone}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Receipt</p>
              <p className="font-medium text-gray-900 dark:text-white">#{refundData.receiptNumber}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Refund Method</p>
              <p className="font-medium text-gray-900 dark:text-white">{refundData.refundMethod.replace('_', ' ').toUpperCase()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Refund Type</p>
              <p className="font-medium text-gray-900 dark:text-white">{refundData.refundType.charAt(0).toUpperCase() + refundData.refundType.slice(1)}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">Reason</p>
              <p className="font-medium text-gray-900 dark:text-white">{refundData.reason}</p>
            </div>
            {refundData.rejectedReason && (
              <div className="col-span-2">
                <p className="text-sm text-red-500 dark:text-red-400">Rejection Reason</p>
                <p className="font-medium text-gray-900 dark:text-white">{refundData.rejectedReason}</p>
              </div>
            )}
          </div>

          {/* Items */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Items</h3>
            <div className="space-y-2">
              {refundData.items.map((item: RefundItem) => (
                <div key={item.id} className="flex justify-between items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{item.productName}</p>
                    <div className="flex flex-wrap gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>SKU: {item.sku}</span>
                      <span>× {item.quantity}</span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Reason: {item.reason}</p>
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
                <span className="text-gray-900 dark:text-white">{formatCurrency(refundData.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Tax</span>
                <span className="text-gray-900 dark:text-white">{formatCurrency(refundData.tax)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-900 dark:text-white">Total</span>
                <span className="text-purple-600 dark:text-purple-400">{formatCurrency(refundData.total)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2">
              <Printer className="w-4 h-4" />
              Print
            </button>
            {canManage && refundData.status === 'pending' && (
              <button
                onClick={onApprove}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Approve Refund
              </button>
            )}
            {canManage && refundData.status === 'approved' && (
              <button
                onClick={onComplete}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Complete Refund
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

function ApproveModal({ refundData, onClose, onConfirm, processing }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Approve Refund
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to approve refund #{refundData.refundNumber}?
          <br />
          <span className="text-sm">
            Total amount: {formatCurrency(refundData.total)}
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
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {processing ? 'Approving...' : 'Confirm Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectModal({ refundData, onClose, onConfirm, reason, setReason, processing }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Reject Refund
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to reject refund #{refundData.refundNumber}?
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Reason for Rejection <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Enter reason for rejection..."
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
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            {processing ? 'Rejecting...' : 'Confirm Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompleteModal({ refundData, onClose, onConfirm, processing }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Complete Refund
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to mark refund #{refundData.refundNumber} as completed?
          <br />
          <span className="text-sm">
            Total amount: {formatCurrency(refundData.total)}
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
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {processing ? 'Completing...' : 'Confirm Complete'}
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
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 h-16 mb-6"></div>
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 h-32"></div>
        ))}
      </div>
    </div>
  );
}
