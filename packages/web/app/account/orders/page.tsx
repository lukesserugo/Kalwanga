// D:\Projects\Kalwanga\packages\web\app\account\orders\page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Package, Clock, CheckCircle, XCircle,
  AlertCircle, Loader2, ChevronRight, Eye,
  Search, Calendar, Download, Printer, ArrowLeft,
  DollarSign, Receipt, RefreshCw, X
} from 'lucide-react';
import { useThemeStore } from '../../stores/themeStore';
import { api } from '../../../services/api';
import { formatCurrency, formatDate, formatDateTime } from '../../../utils/formatters';
import { toast } from '../../../utils/toast-manager';
import PublicNavigation from '../../../components/PublicNavigation';

// ============================================
// TYPES
// ============================================

interface Order {
  id: string;
  orderNumber: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'ON_HOLD';
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIAL';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  payment?: {
    id: string;
    amount: number;
    paymentMethod: string;
    status: string;
    processedAt: string;
  };
}

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  variantName?: string;
  product?: {
    id: string;
    name: string;
    images: string[];
  };
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

// ============================================
// CONSTANTS
// ============================================

const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  PROCESSING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  REFUNDED: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
  ON_HOLD: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
};

const ORDER_STATUS_ICONS: Record<string, any> = {
  PENDING: Clock,
  PROCESSING: RefreshCw,
  COMPLETED: CheckCircle,
  CANCELLED: XCircle,
  REFUNDED: AlertCircle,
  ON_HOLD: Clock,
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  PAID: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  REFUNDED: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
  PARTIAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function AccountOrdersPage() {
  const router = useRouter();
  const { isDark } = useThemeStore();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 10,
  });

  // Load orders
  useEffect(() => {
    loadOrders();
  }, [pagination.page, statusFilter]);

  const loadOrders = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setError(null);
      }

      const params: Record<string, any> = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      if (searchQuery) {
        params.search = searchQuery;
      }

      const response = await api.get<ApiResponse<Order[]>>('/orders', { params });

      if (response && response.data) {
        setOrders(response.data);
        if (response.pagination) {
          setPagination({
            page: response.pagination.page || 1,
            total: response.pagination.total || 0,
            totalPages: response.pagination.totalPages || 1,
            limit: response.pagination.limit || 10,
          });
        }
      } else {
        setOrders([]);
        setPagination({
          page: 1,
          total: 0,
          totalPages: 1,
          limit: 10,
        });
      }

    } catch (error: any) {
      console.error('Failed to load orders:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to load orders';
      setError(errorMessage);
      toast.error(errorMessage);
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadOrders(true);
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderDetail(true);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadOrders();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPagination(prev => ({ ...prev, page: 1 }));
    setTimeout(() => loadOrders(), 100);
  };

  const getStatusColor = (status: string) => {
    return ORDER_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';
  };

  const getStatusIcon = (status: string) => {
    const Icon = ORDER_STATUS_ICONS[status] || AlertCircle;
    return <Icon className="w-4 h-4" />;
  };

  const getPaymentStatusColor = (status: string) => {
    return PAYMENT_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'dark bg-gray-950' : 'bg-gray-50'} transition-colors`}>
        <PublicNavigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
            <p className={`mt-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Loading your orders...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-gray-950' : 'bg-gray-50'} transition-colors`}>
      <PublicNavigation />

      <div className="max-w-6xl mx-auto px-4 py-8 mt-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className={`p-2 rounded-lg transition ${
                isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                My Orders
              </h1>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                View and track all your orders
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`p-2 rounded-lg transition ${
                isDark
                  ? 'bg-gray-800 hover:bg-gray-700 text-white'
                  : 'bg-white hover:bg-gray-100 text-gray-700'
              } border ${isDark ? 'border-gray-700' : 'border-gray-300'} disabled:opacity-50`}
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Orders', value: orders.length, icon: ShoppingBag, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
            { label: 'Pending', value: orders.filter(o => o.status === 'PENDING').length, icon: Clock, color: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' },
            { label: 'Completed', value: orders.filter(o => o.status === 'COMPLETED').length, icon: CheckCircle, color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
            { label: 'Total Spent', value: formatCurrency(orders.reduce((sum, o) => sum + o.total, 0)), icon: DollarSign, color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{stat.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className={`p-4 rounded-xl mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800`}>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <p className={`text-sm font-medium ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                  Failed to load orders
                </p>
                <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                  {error}
                </p>
              </div>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className={`p-4 rounded-xl mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm ${
                  isDark
                    ? 'bg-gray-700 text-white placeholder-gray-400'
                    : 'bg-gray-100 text-gray-900 placeholder-gray-500'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`px-4 py-2 rounded-lg border text-sm ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              <option value="all">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="REFUNDED">Refunded</option>
              <option value="ON_HOLD">On Hold</option>
            </select>

            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
            >
              Apply
            </button>

            {(searchQuery || statusFilter !== 'all') && (
              <button
                onClick={handleClearFilters}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className={`text-center py-12 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <ShoppingBag className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              No orders found
            </h3>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {searchQuery || statusFilter !== 'all' 
                ? 'Try adjusting your filters or search terms'
                : 'You haven\'t placed any orders yet'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Link
                href="/shop"
                className="mt-4 inline-flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <ShoppingBag className="w-4 h-4" />
                Start Shopping
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`rounded-xl overflow-hidden border ${
                  isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                } hover:shadow-md transition-shadow`}
              >
                <div className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Order Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <p className={`font-mono text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          #{order.orderNumber || order.id.slice(0, 8)}
                        </p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                          {getStatusLabel(order.status)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(order.paymentStatus)}`}>
                          {order.paymentStatus}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm">
                        <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                          <Calendar className="w-3 h-3 inline mr-1" />
                          {formatDate(order.createdAt)}
                        </span>
                        <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                          <Package className="w-3 h-3 inline mr-1" />
                          {order.items?.length || 0} items
                        </span>
                      </div>
                    </div>

                    {/* Amount & Actions */}
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {formatCurrency(order.total)}
                        </p>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {order.paymentStatus === 'PAID' ? 'Paid' : 'Due'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleViewOrder(order)}
                        className={`p-2 rounded-lg transition ${
                          isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                        }`}
                        title="View order details"
                      >
                        <Eye className="w-5 h-5 text-blue-500" />
                      </button>
                      <ChevronRight className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    </div>
                  </div>

                  {/* Items Preview */}
                  {order.items && order.items.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex flex-wrap gap-3">
                        {order.items.slice(0, 3).map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-sm">
                            <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                              {item.productName || `Item ${item.productId}`}
                            </span>
                            <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>
                              × {item.quantity}
                            </span>
                            <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                              {formatCurrency(item.total)}
                            </span>
                          </div>
                        ))}
                        {order.items.length > 3 && (
                          <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            +{order.items.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className={`mt-6 px-4 py-3 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'} flex flex-wrap items-center justify-between gap-3`}>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} orders
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className={`px-3 py-1 rounded-lg text-sm transition disabled:opacity-50 ${
                  isDark
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                } border`}
              >
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
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-1 rounded-lg text-sm transition ${
                      pagination.page === pageNum
                        ? 'bg-blue-600 text-white'
                        : isDark
                          ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                    } border`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className={`px-3 py-1 rounded-lg text-sm transition disabled:opacity-50 ${
                  isDark
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                } border`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {showOrderDetail && selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
            onClick={() => setShowOrderDetail(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`max-w-3xl w-full rounded-xl shadow-xl p-6 ${
                isDark ? 'bg-gray-800' : 'bg-white'
              } max-h-[90vh] overflow-y-auto`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Order #{selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)}
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Placed on {formatDateTime(selectedOrder.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => setShowOrderDetail(false)}
                  className={`p-2 rounded-lg transition ${
                    isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Order Status */}
              <div className={`p-4 rounded-lg mb-4 ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                <div className="flex flex-wrap items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${getStatusColor(selectedOrder.status)}`}>
                    {getStatusIcon(selectedOrder.status)}
                    {getStatusLabel(selectedOrder.status)}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPaymentStatusColor(selectedOrder.paymentStatus)}`}>
                    {selectedOrder.paymentStatus}
                  </span>
                  {selectedOrder.payment && (
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Paid: {formatCurrency(selectedOrder.payment.amount)} via {selectedOrder.payment.paymentMethod}
                    </span>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div className="mb-4">
                <h4 className={`text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Items ({selectedOrder.items?.length || 0})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className={`flex items-center gap-4 py-2 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                      <div className="flex-1">
                        <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {item.productName || `Product ${item.productId}`}
                        </p>
                        {item.variantName && (
                          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Variant: {item.variantName}
                          </p>
                        )}
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {item.quantity} × {formatCurrency(item.unitPrice)}
                        </p>
                      </div>
                      <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Subtotal</span>
                    <span className={isDark ? 'text-white' : 'text-gray-900'}>
                      {formatCurrency(selectedOrder.subtotal)}
                    </span>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Discount</span>
                      <span className="text-green-600 dark:text-green-400">
                        -{formatCurrency(selectedOrder.discount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Tax</span>
                    <span className={isDark ? 'text-white' : 'text-gray-900'}>
                      {formatCurrency(selectedOrder.tax)}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className={isDark ? 'text-white' : 'text-gray-900'}>Total</span>
                    <span className={isDark ? 'text-white' : 'text-gray-900'}>
                      {formatCurrency(selectedOrder.total)}
                    </span>
                  </div>
                  {selectedOrder.notes && (
                    <div className="pt-2 text-sm">
                      <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>Notes:</p>
                      <p className={isDark ? 'text-white' : 'text-gray-900'}>
                        {selectedOrder.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    setShowOrderDetail(false);
                    router.push(`/invoice/${selectedOrder.id}`);
                  }}
                  className={`px-4 py-2 border rounded-lg transition ${
                    isDark
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  } flex items-center gap-2`}
                >
                  <Receipt className="w-4 h-4" />
                  View Invoice
                </button>
                <button
                  onClick={() => window.print()}
                  className={`px-4 py-2 border rounded-lg transition ${
                    isDark
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  } flex items-center gap-2`}
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
