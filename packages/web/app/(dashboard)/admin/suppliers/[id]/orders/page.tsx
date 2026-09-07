// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\suppliers\[id]\orders\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, FileText, RefreshCw, Loader2, Search, Lock, AlertCircle,
  X, CheckCircle, Clock, Package, DollarSign, Filter,
  ChevronDown, ChevronUp, Eye, Printer, Download, Calendar,
  TrendingUp, TrendingDown, ShoppingBag, Truck, Star
} from 'lucide-react';
import { useAuth } from '../../../../../../hooks/useAuth';
import { usePermission } from '../../../../../../hooks/usePermission';
import { supplierService } from '../../../../../../services/supplierService';
import { toast } from '../../../../../../utils/toast-manager';
import { formatCurrency, formatDate } from '../../../../../../utils/formatters';
import { PermissionResource } from '../../../../../../types/enums';

// ============================================
// TYPES
// ============================================

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  orderDate: string;
  total: number;
  status: string;
  itemsCount: number;
  currency?: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    total: number;
    product?: {
      name: string;
      sku: string;
    };
  }>;
}

interface OrderFilters {
  search: string;
  status: 'all' | 'PENDING' | 'APPROVED' | 'RECEIVED' | 'PARTIALLY_RECEIVED' | 'COMPLETED' | 'CANCELLED' | 'DRAFT';
  sortBy: 'orderDate' | 'total' | 'status' | 'itemsCount';
  sortOrder: 'asc' | 'desc';
  dateRange: 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year';
}

interface OrderStats {
  total: number;
  totalAmount: number;
  pending: number;
  completed: number;
  cancelled: number;
  averageOrderValue: number;
}

// ============================================
// SUB-COMPONENTS
// ============================================

const OrderStatsCards: React.FC<{ stats: OrderStats; loading?: boolean }> = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-20"></div>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Total Orders', value: stats.total, icon: FileText, color: 'blue' },
    { label: 'Total Spent', value: formatCurrency(stats.totalAmount), icon: DollarSign, color: 'green' },
    { label: 'Pending', value: stats.pending, icon: Clock, color: 'yellow' },
    { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'green' },
    { label: 'Avg. Order Value', value: formatCurrency(stats.averageOrderValue), icon: TrendingUp, color: 'purple' },
  ];

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{card.label}</p>
              <div className={`p-1.5 rounded-lg ${colorClasses[card.color] || colorClasses.blue}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{card.value}</p>
          </motion.div>
        );
      })}
    </div>
  );
};

const OrderFiltersBar: React.FC<{
  filters: OrderFilters;
  onFilterChange: (key: keyof OrderFilters, value: any) => void;
  onReset: () => void;
  loading?: boolean;
}> = ({ filters, onFilterChange, onReset, loading }) => {
  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'RECEIVED', label: 'Received' },
    { value: 'PARTIALLY_RECEIVED', label: 'Partially Received' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED', label: 'Cancelled' },
    { value: 'DRAFT', label: 'Draft' },
  ];

  const dateRangeOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
  ];

  const sortOptions = [
    { value: 'orderDate', label: 'Order Date' },
    { value: 'total', label: 'Total' },
    { value: 'status', label: 'Status' },
    { value: 'itemsCount', label: 'Items' },
  ];

  const activeFilterCount = [
    filters.search ? 1 : 0,
    filters.status !== 'all' ? 1 : 0,
    filters.dateRange !== 'all' ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders by order number..."
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            disabled={loading}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filters.status}
            onChange={(e) => onFilterChange('status', e.target.value)}
            disabled={loading}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border-0 disabled:opacity-50"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={filters.dateRange}
            onChange={(e) => onFilterChange('dateRange', e.target.value)}
            disabled={loading}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border-0 disabled:opacity-50"
          >
            {dateRangeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={filters.sortBy}
            onChange={(e) => onFilterChange('sortBy', e.target.value)}
            disabled={loading}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border-0 disabled:opacity-50"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>Sort by {opt.label}</option>
            ))}
          </select>

          <button
            onClick={() => onFilterChange('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
            disabled={loading}
            className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            {filters.sortOrder === 'asc' ? '↑' : '↓'}
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={onReset}
              disabled={loading}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 flex items-center gap-1 disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const OrderCard: React.FC<{
  order: PurchaseOrder;
  index: number;
}> = ({ order, index }) => {
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'COMPLETED': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800',
      'PENDING': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
      'CANCELLED': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
      'APPROVED': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      'DRAFT': 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300 border-gray-200 dark:border-gray-600',
      'RECEIVED': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      'PARTIALLY_RECEIVED': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300 border-gray-200 dark:border-gray-600';
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, React.ReactNode> = {
      'COMPLETED': <CheckCircle className="w-4 h-4" />,
      'PENDING': <Clock className="w-4 h-4" />,
      'CANCELLED': <X className="w-4 h-4" />,
      'APPROVED': <CheckCircle className="w-4 h-4" />,
      'DRAFT': <FileText className="w-4 h-4" />,
      'RECEIVED': <Truck className="w-4 h-4" />,
      'PARTIALLY_RECEIVED': <Truck className="w-4 h-4" />,
    };
    return icons[status] || <FileText className="w-4 h-4" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
            <FileText className="w-5 h-5 text-blue-500" />
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-gray-900 dark:text-white truncate">{order.orderNumber}</h4>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(order.orderDate || order.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0 ml-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 border ${getStatusColor(order.status)}`}>
            {getStatusIcon(order.status)}
            {order.status || 'DRAFT'}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {formatCurrency(order.total)}
          </p>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Items</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {order.itemsCount || 0}
          </p>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Date</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {formatDate(order.createdAt, 'MMM d, yyyy')}
          </p>
        </div>
      </div>

      {order.notes && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 truncate">
          📝 {order.notes}
        </div>
      )}
    </motion.div>
  );
};

const OrderTable: React.FC<{
  orders: PurchaseOrder[];
}> = ({ orders }) => {
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'COMPLETED': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      'PENDING': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      'CANCELLED': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      'APPROVED': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      'DRAFT': 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
      'RECEIVED': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      'PARTIALLY_RECEIVED': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Order #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Date</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Items</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-900 dark:text-white">{order.orderNumber}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hidden sm:table-cell">
                  {formatDate(order.orderDate || order.createdAt)}
                </td>
                <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                  {formatCurrency(order.total)}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {order.status || 'DRAFT'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-300 hidden md:table-cell">
                  {order.itemsCount || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function SupplierOrdersPage() {
  const params = useParams();
  const supplierId = params?.id as string;
  const { user } = useAuth();
  const { canView, canManage, isLoading: permissionLoading } = usePermission();
  
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<OrderFilters>({
    search: '',
    status: 'all',
    sortBy: 'orderDate',
    sortOrder: 'desc',
    dateRange: 'all',
  });

  const canViewOrders = canView(PermissionResource.SUPPLIER) || canManage(PermissionResource.SUPPLIER);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && supplierId) {
      loadOrders();
    }
  }, [supplierId, isClient]);

  const loadOrders = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const data = await supplierService.getSupplierOrderHistory(supplierId);
      
      let ordersData: any[] = [];
      if (data && typeof data === 'object') {
        if ('data' in data && Array.isArray(data.data)) {
          ordersData = data.data;
        } else if (Array.isArray(data)) {
          ordersData = data;
        }
      }
      
      setOrders(ordersData);
    } catch (error) {
      console.error('Failed to load orders:', error);
      setError('Failed to load orders. Please try again.');
      toast.error('Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOrders(false);
    toast.success('Orders refreshed');
  };

  const handleFilterChange = (key: keyof OrderFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      sortBy: 'orderDate',
      sortOrder: 'desc',
      dateRange: 'all',
    });
  };

  // Calculate stats
  const stats = useMemo(() => {
    const total = orders.length;
    const totalAmount = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const pending = orders.filter(o => o.status === 'PENDING').length;
    const completed = orders.filter(o => o.status === 'COMPLETED' || o.status === 'RECEIVED').length;
    const cancelled = orders.filter(o => o.status === 'CANCELLED').length;
    const averageOrderValue = total > 0 ? totalAmount / total : 0;

    return { total, totalAmount, pending, completed, cancelled, averageOrderValue };
  }, [orders]);

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    let filtered = [...orders];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(o =>
        o.orderNumber?.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(o => o.status === filters.status);
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      let startDate = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          break;
      }
      
      filtered = filtered.filter(o => {
        const orderDate = new Date(o.orderDate || o.createdAt);
        return orderDate >= startDate;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'orderDate':
          comparison = new Date(a.orderDate || a.createdAt).getTime() - new Date(b.orderDate || b.createdAt).getTime();
          break;
        case 'total':
          comparison = (a.total || 0) - (b.total || 0);
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'itemsCount':
          comparison = (a.itemsCount || 0) - (b.itemsCount || 0);
          break;
        default:
          comparison = 0;
      }
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [orders, filters]);

  // Loading state
  if (permissionLoading || !isClient || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading orders...</p>
        </div>
      </div>
    );
  }

  // Permission check
  if (!canViewOrders) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view supplier orders. Please contact your administrator.
        </p>
        <button
          onClick={() => window.history.back()}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 transition-colors duration-200">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/admin/suppliers/${supplierId}`}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500" />
                Purchase Orders
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                <span>{orders.length} orders</span>
                {filteredOrders.length !== orders.length && (
                  <span className="text-blue-600 dark:text-blue-400">
                    ({filteredOrders.length} filtered)
                  </span>
                )}
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  {stats.pending} pending
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  {stats.completed} completed
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-600"></span>
                  {formatCurrency(stats.totalAmount)} total spent
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle view mode"
            >
              {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => window.print()}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <OrderStatsCards stats={stats} loading={loading} />

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
            <button
              onClick={() => loadOrders(false)}
              className="ml-auto px-3 py-1 bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* Filters */}
        <OrderFiltersBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
          loading={loading}
        />

        {/* Orders Display */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No orders found</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              {filters.search || filters.status !== 'all' || filters.dateRange !== 'all'
                ? 'Try adjusting your filters or search terms'
                : 'No purchase orders from this supplier yet'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((order, index) => (
              <OrderCard key={order.id} order={order} index={index} />
            ))}
          </div>
        ) : (
          <OrderTable orders={filteredOrders} />
        )}

        {/* Footer Info */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
          <span>
            Showing {filteredOrders.length} of {orders.length} orders
            {filters.status !== 'all' && ` (filtered by ${filters.status})`}
            {filters.dateRange !== 'all' && ` (${filters.dateRange})`}
          </span>
          <span>
            Total: {formatCurrency(stats.totalAmount)} across {stats.total} orders
          </span>
          <span>
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}

// Add missing imports
import { List, Grid } from 'lucide-react';
