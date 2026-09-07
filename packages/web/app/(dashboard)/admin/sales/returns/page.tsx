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
  Filter,
  Calendar,
  Users,
  DollarSign,
  Package,
  FileText,
  Trash2,
  Edit,
  MoreVertical,
  CreditCard,
  Banknote,
  Gift,
  Wallet,
  Phone
} from 'lucide-react';
import { saleService } from '../../../../../services/saleService';
import { formatCurrency, formatDate, formatDateTime } from '../../../../../utils/formatters';
import { useAuth } from '../../../../../hooks/useAuth';
import { toast } from '../../../../../utils/toast-manager';

// ============================================
// INTERFACES
// ============================================

interface ReturnItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  reason: string;
  condition: 'good' | 'damaged' | 'opened' | 'used';
}

interface Return {
  id: string;
  returnNumber: string;
  saleId: string;
  receiptNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items: ReturnItem[];
  subtotal: number;
  tax: number;
  total: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'processed' | 'cancelled';
  returnType: 'full' | 'partial';
  refundMethod: 'cash' | 'credit' | 'store_credit' | 'original_payment';
  notes?: string;
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectedReason?: string;
}

interface ReturnFilters {
  search: string;
  status: string;
  startDate: string;
  endDate: string;
  page: number;
  limit: number;
}

interface ReturnStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  processed: number;
  cancelled: number;
  totalAmount: number;
}

// ============================================
// API SERVICE FUNCTIONS
// ============================================

// These would be moved to a separate returnService file in production
const returnService = {
  async getAllReturns(params: ReturnFilters): Promise<{ data: Return[]; total: number; page: number; totalPages: number }> {
    // Build query params
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append('search', params.search);
    if (params.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.page) queryParams.append('page', String(params.page));
    if (params.limit) queryParams.append('limit', String(params.limit));
    
    const url = `/api/returns?${queryParams.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch returns');
    }
    const data = await response.json();
    return data;
  },

  async getReturnById(id: string): Promise<Return> {
    const response = await fetch(`/api/returns/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch return');
    }
    const data = await response.json();
    return data;
  },

  async processReturn(id: string): Promise<Return> {
    const response = await fetch(`/api/returns/${id}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error('Failed to process return');
    }
    const data = await response.json();
    return data;
  },

  async rejectReturn(id: string, reason: string): Promise<Return> {
    const response = await fetch(`/api/returns/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) {
      throw new Error('Failed to reject return');
    }
    const data = await response.json();
    return data;
  },

  async getReturnStats(params?: { startDate?: string; endDate?: string }): Promise<ReturnStats> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    
    const url = `/api/returns/stats?${queryParams.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch return stats');
    }
    const data = await response.json();
    return data;
  },

  async exportReturns(params: { startDate?: string; endDate?: string; format?: 'csv' | 'excel' | 'pdf' }): Promise<Blob> {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.format) queryParams.append('format', params.format);
    
    const url = `/api/returns/export?${queryParams.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to export returns');
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
    processed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    cancelled: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400',
  };
  return colors[status] || 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400';
};

const getStatusIcon = (status: string) => {
  const icons: Record<string, any> = {
    pending: Clock,
    approved: CheckCircle,
    rejected: XCircle,
    processed: CheckCircle,
    cancelled: XCircle,
  };
  return icons[status] || AlertCircle;
};

const StatusIcon = ({ status }: { status: string }) => {
  const Icon = getStatusIcon(status);
  return <Icon className="w-4 h-4 inline mr-1" />;
};

const getConditionBadge = (condition: string): string => {
  const colors: Record<string, string> = {
    good: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    damaged: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    opened: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    used: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400',
  };
  return colors[condition] || 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400';
};

const getRefundMethodIcon = (method: string) => {
  const icons: Record<string, any> = {
    cash: Banknote,
    credit: CreditCard,
    store_credit: Gift,
    original_payment: Wallet,
  };
  return icons[method] || Wallet;
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function ReturnsPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { user: authUser } = useAuth();
  const router = useRouter();
  
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState<ReturnStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    processed: 0,
    cancelled: 0,
    totalAmount: 0,
  });
  
  const [filters, setFilters] = useState<ReturnFilters>({
    search: '',
    status: 'all',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    page: 1,
    limit: 10,
  });
  
  const [totalPages, setTotalPages] = useState(1);
  const [totalReturns, setTotalReturns] = useState(0);
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [exporting, setExporting] = useState(false);

  // Check user permissions
  const userRole = authUser?.role as string || 'EMPLOYEE';
  const canManageReturns = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userRole);
  const canViewReturns = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'CASHIER'].includes(userRole);

  // Redirect if not authorized
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/login?redirect=/admin/sales/returns');
      return;
    }
    if (isLoaded && isSignedIn && !canViewReturns) {
      router.push('/admin/sales');
      toast.error('You do not have permission to view returns');
    }
  }, [isLoaded, isSignedIn, router, canViewReturns]);

  // Fetch returns
  const fetchReturns = useCallback(async (silent = false) => {
    if (!authUser) return;

    try {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);

      const result = await returnService.getAllReturns(filters);
      setReturns(result.data || []);
      setTotalReturns(result.total || 0);
      setTotalPages(result.totalPages || 1);
      
      // Fetch stats
      const statsData = await returnService.getReturnStats({
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
      setStats(statsData);

    } catch (error: any) {
      console.error('Error fetching returns:', error);
      toast.error(error.message || 'Failed to load returns');
      setReturns([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [authUser, filters]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

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

  const handleProcessReturn = async () => {
    if (!selectedReturn) return;
    
    try {
      setProcessing(true);
      await returnService.processReturn(selectedReturn.id);
      toast.success('Return processed successfully');
      setShowProcessModal(false);
      fetchReturns();
    } catch (error: any) {
      toast.error(error.message || 'Failed to process return');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectReturn = async () => {
    if (!selectedReturn || !rejectReason.trim()) return;
    
    try {
      setProcessing(true);
      await returnService.rejectReturn(selectedReturn.id, rejectReason);
      toast.success('Return rejected successfully');
      setShowRejectModal(false);
      setRejectReason('');
      fetchReturns();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject return');
    } finally {
      setProcessing(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await returnService.exportReturns({
        startDate: filters.startDate,
        endDate: filters.endDate,
        format: 'csv',
      });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `returns-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Returns exported successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to export returns');
    } finally {
      setExporting(false);
    }
  };

  // Loading state
  if (loading) {
    return <LoadingSkeleton />;
  }

  // Permission check
  if (!authUser || !canViewReturns) {
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
                  Returns & Refunds
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Manage product returns and refunds
                  {totalReturns > 0 && ` · ${totalReturns} total returns`}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => fetchReturns(true)}
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
          <StatCard title="Processed" value={stats.processed} color="green" />
          <StatCard title="Cancelled" value={stats.cancelled} color="gray" />
          <StatCard title="Total Amount" value={formatCurrency(stats.totalAmount)} color="blue" isCurrency />
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by return #, receipt, customer..."
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
              <option value="processed">Processed</option>
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
              onClick={() => fetchReturns()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {/* Returns List */}
        {returns.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center border border-gray-200 dark:border-gray-700">
            <div className="text-6xl mb-4">🔄</div>
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No Returns Found</h2>
            <p className="text-gray-500 dark:text-gray-400">
              {filters.search || filters.status !== 'all'
                ? 'No returns match your search criteria.'
                : "No return requests have been submitted yet."}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <AnimatePresence>
                {returns.map((returnItem, index) => (
                  <motion.div
                    key={returnItem.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all overflow-hidden border border-gray-200 dark:border-gray-700"
                  >
                    {/* Return Header */}
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                          #{returnItem.returnNumber}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(returnItem.createdAt)}
                        </span>
                        {returnItem.returnType && (
                          <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs">
                            {returnItem.returnType}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(returnItem.status)} flex items-center gap-1`}>
                          <StatusIcon status={returnItem.status} />
                          {returnItem.status.charAt(0).toUpperCase() + returnItem.status.slice(1)}
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {formatCurrency(returnItem.total)}
                        </span>
                      </div>
                    </div>

                    {/* Return Body */}
                    <div className="p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {returnItem.customerName}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="w-4 h-4" />
                              Receipt: #{returnItem.receiptNumber}
                            </span>
                            <span className="flex items-center gap-1">
                              <Package className="w-4 h-4" />
                              {returnItem.items.length} items
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs font-medium flex items-center gap-1">
                              {returnItem.refundMethod.replace('_', ' ').toUpperCase()}
                            </span>
                            {returnItem.notes && (
                              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs">
                                📝 {returnItem.notes}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedReturn(returnItem);
                              setShowDetailModal(true);
                            }}
                            className="px-3 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            Details
                          </button>
                          {canManageReturns && returnItem.status === 'pending' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedReturn(returnItem);
                                  setShowProcessModal(true);
                                }}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors flex items-center gap-1"
                              >
                                <Check className="w-4 h-4" />
                                Process
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedReturn(returnItem);
                                  setShowRejectModal(true);
                                }}
                                className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors flex items-center gap-1"
                              >
                                <X className="w-4 h-4" />
                                Reject
                              </button>
                            </>
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
        {showDetailModal && selectedReturn && (
          <DetailModal
            returnData={selectedReturn}
            onClose={() => setShowDetailModal(false)}
            onProcess={() => {
              setShowDetailModal(false);
              setShowProcessModal(true);
            }}
            canManage={canManageReturns}
          />
        )}
      </AnimatePresence>

      {/* Process Modal */}
      <AnimatePresence>
        {showProcessModal && selectedReturn && (
          <ProcessModal
            returnData={selectedReturn}
            onClose={() => setShowProcessModal(false)}
            onConfirm={handleProcessReturn}
            processing={processing}
          />
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && selectedReturn && (
          <RejectModal
            returnData={selectedReturn}
            onClose={() => setShowRejectModal(false)}
            onConfirm={handleRejectReturn}
            reason={rejectReason}
            setReason={setRejectReason}
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

function DetailModal({ returnData, onClose, onProcess, canManage }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Return #{returnData.returnNumber}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatDateTime(returnData.createdAt)}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <XCircle className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status and Total */}
          <div className="flex items-center justify-between">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(returnData.status)} flex items-center gap-2`}>
              <StatusIcon status={returnData.status} />
              {returnData.status.charAt(0).toUpperCase() + returnData.status.slice(1)}
            </span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(returnData.total)}
            </span>
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Customer</p>
              <p className="font-medium text-gray-900 dark:text-white">{returnData.customerName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
              <p className="font-medium text-gray-900 dark:text-white">{returnData.customerEmail}</p>
            </div>
            {returnData.customerPhone && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                <p className="font-medium text-gray-900 dark:text-white">{returnData.customerPhone}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Receipt</p>
              <p className="font-medium text-gray-900 dark:text-white">#{returnData.receiptNumber}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Refund Method</p>
              <p className="font-medium text-gray-900 dark:text-white">{returnData.refundMethod.replace('_', ' ').toUpperCase()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Return Type</p>
              <p className="font-medium text-gray-900 dark:text-white">{returnData.returnType.charAt(0).toUpperCase() + returnData.returnType.slice(1)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Reason</p>
              <p className="font-medium text-gray-900 dark:text-white">{returnData.reason}</p>
            </div>
            {returnData.rejectedReason && (
              <div className="col-span-2">
                <p className="text-sm text-red-500 dark:text-red-400">Rejection Reason</p>
                <p className="font-medium text-gray-900 dark:text-white">{returnData.rejectedReason}</p>
              </div>
            )}
          </div>

          {/* Items */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Items</h3>
            <div className="space-y-2">
              {returnData.items.map((item: ReturnItem) => (
                <div key={item.id} className="flex justify-between items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{item.productName}</p>
                    <div className="flex flex-wrap gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>SKU: {item.sku}</span>
                      <span>× {item.quantity}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getConditionBadge(item.condition)}`}>
                        {item.condition}
                      </span>
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
                <span className="text-gray-900 dark:text-white">{formatCurrency(returnData.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Tax</span>
                <span className="text-gray-900 dark:text-white">{formatCurrency(returnData.tax)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-900 dark:text-white">Total</span>
                <span className="text-blue-600 dark:text-blue-400">{formatCurrency(returnData.total)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2">
              <Printer className="w-4 h-4" />
              Print
            </button>
            {canManage && returnData.status === 'pending' && (
              <>
                <button
                  onClick={onProcess}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Process Return
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

function ProcessModal({ returnData, onClose, onConfirm, processing }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Process Return
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to process return #{returnData.returnNumber}?
          <br />
          <span className="text-sm">
            Total amount: {formatCurrency(returnData.total)}
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
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {processing ? 'Processing...' : 'Confirm Process'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectModal({ returnData, onClose, onConfirm, reason, setReason, processing }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Reject Return
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to reject return #{returnData.returnNumber}?
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
