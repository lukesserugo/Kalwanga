// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\checkout\page.tsx

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Users,
  Download,
  Printer,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Trash2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Mail,
  Phone,
  Building,
  Lock,
  Receipt,
  User,
  Copy,
  X,
  Star,
} from 'lucide-react';
import { usePermission } from '../../../../hooks/usePermission';
import { PermissionResource } from '../../../../types/enums';
import { checkoutService } from '../../../../services/checkoutService';
import type {
  CheckoutStats,
  GetCheckoutsQuery,
  GetCheckoutStatsQuery,
} from '../../../../services/checkoutService';
import type { Sale } from '../../../../types/sale';
import { formatCurrency, formatDate } from '../../../../utils/formatters';
import { toast } from '../../../../utils/toast-manager';
import { useConfirm } from '../../../../components/notifications/ConfirmProvider';

// ============================================
// TYPES
// ============================================

interface FilterState {
  status: string;
  paymentStatus: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

const DEFAULT_FILTERS: FilterState = {
  status: 'all',
  paymentStatus: 'all',
  dateFrom: '',
  dateTo: '',
  search: '',
  sortBy: 'saleDate',
  sortOrder: 'desc',
};

const DEFAULT_PAGINATION = {
  page: 1,
  total: 0,
  totalPages: 1,
  limit: 20,
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminCheckoutPage() {
  const router = useRouter();
  const { hasPermission, isLoading: permissionLoading } = usePermission();
  const confirm = useConfirm();

  const [checkouts, setCheckouts] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedCheckout, setSelectedCheckout] = useState<Sale | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState<CheckoutStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const canViewCheckouts =
    hasPermission(PermissionResource.SALE) ||
    hasPermission(PermissionResource.ORDER);
  const canManageCheckouts = hasPermission(PermissionResource.SALE);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadCheckouts = useCallback(async () => {
    if (!canViewCheckouts) return;
    try {
      setLoading(true);

      const params: GetCheckoutsQuery = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      };
      if (filters.search) params.search = filters.search;
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.paymentStatus !== 'all')
        params.paymentStatus = filters.paymentStatus;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;

      const response = await checkoutService.getCheckouts(params);
      if (!isMountedRef.current) return;

      setCheckouts(response.data);
      setPagination(response.pagination);
    } catch (error: any) {
      if (!isMountedRef.current) return;
      console.error('Failed to load checkouts:', error);
      toast.error(
        error?.response?.data?.message || 'Failed to load checkouts',
      );
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [
    canViewCheckouts,
    filters,
    pagination.page,
    pagination.limit,
  ]);

  const loadStats = useCallback(async () => {
    if (!canViewCheckouts) return;
    try {
      setLoadingStats(true);
      const params: GetCheckoutStatsQuery = {};
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      const data = await checkoutService.getCheckoutStats(params);
      if (!isMountedRef.current) return;
      setStats(data);
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Failed to load stats:', error);
    } finally {
      if (isMountedRef.current) setLoadingStats(false);
    }
  }, [canViewCheckouts, filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    if (permissionLoading) return;
    if (canViewCheckouts) {
      void loadCheckouts();
      void loadStats();
    } else {
      setLoading(false);
      setLoadingStats(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    permissionLoading,
    canViewCheckouts,
    filters,
    pagination.page,
  ]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters((prev) => ({ ...prev, search: searchInput }));
        setPagination((prev) => ({ ...prev, page: 1 }));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadCheckouts(), loadStats()]);
    if (isMountedRef.current) setRefreshing(false);
    toast.success('Data refreshed');
  }, [loadCheckouts, loadStats]);

  const handleExport = useCallback(async () => {
    try {
      const result = await checkoutService.exportCheckouts({
        format: 'csv',
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });

      const blob =
        result instanceof Blob
          ? result
          : new Blob([JSON.stringify(result)], {
              type: 'application/json',
            });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `checkouts_${
        new Date().toISOString().split('T')[0]
      }.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Checkouts exported successfully');
    } catch (error: any) {
      console.error('Export failed:', error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to export checkouts',
      );
    }
  }, [filters.dateFrom, filters.dateTo]);

  const handleViewDetails = useCallback((checkout: Sale) => {
    setSelectedCheckout(checkout);
    setShowDetailModal(true);
  }, []);

  const handleVoidCheckout = useCallback(
    async (checkout: Sale) => {
      const ok = await confirm({
        title: 'Void this checkout?',
        description: `Checkout ${checkout.receiptNumber} will be voided. Reversal entries will be written for the associated payment and inventory. This cannot be undone.`,
        tone: 'danger',
        confirmLabel: 'Void',
      });
      if (!ok) return;

      try {
        await checkoutService.voidCheckout(checkout.id, {
          reason: 'Voided by admin from checkout list',
        });
        toast.success('Checkout voided successfully');
        await Promise.all([loadCheckouts(), loadStats()]);
      } catch (error: any) {
        console.error('Failed to void checkout:', error);
        toast.error(
          error?.response?.data?.message ||
            error?.message ||
            'Failed to void checkout',
        );
      }
    },
    [confirm, loadCheckouts, loadStats],
  );

  const handleDeleteCheckout = useCallback(async () => {
    if (!selectedCheckout) return;

    setDeleteLoading(true);
    try {
      await checkoutService.deleteCheckout(selectedCheckout.id);
      toast.success('Checkout deleted successfully');
      setShowDeleteModal(false);
      setSelectedCheckout(null);
      await Promise.all([loadCheckouts(), loadStats()]);
    } catch (error: any) {
      console.error('Failed to delete checkout:', error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to delete checkout',
      );
    } finally {
      if (isMountedRef.current) setDeleteLoading(false);
    }
  }, [selectedCheckout, loadCheckouts, loadStats]);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'CANCELLED':
      case 'VOID':
      case 'VOIDED':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';
    }
  };

  const getPaymentStatusColor = (status: string): string => {
    switch (status) {
      case 'PAID':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'REFUNDED':
      case 'FAILED':
      case 'DECLINED':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';
    }
  };

  // Summary figures. Prefer the authoritative stats endpoint.
  const summary = useMemo(() => {
    if (stats) {
      return {
        totalSales: stats.summary.totalOrders,
        totalRevenue: stats.summary.totalRevenue,
        averageOrderValue: stats.summary.averageOrderValue,
        totalCustomers: stats.summary.totalCustomers,
      };
    }
    return {
      totalSales: pagination.total,
      totalRevenue: 0,
      averageOrderValue: 0,
      totalCustomers: 0,
    };
  }, [stats, pagination.total]);

  // ============================================
  // GUARDS
  // ============================================

  if (permissionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  if (!canViewCheckouts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view checkouts. Please contact
          your administrator.
        </p>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <ShoppingBag className="w-8 h-8 text-blue-500" />
              Checkout Management
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Manage all sales and checkout transactions
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
              aria-label="Refresh"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-300 focus-ring"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Total Sales',
              value: summary.totalSales,
              icon: ShoppingBag,
              color:
                'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
            },
            {
              label: 'Total Revenue',
              value: formatCurrency(summary.totalRevenue),
              icon: DollarSign,
              color:
                'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
            },
            {
              label: 'Average Order',
              value: formatCurrency(summary.averageOrderValue),
              icon: TrendingUp,
              color:
                'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
            },
            {
              label: 'Total Customers',
              value: summary.totalCustomers,
              icon: Users,
              color:
                'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${stat.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {stat.label}
                    </p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                      {loadingStats && !stats ? '—' : stat.value}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by receipt, customer, email…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors focus-ring ${
                showFilters ||
                filters.status !== 'all' ||
                filters.paymentStatus !== 'all' ||
                filters.dateFrom ||
                filters.dateTo
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>

            <select
              value={filters.sortBy}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, sortBy: e.target.value }))
              }
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="saleDate">Sort by Date</option>
              <option value="total">Sort by Amount</option>
              <option value="status">Sort by Status</option>
            </select>
          </div>

          <AnimatePresence initial={false}>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Status
                    </label>
                    <select
                      value={filters.status}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          status: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Status</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="PENDING">Pending</option>
                      <option value="PROCESSING">Processing</option>
                      <option value="CANCELLED">Cancelled</option>
                      <option value="VOID">Void</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Payment Status
                    </label>
                    <select
                      value={filters.paymentStatus}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          paymentStatus: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Payment Status</option>
                      <option value="PAID">Paid</option>
                      <option value="PENDING">Pending</option>
                      <option value="REFUNDED">Refunded</option>
                      <option value="PARTIAL">Partial</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date From
                    </label>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          dateFrom: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date To
                    </label>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          dateTo: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setFilters(DEFAULT_FILTERS);
                      setSearchInput('');
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 focus-ring rounded"
                  >
                    Clear All Filters
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Checkouts Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : checkouts.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                No checkouts found
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Try adjusting your filters
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    {[
                      'Receipt',
                      'Date',
                      'Customer',
                      'Total',
                      'Payment',
                      'Status',
                      'Actions',
                    ].map((label, i, arr) => (
                      <th
                        key={label}
                        className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
                          i === arr.length - 1 ? 'text-right' : 'text-left'
                        }`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {checkouts.map((checkout) => {
                    const customerName = checkout.customer
                      ? `${checkout.customer.firstName} ${checkout.customer.lastName}`.trim()
                      : 'Guest';
                    const paymentMethod =
                      (checkout as any).payments?.[0]?.paymentMethod ?? 'N/A';
                    return (
                      <tr
                        key={checkout.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                              #{checkout.receiptNumber}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {checkout.items?.length || 0} items
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(checkout.saleDate)}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm text-gray-900 dark:text-white">
                              {customerName}
                            </p>
                            {checkout.customer?.email && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {checkout.customer.email}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                            {formatCurrency(checkout.total)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                            Paid: {formatCurrency(checkout.paidAmount)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs capitalize text-gray-600 dark:text-gray-400">
                            {String(paymentMethod).toLowerCase().replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full inline-block ${getStatusColor(
                                checkout.status,
                              )}`}
                            >
                              {checkout.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleViewDetails(checkout)}
                              className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors focus-ring"
                              title="View details"
                            >
                              <Eye className="w-4 h-4 text-blue-500" />
                            </button>
                            {canManageCheckouts &&
                              checkout.status !== 'VOID' &&
                              checkout.status !== 'CANCELLED' && (
                                <button
                                  type="button"
                                  onClick={() => handleVoidCheckout(checkout)}
                                  className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors focus-ring"
                                  title="Void checkout"
                                >
                                  <XCircle className="w-4 h-4 text-red-500" />
                                </button>
                              )}
                            {canManageCheckouts &&
                              (checkout.status === 'PENDING' ||
                                checkout.status === 'PROCESSING') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCheckout(checkout);
                                    setShowDeleteModal(true);
                                  }}
                                  className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors focus-ring"
                                  title="Delete checkout"
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </button>
                              )}
                            <button
                              type="button"
                              onClick={() => {
                                const url = `${window.location.origin}/receipt/${checkout.receiptNumber}`;
                                navigator.clipboard.writeText(url);
                                toast.success('Receipt link copied');
                              }}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                              title="Copy receipt link"
                            >
                              <Copy className="w-4 h-4 text-gray-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(
                  pagination.page * pagination.limit,
                  pagination.total,
                )}{' '}
                of {pagination.total}
              </p>
              <div className="flex gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      page: prev.page - 1,
                    }))
                  }
                  disabled={pagination.page === 1}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center gap-1 focus-ring"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      page: prev.page + 1,
                    }))
                  }
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center gap-1 focus-ring"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedCheckout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDetailModal(false)}
            role="dialog"
            aria-modal="true"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <Receipt className="w-6 h-6 text-blue-500" />
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Receipt #{selectedCheckout.receiptNumber}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(selectedCheckout.saleDate)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Customer Info */}
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Customer Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900 dark:text-white">
                        {selectedCheckout.customer
                          ? `${selectedCheckout.customer.firstName} ${selectedCheckout.customer.lastName}`.trim()
                          : 'Guest'}
                      </span>
                    </div>
                    {selectedCheckout.customer?.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900 dark:text-white">
                          {selectedCheckout.customer.email}
                        </span>
                      </div>
                    )}
                    {selectedCheckout.customer?.phoneNumber && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900 dark:text-white">
                          {selectedCheckout.customer.phoneNumber}
                        </span>
                      </div>
                    )}
                    {selectedCheckout.businessUnitId && (
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-gray-400" />
                        <span className="font-mono text-xs text-gray-900 dark:text-white truncate">
                          {selectedCheckout.businessUnitId}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Items */}
                {selectedCheckout.items && selectedCheckout.items.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Items
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {selectedCheckout.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700"
                        >
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {item.product?.name ?? 'Product'}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {item.quantity} × {formatCurrency(item.unitPrice)}
                              {item.variant?.name && (
                                <span className="ml-2 text-xs">
                                  ({item.variant.name})
                                </span>
                              )}
                            </p>
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                            {formatCurrency(item.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Totals */}
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        Subtotal
                      </span>
                      <span className="text-gray-900 dark:text-white tabular-nums">
                        {formatCurrency(selectedCheckout.subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        Tax
                      </span>
                      <span className="text-gray-900 dark:text-white tabular-nums">
                        {formatCurrency(selectedCheckout.tax)}
                      </span>
                    </div>
                    {selectedCheckout.discount > 0 && (
                      <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                        <span>Discount</span>
                        <span className="tabular-nums">
                          -{formatCurrency(selectedCheckout.discount)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-gray-900 dark:text-white">
                        Total
                      </span>
                      <span className="text-gray-900 dark:text-white tabular-nums">
                        {formatCurrency(selectedCheckout.total)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                      <span>Paid</span>
                      <span className="tabular-nums">
                        {formatCurrency(selectedCheckout.paidAmount)}
                      </span>
                    </div>
                    {selectedCheckout.changeAmount > 0 && (
                      <div className="flex justify-between text-sm text-orange-500 dark:text-orange-400">
                        <span>Change</span>
                        <span className="tabular-nums">
                          {formatCurrency(selectedCheckout.changeAmount)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {selectedCheckout.notes && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      {selectedCheckout.notes}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      const printWindow = window.open('', '_blank');
                      if (!printWindow) return;
                      const receipt = selectedCheckout;
                      printWindow.document.write(`
                        <html>
                          <head><title>Receipt #${receipt.receiptNumber}</title>
                          <style>
                            body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: auto; }
                            .header { text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 10px; }
                            .item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f0f0f0; }
                            .total { font-weight: bold; font-size: 18px; margin-top: 10px; padding-top: 10px; border-top: 2px solid #333; }
                            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                          </style>
                          </head>
                          <body>
                            <div class="header">
                              <h2>Receipt</h2>
                              <p>#${receipt.receiptNumber}</p>
                              <p>${formatDate(receipt.saleDate)}</p>
                            </div>
                            ${(receipt.items || [])
                              .map(
                                (item) => `
                              <div class="item">
                                <span>${item.product?.name ?? 'Product'} × ${item.quantity}</span>
                                <span>${formatCurrency(item.total)}</span>
                              </div>
                            `,
                              )
                              .join('')}
                            <div class="item"><span>Subtotal</span><span>${formatCurrency(receipt.subtotal)}</span></div>
                            <div class="item"><span>Tax</span><span>${formatCurrency(receipt.tax)}</span></div>
                            ${receipt.discount > 0 ? `<div class="item"><span>Discount</span><span>-${formatCurrency(receipt.discount)}</span></div>` : ''}
                            <div class="total"><span>Total</span><span>${formatCurrency(receipt.total)}</span></div>
                            <div class="footer">Thank you for your business!</div>
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                      setTimeout(() => printWindow.print(), 500);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 focus-ring"
                  >
                    <Printer className="w-4 h-4" />
                    Print Receipt
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const blob = new Blob(
                        [JSON.stringify(selectedCheckout, null, 2)],
                        { type: 'application/json' },
                      );
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `receipt-${selectedCheckout.receiptNumber}.json`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                      toast.success('Receipt downloaded');
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-300 focus-ring"
                  >
                    <Download className="w-4 h-4" />
                    Download Receipt
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {showDeleteModal && selectedCheckout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeleteModal(false)}
            role="dialog"
            aria-modal="true"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Delete Checkout
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete checkout{' '}
                <strong className="text-gray-900 dark:text-white">
                  #{selectedCheckout.receiptNumber}
                </strong>
                ? This will permanently remove all associated data.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCheckout}
                  disabled={deleteLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors focus-ring"
                >
                  {deleteLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {deleteLoading ? 'Deleting…' : 'Delete Checkout'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
