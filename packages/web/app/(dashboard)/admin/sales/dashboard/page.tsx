'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingBag,
  Users, Calendar, Clock, ArrowUpRight, ArrowDownRight,
  BarChart3, PieChart, Download, RefreshCw, Filter,
  Eye, Printer, MoreVertical, ChevronRight, X,
  Loader2, CheckCircle, AlertCircle, CreditCard,
  Package, Store, Phone, Mail, User, Tag, Lock
} from 'lucide-react';
import { saleService } from '../../../../../services/saleService';
import { formatCurrency, formatDate, formatTime } from '../../../../../utils/formatters';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { toast } from '../../../../../utils/toast-manager';

interface DashboardStats {
  today: {
    totalSales: number;
    totalRevenue: number;
    averageTicket?: number;
  };
  week: {
    totalSales: number;
    totalRevenue: number;
  };
  month: {
    totalSales: number;
    totalRevenue: number;
  };
  allTime: {
    totalSales: number;
    totalRevenue: number;
    averageTicket?: number;
  };
  recentSales: any[];
  topProducts?: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  salesByHour?: Array<{ hour: number; sales: number; revenue: number }>;
  salesByDay?: Array<{ day: string; sales: number; revenue: number }>;
}

// ============================================
// SUB-COMPONENTS
// ============================================

const StatsCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  change?: number;
  subtext?: string;
}> = ({ title, value, icon: Icon, color, change, subtext }) => {
  const isPositive = change !== undefined ? change >= 0 : true;
  const colorClasses: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
    green: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400' },
    red: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400' },
    teal: { bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-600 dark:text-teal-400' },
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400' },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {subtext && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]?.bg || 'bg-gray-100 dark:bg-gray-700'}`}>
          <Icon className={`w-6 h-6 ${colorClasses[color]?.text || 'text-gray-600 dark:text-gray-400'}`} />
        </div>
      </div>
      {change !== undefined && change !== 0 && (
        <div className="flex items-center gap-1 mt-3">
          {isPositive ? (
            <ArrowUpRight className="w-4 h-4 text-green-500" />
          ) : (
            <ArrowDownRight className="w-4 h-4 text-red-500" />
          )}
          <span className={`text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {Math.abs(change)}%
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">vs last period</span>
        </div>
      )}
    </motion.div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle },
    PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300', icon: Clock },
    PROCESSING: { label: 'Processing', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: Loader2 },
    CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: X },
    REFUNDED: { label: 'Refunded', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', icon: AlertCircle },
    ON_HOLD: { label: 'On Hold', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', icon: Clock },
  };

  const config = statusConfig[status] || statusConfig.PENDING;
  const Icon = config.icon;

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

const RevenueChart: React.FC<{ data: Array<{ day: string; revenue: number; sales: number }> }> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <p>No data available</p>
      </div>
    );
  }
  
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
  
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex items-end gap-2">
        {data.map((item, index) => (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div 
              className="w-full bg-blue-500 dark:bg-blue-400 rounded-t transition-all duration-500 hover:bg-blue-600 dark:hover:bg-blue-300"
              style={{ 
                height: `${(item.revenue / maxRevenue) * 80}%`,
                minHeight: '4px'
              }}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {item.day.slice(0, 3)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-400 dark:text-gray-500">
        <span>${Math.min(...data.map(d => d.revenue)).toFixed(0)}</span>
        <span>${maxRevenue.toFixed(0)}</span>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function SalesDashboard() {
  const { user } = useAuth();
  const { canView } = usePermission();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'year'>('today');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf'>('csv');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const canViewStats = canView?.(`${PermissionResource.SALE}:view_stats`) || user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'MANAGER' || false;

  useEffect(() => {
    if (canViewStats) {
      loadDashboardData();
    }
  }, [timeRange, canViewStats]);

  const loadDashboardData = useCallback(async (silent = false) => {
    if (!canViewStats) return;

    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const data = await saleService.getDashboardSalesData({
        businessUnitId: user?.businessUnits?.[0]?.businessUnitId
      });
      
      // Ensure the data matches the expected structure
      setStats({
        today: {
          totalSales: data?.today?.totalSales || 0,
          totalRevenue: data?.today?.totalRevenue || 0,
          averageTicket: data?.today?.averageTicket || 0
        },
        week: {
          totalSales: data?.week?.totalSales || 0,
          totalRevenue: data?.week?.totalRevenue || 0
        },
        month: {
          totalSales: data?.month?.totalSales || 0,
          totalRevenue: data?.month?.totalRevenue || 0
        },
        allTime: {
          totalSales: data?.allTime?.totalSales || 0,
          totalRevenue: data?.allTime?.totalRevenue || 0,
          averageTicket: data?.allTime?.averageTicket || 0
        },
        recentSales: data?.recentSales || [],
        topProducts: data?.topProducts || [],
        salesByHour: data?.salesByHour || [],
        salesByDay: data?.salesByDay || []
      });
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast.error('Failed to load sales dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, canViewStats]);

  const handleExport = async () => {
    try {
      const now = new Date();
      let startDate = new Date();
      const endDate = new Date();
      
      switch (timeRange) {
        case 'today':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'year':
          startDate = new Date(now);
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      // Remove 'format' from params as it's not expected
      const blob = await saleService.exportSalesCsv({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        businessUnitId: user?.businessUnits?.[0]?.businessUnitId
      });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales-report-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Sales report exported successfully');
      setShowExportModal(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export sales report');
    }
  };

  const handleViewSale = (sale: any) => {
    setSelectedSale(sale);
    setShowDetailModal(true);
  };

  if (!canViewStats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view sales statistics.
        </p>
      </div>
    );
  }

  if (loading) {
    return <LoadingSkeleton />;
  }

  const getCurrentPeriodStats = () => {
    switch (timeRange) {
      case 'today':
        return stats?.today || { totalRevenue: 0, totalSales: 0, averageTicket: 0 };
      case 'week':
        return stats?.week || { totalRevenue: 0, totalSales: 0 };
      case 'month':
        return stats?.month || { totalRevenue: 0, totalSales: 0 };
      case 'year':
        return stats?.allTime || { totalRevenue: 0, totalSales: 0, averageTicket: 0 };
      default:
        return stats?.today || { totalRevenue: 0, totalSales: 0, averageTicket: 0 };
    }
  };

  const periodStats = getCurrentPeriodStats();
  const topProducts = stats?.topProducts || [];
  const salesByDay = stats?.salesByDay || [];
  const recentSales = stats?.recentSales || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Sales Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time sales analytics and performance metrics
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex bg-white dark:bg-gray-800 rounded-lg shadow-sm p-1 border border-gray-200 dark:border-gray-700">
            {['today', 'week', 'month', 'year'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Revenue"
          value={formatCurrency(periodStats.totalRevenue || 0)}
          icon={DollarSign}
          color="green"
          change={5.2}
          subtext={`${periodStats.totalSales || 0} sales`}
        />
        <StatsCard
          title="Sales"
          value={periodStats.totalSales || 0}
          icon={ShoppingBag}
          color="blue"
          change={3.8}
          subtext={`${periodStats.totalRevenue ? Math.round(periodStats.totalRevenue / (periodStats.totalSales || 1)) : 0} avg per sale`}
        />
        <StatsCard
          title="Average Ticket"
          value={formatCurrency((periodStats as any).averageTicket || 0)}
          icon={BarChart3}
          color="purple"
          change={2.1}
        />
        <StatsCard
          title="Customers"
          value={stats?.today?.totalSales || 0}
          icon={Users}
          color="orange"
          change={-1.5}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Revenue Overview
            </h3>
            <button className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1">
              View Details <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="h-64">
            <RevenueChart data={salesByDay} />
          </div>
          <div className="flex justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
            <span>Total Revenue: {formatCurrency(stats?.today?.totalRevenue || 0)}</span>
            <span>Total Sales: {stats?.today?.totalSales || 0}</span>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            Top Products
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {topProducts.length > 0 ? (
              topProducts.slice(0, 5).map((product, index) => (
                <div key={product.id} className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-full text-sm font-medium text-gray-600 dark:text-gray-400">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {product.quantity} sold
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(product.revenue)}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No product data available</p>
              </div>
            )}
          </div>
          {topProducts.length > 5 && (
            <button className="mt-4 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              View all products →
            </button>
          )}
        </div>
      </div>

      {/* Recent Sales */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-wrap justify-between items-center gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Recent Sales
          </h3>
          <button className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1">
            View All <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Receipt
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                  Items
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                  Status
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                  Date
                </th>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentSales.slice(0, 10).map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer" onClick={() => handleViewSale(sale)}>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <span className="font-mono font-medium text-blue-600 dark:text-blue-400">
                      #{sale.receiptNumber}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <span className="text-gray-900 dark:text-white">
                      {sale.customer?.firstName || 'Guest'} {sale.customer?.lastName || ''}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                    {sale.items?.length || 0}
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(sale.total)}
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                    <StatusBadge status={sale.status} />
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                    {formatDate(sale.saleDate || sale.createdAt)}
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleViewSale(sale)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                    <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors ml-2">
                      <Printer className="w-4 h-4 text-gray-500" />
                    </button>
                  </td>
                </tr>
              ))}
              {recentSales.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No recent sales</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Export Sales Report
                </h3>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Format
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['csv', 'excel', 'pdf'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setExportFormat(f as any)}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          exportFormat === f
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
                    onClick={() => setShowExportModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExport}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sale Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedSale && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Sale #{selectedSale.receiptNumber}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(selectedSale.saleDate || selectedSale.createdAt)} at {formatTime(selectedSale.saleDate || selectedSale.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <StatusBadge status={selectedSale.status} />
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(selectedSale.total)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Customer</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedSale.customer ? `${selectedSale.customer.firstName} ${selectedSale.customer.lastName}` : 'Guest'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Payment</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedSale.payments?.[0]?.paymentMethod || 'N/A'}
                    </p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Items</h4>
                  <div className="space-y-2">
                    {selectedSale.items?.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-center p-2 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{item.product?.name || 'Product'}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">× {item.quantity}</p>
                        </div>
                        <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(item.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="space-y-1 max-w-xs ml-auto">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                      <span>{formatCurrency(selectedSale.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Tax</span>
                      <span>{formatCurrency(selectedSale.tax)}</span>
                    </div>
                    {selectedSale.discount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount</span>
                        <span>-{formatCurrency(selectedSale.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span>Total</span>
                      <span className="text-blue-600">{formatCurrency(selectedSale.total)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                    <Printer className="w-4 h-4" /> Print
                  </button>
                  <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// LOADING SKELETON
// ============================================

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 animate-pulse">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
        </div>
        <div className="flex gap-3">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-48"></div>
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-24"></div>
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-24"></div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 h-32 border border-gray-200 dark:border-gray-700"></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-6 h-80 border border-gray-200 dark:border-gray-700"></div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 h-80 border border-gray-200 dark:border-gray-700"></div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 h-96 border border-gray-200 dark:border-gray-700"></div>
    </div>
  );
}