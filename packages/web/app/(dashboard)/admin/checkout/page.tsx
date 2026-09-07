// D:\Projects\Kalwanga\packages\web\app\admin\checkout\page.tsx

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, DollarSign, TrendingUp, Users,
  Download, Printer, Search, Filter, RefreshCw,
  Eye, Edit, Trash2, CheckCircle, XCircle,
  Clock, Calendar, ChevronDown, ChevronLeft,
  ChevronRight, Loader2, AlertCircle, AlertTriangle,
  Package, CreditCard, Receipt, User, Mail,
  Phone, MapPin, Building, Lock, Shield,
  BarChart3, PieChart, TrendingDown, Award,
  Gift, Star, Hash, Tag, Layers, Box,
  Plus, Minus, X, Check, Copy, FileText,
  MoreVertical, Settings, Users as UsersIcon
} from 'lucide-react';
import { usePermission } from '../../../../hooks/usePermission';
import { PermissionResource } from '../../../../types/enums';
import { checkoutService } from '../../../../services/checkoutService';
import { formatCurrency, formatDate } from '../../../../utils/formatters';
import { toast } from '../../../../utils/toast-manager';
import { useThemeStore } from '../../../stores/themeStore';

// ============================================
// INTERFACES
// ============================================

interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  variantName?: string;
  variantId?: string;
}

interface Sale {
  id: string;
  receiptNumber: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  notes?: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  userId: string;
  userName?: string;
  businessUnitId: string;
  businessUnitName?: string;
  saleDate: string;
  createdAt: string;
  items?: SaleItem[];
  payments?: any[];
}

interface FilterState {
  status: string;
  paymentStatus: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminCheckoutPage() {
  const router = useRouter();
  const { canView, canManage, isLoading: permissionLoading } = usePermission();
  const { isDark } = useThemeStore();
  
  // State
  const [checkouts, setCheckouts] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 20,
  });
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    paymentStatus: 'all',
    dateFrom: '',
    dateTo: '',
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [selectedCheckout, setSelectedCheckout] = useState<Sale | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Permissions
  const canViewCheckouts = canView(PermissionResource.SALE) || canManage(PermissionResource.SALE);
  const canManageCheckouts = canManage(PermissionResource.SALE);

  // Load data
  useEffect(() => {
    if (canViewCheckouts) {
      loadCheckouts();
      loadStats();
    }
  }, [canViewCheckouts, filters, pagination.page]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters(prev => ({ ...prev, search: searchInput }));
        setPagination(prev => ({ ...prev, page: 1 }));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadCheckouts = async () => {
    try {
      setLoading(true);
      
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      };
      
      if (filters.search) params.search = filters.search;
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.paymentStatus !== 'all') params.paymentStatus = filters.paymentStatus;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      
      const response = await checkoutService.getCheckouts(params);
      
      setCheckouts(response.data || []);
      setPagination({
        page: response.page || 1,
        total: response.total || 0,
        totalPages: response.totalPages || 1,
        limit: response.limit || 20,
      });
    } catch (error: any) {
      console.error('Failed to load checkouts:', error);
      toast.error('Failed to load checkouts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadStats = async () => {
    try {
      setLoadingStats(true);
      const statsData = await checkoutService.getCheckoutStats();
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCheckouts();
    await loadStats();
    toast.success('Data refreshed');
  };

  const handleExport = async () => {
    try {
      const blob = await checkoutService.exportCheckouts({
        format: 'csv',
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `checkouts_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Checkouts exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export checkouts');
    }
  };

  const handleViewDetails = (checkout: Sale) => {
    setSelectedCheckout(checkout);
    setShowDetailModal(true);
  };

  const handleVoidCheckout = async (checkout: Sale) => {
    if (!confirm(`Are you sure you want to void checkout ${checkout.receiptNumber}?`)) return;
    
    try {
      await checkoutService.voidCheckout(checkout.id);
      toast.success('Checkout voided successfully');
      await loadCheckouts();
      await loadStats();
    } catch (error: any) {
      console.error('Failed to void checkout:', error);
      toast.error(error?.message || 'Failed to void checkout');
    }
  };

  const handleDeleteCheckout = async () => {
    if (!selectedCheckout) return;
    
    setDeleteLoading(true);
    try {
      await checkoutService.deleteCheckout(selectedCheckout.id);
      toast.success('Checkout deleted successfully');
      setShowDeleteModal(false);
      setSelectedCheckout(null);
      await loadCheckouts();
      await loadStats();
    } catch (error: any) {
      console.error('Failed to delete checkout:', error);
      toast.error(error?.message || 'Failed to delete checkout');
    } finally {
      setDeleteLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'CANCELLED':
      case 'VOIDED':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';
    }
  };

  const renderStars = (rating?: number) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3 h-3 ${star <= Math.round(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'}`}
          />
        ))}
      </div>
    );
  };

  // Permission check
  if (permissionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!canViewCheckouts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view checkouts. Please contact your administrator.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 transition-colors duration-200">
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
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Sales', value: stats?.totalSales || 0, icon: ShoppingBag, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
            { label: 'Total Revenue', value: formatCurrency(stats?.totalRevenue || 0), icon: DollarSign, color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
            { label: 'Average Order', value: formatCurrency(stats?.averageOrderValue || 0), icon: TrendingUp, color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
            { label: 'Total Customers', value: stats?.totalCustomers || 0, icon: Users, color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by receipt, customer, email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
              />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                showFilters || (filters.status !== 'all' || filters.paymentStatus !== 'all' || filters.dateFrom || filters.dateTo)
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>

            <select
              value={filters.sortBy}
              onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="createdAt">Sort by Date</option>
              <option value="total">Sort by Amount</option>
              <option value="status">Sort by Status</option>
            </select>
          </div>

          {/* Expanded Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Status</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="PENDING">Pending</option>
                      <option value="PROCESSING">Processing</option>
                      <option value="CANCELLED">Cancelled</option>
                      <option value="VOIDED">Voided</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Status</label>
                    <select
                      value={filters.paymentStatus}
                      onChange={(e) => setFilters(prev => ({ ...prev, paymentStatus: e.target.value }))}
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date From</label>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date To</label>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => {
                      setFilters(prev => ({
                        ...prev,
                        status: 'all',
                        paymentStatus: 'all',
                        dateFrom: '',
                        dateTo: '',
                      }));
                      setSearchInput('');
                    }}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
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
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">No checkouts found</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Receipt</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {checkouts.map((checkout) => (
                    <tr key={checkout.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
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
                        {formatDate(checkout.saleDate || checkout.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {checkout.customerName || 'Guest'}
                          </p>
                          {checkout.customerEmail && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{checkout.customerEmail}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {formatCurrency(checkout.total)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Paid: {formatCurrency(checkout.paidAmount || checkout.total)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs capitalize text-gray-600 dark:text-gray-400">
                          {checkout.paymentMethod?.toLowerCase().replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(checkout.status)}`}>
                            {checkout.status}
                          </span>
                          {checkout.paymentStatus && (
                            <span className={`px-2 py-1 text-xs font-medium rounded-full block ${
                              checkout.paymentStatus === 'PAID' 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : checkout.paymentStatus === 'PENDING'
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                : checkout.paymentStatus === 'REFUNDED'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300'
                            }`}>
                              {checkout.paymentStatus}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleViewDetails(checkout)}
                            className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4 text-blue-500" />
                          </button>
                          {canManageCheckouts && checkout.status !== 'VOIDED' && checkout.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleVoidCheckout(checkout)}
                              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                              title="Void checkout"
                            >
                              <XCircle className="w-4 h-4 text-red-500" />
                            </button>
                          )}
                          {canManageCheckouts && (checkout.status === 'PENDING' || checkout.status === 'PROCESSING') && (
                            <button
                              onClick={() => {
                                setSelectedCheckout(checkout);
                                setShowDeleteModal(true);
                              }}
                              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                              title="Delete checkout"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const url = `${window.location.origin}/receipt/${checkout.receiptNumber}`;
                              navigator.clipboard.writeText(url);
                              toast.success('Receipt link copied');
                            }}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Copy receipt link"
                          >
                            <Copy className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </p>
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                  let pageNum: number;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                      className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                        pagination.page === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center gap-1"
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
          >
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" />
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
                      {formatDate(selectedCheckout.saleDate || selectedCheckout.createdAt)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Customer Info */}
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Customer Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900 dark:text-white">{selectedCheckout.customerName || 'Guest'}</span>
                    </div>
                    {selectedCheckout.customerEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900 dark:text-white">{selectedCheckout.customerEmail}</span>
                      </div>
                    )}
                    {selectedCheckout.customerPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900 dark:text-white">{selectedCheckout.customerPhone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900 dark:text-white">{selectedCheckout.businessUnitName || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Items</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {(selectedCheckout.items || []).map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{item.productName}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {item.quantity} × {formatCurrency(item.unitPrice)}
                            {item.variantName && <span className="ml-2 text-xs">({item.variantName})</span>}
                          </p>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                      <span className="text-gray-900 dark:text-white">{formatCurrency(selectedCheckout.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Tax</span>
                      <span className="text-gray-900 dark:text-white">{formatCurrency(selectedCheckout.tax)}</span>
                    </div>
                    {selectedCheckout.discount > 0 && (
                      <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                        <span>Discount</span>
                        <span>-{formatCurrency(selectedCheckout.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-gray-900 dark:text-white">Total</span>
                      <span className="text-gray-900 dark:text-white">{formatCurrency(selectedCheckout.total)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                      <span>Paid</span>
                      <span>{formatCurrency(selectedCheckout.paidAmount || selectedCheckout.total)}</span>
                    </div>
                    {selectedCheckout.changeAmount > 0 && (
                      <div className="flex justify-between text-sm text-orange-500 dark:text-orange-400">
                        <span>Change</span>
                        <span>{formatCurrency(selectedCheckout.changeAmount)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Payment Method</p>
                    <p className="font-medium text-gray-900 dark:text-white capitalize">
                      {selectedCheckout.paymentMethod?.toLowerCase().replace('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Status</p>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(selectedCheckout.status)}`}>
                      {selectedCheckout.status}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                {selectedCheckout.notes && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">{selectedCheckout.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      const printWindow = window.open('', '_blank');
                      if (printWindow) {
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
                                <p>${formatDate(receipt.saleDate || receipt.createdAt)}</p>
                              </div>
                              ${(receipt.items || []).map(item => `
                                <div class="item">
                                  <span>${item.productName} × ${item.quantity}</span>
                                  <span>${formatCurrency(item.total)}</span>
                                </div>
                              `).join('')}
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
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Print Receipt
                  </button>
                  <button
                    onClick={() => {
                      const receiptData = selectedCheckout;
                      const blob = new Blob([JSON.stringify(receiptData, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `receipt-${receiptData.receiptNumber}.json`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                      toast.success('Receipt downloaded');
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-300"
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
          >
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowDeleteModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Checkout</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete checkout <strong className="text-gray-900 dark:text-white">#{selectedCheckout.receiptNumber}</strong>?
                This will permanently remove all associated data.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteCheckout}
                  disabled={deleteLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deleteLoading ? 'Deleting...' : 'Delete Checkout'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
