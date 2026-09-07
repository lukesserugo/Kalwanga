'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, 
  TrendingUp, 
  Users, 
  Calendar,
  Filter,
  Search,
  RefreshCw,
  Download,
  Eye,
  Printer,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  User,
  DollarSign,
  FileText,
  BarChart3,
  Package,
  Receipt,
  Lock,
  Loader2,
  Tag,
  Store,
  Phone,
  Mail,
  Plus
} from 'lucide-react';
import { saleService } from '../../../../services/saleService';
import { formatCurrency, formatDate, formatTime } from '../../../../utils/formatters';
import { toast } from '../../../../utils/toast-manager';
import { useAuth } from '../../../../hooks/useAuth';
import { usePermission } from '../../../../hooks/usePermission';
import { PermissionResource } from '../../../../types/enums';
import { Sale, SaleItem } from '../../../../types/sale';

// Define user role type
type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'CASHIER' | 'VIEWER';

// FIXED: Extended SalesStats interface matching the service
interface SalesStats {
  totalRevenue: number;
  totalSales: number;
  averageTicket: number;
  todayRevenue: number;
  todaySales: number;
  pendingOrders: number;
  refundedOrders: number;
  totalItems: number;
  // Additional fields that may come from API
  totalSubtotal?: number;
  totalTax?: number;
  totalDiscount?: number;
  totalCustomers?: number;
  averageItemsPerSale?: number;
}

// ============================================
// SUB-COMPONENTS
// ============================================

const StatCard: React.FC<{
  label: string;
  value: string | number;
  color?: string;
  icon?: React.ElementType;
  subtext?: string;
}> = ({ label, value, color = 'blue', icon: Icon, subtext }) => {
  const colorClasses: Record<string, string> = {
    blue: 'border-blue-200 dark:border-blue-800',
    green: 'border-green-200 dark:border-green-800',
    yellow: 'border-yellow-200 dark:border-yellow-800',
    red: 'border-red-200 dark:border-red-800',
    purple: 'border-purple-200 dark:border-purple-800',
    indigo: 'border-indigo-200 dark:border-indigo-800',
    teal: 'border-teal-200 dark:border-teal-800',
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border ${colorClasses[color] || colorClasses.blue}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        {Icon && <Icon className="w-4 h-4 text-gray-400" />}
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
      {subtext && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtext}</p>}
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle },
    PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300', icon: Clock },
    PROCESSING: { label: 'Processing', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: RefreshCw },
    CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
    REFUNDED: { label: 'Refunded', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', icon: AlertCircle },
    ON_HOLD: { label: 'On Hold', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', icon: Clock },
  };

  const config = statusConfig[status] || statusConfig.PENDING;
  const Icon = config.icon;

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function SalesPage() {
  const { user: clerkUser, isLoaded } = useUser();
  const { user: authUser } = useAuth();
  const { canView, canManage } = usePermission();
  const router = useRouter();
  
  const [orders, setOrders] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [filter, setFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState<SalesStats>({
    totalRevenue: 0,
    totalSales: 0,
    averageTicket: 0,
    todayRevenue: 0,
    todaySales: 0,
    pendingOrders: 0,
    refundedOrders: 0,
    totalItems: 0,
  });
  const [showStats, setShowStats] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const limit = 10;

  // Get user role
  const userRole = (authUser?.role || clerkUser?.publicMetadata?.role || 'VIEWER') as UserRole;

  // Permission checks
  const canViewSales = useCallback(() => {
    return canView?.(`${PermissionResource.SALE}:view`) || 
           ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'CASHIER'].includes(userRole);
  }, [userRole, canView]);

  const canManageSales = useCallback(() => {
    return canManage?.(`${PermissionResource.SALE}:manage`) || 
           ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userRole);
  }, [userRole, canManage]);

  const canViewAllSales = useCallback(() => {
    return canView?.(`${PermissionResource.SALE}:view_all`) || 
           ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userRole);
  }, [userRole, canView]);

  const canViewStats = useCallback(() => {
    return canView?.(`${PermissionResource.SALE}:view_stats`) || 
           ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userRole);
  }, [userRole, canView]);

  // Get business unit ID for filtering
  const getBusinessUnitId = useCallback(() => {
    if (userRole === 'MANAGER' && authUser?.businessUnits?.length) {
      return authUser.businessUnits[0].businessUnitId;
    }
    return undefined;
  }, [userRole, authUser]);

  // Redirect if not authenticated or not authorized
  useEffect(() => {
    if (isLoaded && !clerkUser) {
      router.push('/login?redirect=/admin/sales');
      return;
    }
    if (isLoaded && clerkUser && !canViewSales()) {
      router.push('/dashboard');
      toast.error('You do not have permission to view sales');
    }
  }, [isLoaded, clerkUser, router, canViewSales]);

  // Fetch orders when user, page, filter, or search changes
  useEffect(() => {
    if (authUser && canViewSales()) {
      fetchOrders();
      if (canViewStats()) {
        fetchStats();
      }
    }
  }, [authUser, page, filter, searchQuery, dateRange]);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!authUser) return;

    try {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);

      const params: any = {
        page,
        limit,
      };

      if (filter) params.status = filter;
      if (searchQuery) params.search = searchQuery;
      if (dateRange.start) params.startDate = dateRange.start;
      if (dateRange.end) params.endDate = dateRange.end;

      // Role-based filtering
      if (!canViewAllSales()) {
        if (userRole === 'CASHIER' || userRole === 'EMPLOYEE') {
          // Cashiers and employees only see their own sales
          params.userId = authUser.id;
        } else if (userRole === 'MANAGER' && authUser.businessUnits?.length) {
          // Managers see sales from their business unit
          params.businessUnitId = authUser.businessUnits[0].businessUnitId;
        }
      }
      // SUPER_ADMIN and ADMIN see all sales

      const result = await saleService.getAllSales(params);
      
      if (result?.data) {
        setOrders(result.data);
        setTotalPages(result.totalPages || 1);
        setTotalOrders(result.total || result.data.length);
      } else {
        setOrders([]);
        setTotalPages(1);
        setTotalOrders(0);
      }
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      
      if (error?.response?.status === 401) {
        router.push('/login?redirect=/admin/sales');
      } else if (error?.response?.status === 403) {
        toast.error('You do not have permission to view these sales');
      } else {
        toast.error('Failed to load orders');
      }
      setOrders([]);
      setTotalPages(1);
      setTotalOrders(0);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [authUser, page, filter, searchQuery, dateRange, userRole, router, canViewAllSales]);

  // FIXED: Fetch stats with proper mapping from API response
  const fetchStats = useCallback(async () => {
    if (!authUser || !canViewStats()) return;

    try {
      const params: any = {};
      if (userRole === 'MANAGER' && authUser.businessUnits?.length) {
        params.businessUnitId = authUser.businessUnits[0].businessUnitId;
      }

      const response = await saleService.getSalesStats(params);
      
      if (response) {
        // Calculate today's stats from orders if available
        const today = new Date().toISOString().split('T')[0];
        let todayRevenue = 0;
        let todaySales = 0;
        
        if (orders.length > 0) {
          const todayOrders = orders.filter(order => {
            const orderDate = order.saleDate || order.createdAt;
            if (!orderDate) return false;
            const dateStr = typeof orderDate === 'string' 
              ? orderDate.split('T')[0] 
              : new Date(orderDate).toISOString().split('T')[0];
            return dateStr === today;
          });
          todayRevenue = todayOrders.reduce((sum, order) => sum + order.total, 0);
          todaySales = todayOrders.length;
        }

        // FIXED: Use response.todayRevenue/todaySales if available, otherwise calculate
        setStats({
          totalRevenue: response.totalRevenue || 0,
          totalSales: response.totalSales || 0,
          averageTicket: response.averageTicket || 0,
          todayRevenue: response.todayRevenue || todayRevenue || 0,
          todaySales: response.todaySales || todaySales || 0,
          pendingOrders: response.pendingOrders || 0,
          refundedOrders: response.refundedOrders || 0,
          totalItems: response.totalItemsSold || response.totalItems || 0,
          totalSubtotal: response.totalSubtotal || 0,
          totalTax: response.totalTax || 0,
          totalDiscount: response.totalDiscount || 0,
          totalCustomers: response.totalCustomers || 0,
          averageItemsPerSale: response.averageItemsPerSale || 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, [authUser, userRole, canViewStats, orders]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilter(e.target.value);
    setPage(1);
  };

  const handlePrintReceipt = (order: Sale) => {
    toast.info('Printing receipt...');
  };

  const handleExport = async () => {
    if (!canViewStats()) {
      toast.error('You do not have permission to export sales');
      return;
    }

    try {
      const params: any = {
        startDate: dateRange.start,
        endDate: dateRange.end,
        format: 'csv',
      };
      if (filter) params.status = filter;
      if (userRole === 'MANAGER' && authUser?.businessUnits?.length) {
        params.businessUnitId = authUser.businessUnits[0].businessUnitId;
      }

      const blob = await saleService.exportSalesCsv(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales-${dateRange.start}-${dateRange.end}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Sales exported successfully');
    } catch (error) {
      console.error('Failed to export:', error);
      toast.error('Failed to export sales');
    }
  };

  const handleRefund = async (order: Sale) => {
    if (!confirm(`Are you sure you want to refund order #${order.receiptNumber}?`)) return;
    
    try {
      await saleService.refundSale(order.id, 'Customer requested refund');
      toast.success('Order refunded successfully');
      fetchOrders(true);
      fetchStats();
    } catch (error) {
      console.error('Failed to refund:', error);
      toast.error('Failed to refund order');
    }
  };

  // FIXED: Safe date formatting helper
  const safeFormatDate = (date: string | Date | undefined | null): string => {
    if (!date) return 'N/A';
    const dateStr = typeof date === 'string' ? date : date.toISOString();
    return formatDate(dateStr);
  };

  // FIXED: Safe time formatting helper
  const safeFormatTime = (date: string | Date | undefined | null): string => {
    if (!date) return '';
    const dateStr = typeof date === 'string' ? date : date.toISOString();
    return formatTime(dateStr);
  };

  // Loading skeleton
  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 pt-8 pb-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 h-24 animate-pulse"></div>
              ))}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 h-64 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  // Check if user has access
  if (!authUser || !canViewSales()) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 pt-8 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {userRole === 'CASHIER' ? 'My Sales' : 'Sales'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {canViewAllSales() 
                ? 'View and manage all sales transactions' 
                : userRole === 'MANAGER'
                ? 'View sales for your business unit'
                : 'View your sales transactions'}
              {totalOrders > 0 && ` · ${totalOrders} total orders`}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => fetchOrders(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh
            </button>
            {canViewStats() && (
              <>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button
                  onClick={() => setShowStats(!showStats)}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                    showStats 
                      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' 
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Stats
                </button>
              </>
            )}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
              >
                <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
              >
                <Package className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <Link
              href="/dashboard"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center"
            >
              Dashboard →
            </Link>
          </div>
        </div>

        {/* Role-based info banner */}
        {!canViewAllSales() && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4 text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>
              {userRole === 'CASHIER' 
                ? 'Showing only your sales. You can view your transaction history here.'
                : userRole === 'EMPLOYEE'
                ? 'Showing only your sales. You can view your transaction history here.'
                : userRole === 'MANAGER'
                ? 'Showing sales for your business unit. You can manage sales within your unit.'
                : 'Showing your sales.'}
            </span>
          </div>
        )}

        {/* Stats Cards */}
        {showStats && canViewStats() && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6"
          >
            <StatCard
              label="Total Revenue"
              value={formatCurrency(stats.totalRevenue)}
              color="green"
              icon={DollarSign}
            />
            <StatCard
              label="Total Sales"
              value={stats.totalSales}
              color="blue"
              icon={ShoppingBag}
            />
            <StatCard
              label="Average Ticket"
              value={formatCurrency(stats.averageTicket)}
              color="purple"
              icon={TrendingUp}
            />
            <StatCard
              label="Today's Revenue"
              value={formatCurrency(stats.todayRevenue)}
              color="indigo"
              icon={Calendar}
            />
            <StatCard
              label="Today's Sales"
              value={stats.todaySales}
              color="teal"
              icon={CheckCircle}
            />
            <StatCard
              label="Pending"
              value={stats.pendingOrders}
              color="yellow"
              icon={Clock}
            />
            <StatCard
              label="Refunded"
              value={stats.refundedOrders}
              color="red"
              icon={XCircle}
            />
          </motion.div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by receipt number..."
                value={searchQuery}
                onChange={handleSearch}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <select
              value={filter}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="REFUNDED">Refunded</option>
              <option value="ON_HOLD">On Hold</option>
            </select>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Sales List */}
        {orders.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center border border-gray-200 dark:border-gray-700">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No Orders Found</h2>
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery || filter
                ? 'No orders match your search criteria.'
                : "No sales transactions found."}
            </p>
            <Link 
              href="/products" 
              className="mt-4 inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <>
            <div className={`space-y-4 ${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 space-y-0' : ''}`}>
              <AnimatePresence>
                {orders.map((order, index) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all overflow-hidden border border-gray-200 dark:border-gray-700"
                  >
                    {/* Order Header */}
                    <div className={`px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-wrap items-center justify-between gap-3 ${viewMode === 'grid' ? 'flex-col items-start' : ''}`}>
                      <div className={`flex items-center gap-3 ${viewMode === 'grid' ? 'w-full justify-between' : ''}`}>
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">#{order.receiptNumber}</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{safeFormatDate(order.saleDate || order.createdAt)}</span>
                      </div>
                      <div className={`flex items-center gap-3 ${viewMode === 'grid' ? 'w-full justify-between' : ''}`}>
                        <StatusBadge status={order.status} />
                        <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(order.total)}</span>
                      </div>
                    </div>

                    {/* Order Body */}
                    <div className="p-6">
                      {/* Customer and Payment Info */}
                      <div className="flex flex-wrap gap-4 mb-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'Guest'}
                        </span>
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-3.5 h-3.5" />
                          {order.payments?.[0]?.paymentMethod || 'N/A'}
                        </span>
                        {canViewAllSales() && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            Cashier: {order.user ? `${order.user.firstName} ${order.user.lastName}` : 'Unknown'}
                          </span>
                        )}
                      </div>

                      {/* Items */}
                      <div className="space-y-2">
                        {order.items && order.items.slice(0, viewMode === 'grid' ? 2 : 3).map((item: SaleItem) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-300 truncate max-w-[150px]">
                              {item.product?.name || 'Product'} × {item.quantity}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.total)}</span>
                          </div>
                        ))}
                        {order.items && order.items.length > (viewMode === 'grid' ? 2 : 3) && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            + {order.items.length - (viewMode === 'grid' ? 2 : 3)} more items
                          </p>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap justify-between items-center gap-2">
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {order.items?.length || 0} items
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedSale(order);
                              setShowDetailModal(true);
                            }}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            Details
                          </button>
                          <button
                            onClick={() => handlePrintReceipt(order)}
                            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm font-medium flex items-center gap-1"
                          >
                            <Printer className="w-4 h-4" />
                            Print
                          </button>
                          {canManageSales() && order.status === 'COMPLETED' && (
                            <button
                              onClick={() => handleRefund(order)}
                              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium flex items-center gap-1"
                            >
                              <XCircle className="w-4 h-4" />
                              Refund
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
              <div className="flex flex-wrap justify-center items-center gap-2 mt-8">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
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
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-9 h-9 rounded-lg text-sm transition-colors ${
                          page === pageNum
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
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
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

      {/* Sale Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedSale && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowDetailModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Sale #{selectedSale.receiptNumber}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {safeFormatDate(selectedSale.saleDate || selectedSale.createdAt)} at {safeFormatTime(selectedSale.saleDate || selectedSale.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <XCircle className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Status and Total */}
                <div className="flex items-center justify-between">
                  <StatusBadge status={selectedSale.status} />
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(selectedSale.total)}
                  </span>
                </div>

                {/* Customer Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Customer</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedSale.customer ? `${selectedSale.customer.firstName} ${selectedSale.customer.lastName}` : 'Guest'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Payment Method</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedSale.payments?.[0]?.paymentMethod || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Cashier</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedSale.user ? `${selectedSale.user.firstName} ${selectedSale.user.lastName}` : 'Unknown'}
                    </p>
                  </div>
                  {selectedSale.customer?.email && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedSale.customer.email}</p>
                    </div>
                  )}
                  {selectedSale.customer?.phoneNumber && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedSale.customer.phoneNumber}</p>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Items</h3>
                  <div className="space-y-2">
                    {selectedSale.items?.map((item: SaleItem) => (
                      <div key={item.id} className="flex justify-between items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {item.product?.name || 'Product'}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            × {item.quantity} @ {formatCurrency(item.unitPrice)}
                          </p>
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
                      <span className="text-gray-900 dark:text-white">
                        {formatCurrency(selectedSale.subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Tax</span>
                      <span className="text-gray-900 dark:text-white">
                        {formatCurrency(selectedSale.tax)}
                      </span>
                    </div>
                    {selectedSale.discount > 0 && (
                      <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                        <span>Discount</span>
                        <span>-{formatCurrency(selectedSale.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-gray-900 dark:text-white">Total</span>
                      <span className="text-blue-600 dark:text-blue-400">
                        {formatCurrency(selectedSale.total)}
                      </span>
                    </div>
                    {selectedSale.payments && selectedSale.payments.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Payment Details</p>
                        {selectedSale.payments.map((payment: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-300">{payment.paymentMethod}</span>
                            <span className="text-gray-900 dark:text-white">{formatCurrency(payment.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {selectedSale.notes && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Notes</p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">{selectedSale.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => handlePrintReceipt(selectedSale)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Print Receipt
                  </button>
                  {canManageSales() && selectedSale.status === 'COMPLETED' && (
                    <button
                      onClick={() => handleRefund(selectedSale)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Refund
                    </button>
                  )}
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
