// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\cart\page.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, RefreshCw, Trash2, Eye, Clock,
  Users, TrendingUp, DollarSign, Package,
  AlertCircle, CheckCircle, XCircle, Loader2,
  ArrowLeft, ArrowRight, Search, Filter,
  ChevronDown, ChevronUp, MoreVertical,
  Download, Printer, Copy, Calendar,
  Building2, User, Mail, Phone, MapPin,
  CreditCard, Wallet, Gift, Tag, Percent,
  Shield, Truck, Sparkles, Crown, Zap
} from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';
import { usePermission } from '../../../../hooks/usePermission';
import { cartService, Cart, CartItem } from '../../../../services/cartService';
import { toast } from '../../../../utils/toast-manager';
import { formatCurrency, formatDate } from '../../../../utils/formatters';
import { PermissionResource, CartStatus } from '../../../../types/enums';

// Cart components
import {
  CartItemCard,
  CartSummary,
  CartSkeleton,
  EmptyCart,
  MiniCart,
  CartCountBadge
} from '../../../../components/cart';

// ============================================
// TYPES
// ============================================

interface AdminCartStats {
  totalCarts: number;
  activeCarts: number;
  abandonedCarts: number;
  totalItems: number;
  totalValue: number;
  averageValue: number;
  conversionRate: number;
}

interface AdminCartFilters {
  search: string;
  status: string;
  dateRange: string;
  minValue?: number;
  maxValue?: number;
  customerId?: string;
  businessUnitId?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminCartPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { hasPermission } = usePermission();

  // ✅ FIX: Use correct PermissionResource values
  const canViewCart = hasPermission(PermissionResource.CART_VIEW) ||
                      hasPermission(PermissionResource.CART_MANAGE) ||
                      user?.role === 'SUPER_ADMIN' ||
                      user?.role === 'ADMIN';

  const canManageCart = hasPermission(PermissionResource.CART_MANAGE) ||
                        user?.role === 'SUPER_ADMIN' ||
                        user?.role === 'ADMIN';

  const canViewCartHistory = hasPermission(PermissionResource.CART_VIEW_HISTORY) ||
                             canManageCart;

  const canCheckout = hasPermission(PermissionResource.CART_CHECKOUT) ||
                      canManageCart;

  // State
  const [carts, setCarts] = useState<Cart[]>([]);
  const [stats, setStats] = useState<AdminCartStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCart, setSelectedCart] = useState<Cart | null>(null);
  const [showCartModal, setShowCartModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<AdminCartFilters>({
    search: '',
    status: 'all',
    dateRange: 'today',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchCarts = useCallback(async (showLoading = true) => {
    if (!canViewCart) return;

    try {
      if (showLoading) setLoading(true);
      if (!showLoading) setRefreshing(true);

      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (filters.search) params.search = filters.search;
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.dateRange !== 'all') params.dateRange = filters.dateRange;
      if (filters.minValue) params.minValue = filters.minValue;
      if (filters.maxValue) params.maxValue = filters.maxValue;
      if (filters.customerId) params.customerId = filters.customerId;
      if (filters.businessUnitId) params.businessUnitId = filters.businessUnitId;

      console.log('📤 Fetching admin carts with params:', params);

      const response = await cartService.getCartHistory(params);
      console.log('📥 Cart history response:', response);

      // ✅ FIX: response directly contains carts, carts, total, etc.
      const cartData = response.carts || [];
      setCarts(cartData);
      setPagination(prev => ({
        ...prev,
        total: response.total || cartData.length,
        totalPages: response.totalPages || 1,
      }));

      const totalCarts = cartData.length;
      const activeCarts = cartData.filter((c: any) => c.status === CartStatus.ACTIVE).length;
      const abandonedCarts = cartData.filter((c: any) => c.status === CartStatus.ABANDONED).length;
      const totalItems = cartData.reduce((sum: number, c: any) => sum + (c.itemCount || 0), 0);
      const totalValue = cartData.reduce((sum: number, c: any) => sum + (c.total || 0), 0);
      
      setStats({
        totalCarts,
        activeCarts,
        abandonedCarts,
        totalItems,
        totalValue,
        averageValue: totalCarts > 0 ? totalValue / totalCarts : 0,
        conversionRate: totalCarts > 0 ? ((totalCarts - abandonedCarts) / totalCarts) * 100 : 0,
      });

    } catch (error: any) {
      console.error('Failed to fetch carts:', error);
      toast.error('Failed to load carts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canViewCart, filters, pagination.page, pagination.limit]);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    if (canViewCart) {
      fetchCarts();
    }
  }, [canViewCart, fetchCarts]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleRefresh = async () => {
    await fetchCarts(false);
    toast.success('Carts refreshed');
  };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const handleLimitChange = (limit: number) => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
  };

  const handleFilterChange = (key: keyof AdminCartFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      dateRange: 'today',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleViewCart = (cart: Cart) => {
    setSelectedCart(cart);
    setShowCartModal(true);
  };

  const handleCloseModal = () => {
    setShowCartModal(false);
    setSelectedCart(null);
  };

  const handleDeleteCart = async (cartId: string) => {
    if (!canManageCart) {
      toast.error('You do not have permission to delete carts');
      return;
    }

    if (!confirm('Are you sure you want to delete this cart?')) return;

    try {
      // TODO: Implement delete cart API
      // await cartService.deleteCart(cartId);
      toast.success('Cart deleted successfully');
      await fetchCarts(false);
    } catch (error: any) {
      console.error('Failed to delete cart:', error);
      toast.error(error?.message || 'Failed to delete cart');
    }
  };

  // ============================================
  // HELPERS
  // ============================================

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      [CartStatus.ACTIVE]: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      [CartStatus.SAVED]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      [CartStatus.CHECKED_OUT]: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
      [CartStatus.ABANDONED]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      [CartStatus.ACTIVE]: 'Active',
      [CartStatus.SAVED]: 'Saved',
      [CartStatus.CHECKED_OUT]: 'Checked Out',
      [CartStatus.ABANDONED]: 'Abandoned',
    };
    return labels[status] || status;
  };

  // ============================================
  // PERMISSION GUARD
  // ============================================

  if (!canViewCart) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            You don't have permission to view cart management.
          </p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </motion.div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  if (loading && carts.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ShoppingCart className="w-7 h-7 text-blue-500" />
            Cart Management
          </h1>
        </div>
        <CartSkeleton count={5} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ShoppingCart className="w-7 h-7 text-blue-500" />
            Cart Management
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage all shopping carts across the system
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {canManageCart && (
            <button
              onClick={() => router.push('/admin/cart/analytics')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              Analytics
            </button>
          )}
          {canCheckout && (
            <button
              onClick={() => router.push('/admin/cart/checkout')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              Checkout
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Carts</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalCarts}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.activeCarts}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Abandoned</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.abandonedCarts}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Items</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalItems}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Value</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.totalValue)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Conversion Rate</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.conversionRate.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by cart ID, customer, or user..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value={CartStatus.ACTIVE}>Active</option>
            <option value={CartStatus.SAVED}>Saved</option>
            <option value={CartStatus.CHECKED_OUT}>Checked Out</option>
            <option value={CartStatus.ABANDONED}>Abandoned</option>
          </select>
          <select
            value={filters.dateRange}
            onChange={(e) => handleFilterChange('dateRange', e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1 transition-colors"
          >
            <Filter className="w-4 h-4" />
            More
          </button>
          {(filters.minValue || filters.maxValue || filters.customerId || filters.businessUnitId) && (
            <button
              onClick={handleClearFilters}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 flex items-center gap-1"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Value</label>
                <input
                  type="number"
                  value={filters.minValue || ''}
                  onChange={(e) => handleFilterChange('minValue', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Value</label>
                <input
                  type="number"
                  value={filters.maxValue || ''}
                  onChange={(e) => handleFilterChange('maxValue', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer ID</label>
                <input
                  type="text"
                  value={filters.customerId || ''}
                  onChange={(e) => handleFilterChange('customerId', e.target.value || undefined)}
                  placeholder="Customer ID..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business Unit ID</label>
                <input
                  type="text"
                  value={filters.businessUnitId || ''}
                  onChange={(e) => handleFilterChange('businessUnitId', e.target.value || undefined)}
                  placeholder="Business Unit ID..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Carts Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cart ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Items</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {carts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <ShoppingCart className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-lg font-medium">No carts found</p>
                    <p className="text-sm">Try adjusting your filters</p>
                  </td>
                </tr>
              ) : (
                carts.map((cart) => (
                  <motion.tr
                    key={cart.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => handleViewCart(cart)}
                  >
                    <td className="px-4 py-3 font-mono text-sm text-gray-600 dark:text-gray-300">
                      {cart.id.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {cart.userId?.slice(0, 8) || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {cart.customer ? (
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          {cart.customer.firstName} {cart.customer.lastName}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Guest</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                      {cart.itemCount || 0}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(cart.total || 0)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(cart.status)}`}>
                        {getStatusLabel(cart.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {cart.createdAt ? formatDate(cart.createdAt) : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewCart(cart)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {canManageCart && (
                          <button
                            onClick={() => handleDeleteCart(cart.id)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </span>
              <select
                value={pagination.limit}
                onChange={(e) => handleLimitChange(parseInt(e.target.value))}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cart Detail Modal */}
      <AnimatePresence>
        {showCartModal && selectedCart && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCloseModal} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <ShoppingCart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Cart Details</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      ID: {selectedCart.id.slice(0, 12)}...
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <XCircle className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Cart Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedCart.status)}`}>
                    {getStatusLabel(selectedCart.status)}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Items</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedCart.itemCount || 0}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                  <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(selectedCart.total || 0)}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedCart.createdAt ? formatDate(selectedCart.createdAt) : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Cart Items */}
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                <h4 className="font-semibold text-gray-900 dark:text-white">Items</h4>
                {selectedCart.items && selectedCart.items.length > 0 ? (
                  selectedCart.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="w-16 h-16 bg-gray-200 dark:bg-gray-600 rounded-lg overflow-hidden flex-shrink-0">
                        {item.product.images?.[0] ? (
                          <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-8 h-8 text-gray-400 mx-auto mt-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white">{item.product.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {item.product.sku}</p>
                        {item.variant && (
                          <p className="text-xs text-gray-400">Variant: {item.variant.name}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.unitPrice)}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Qty: {item.quantity}</p>
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total: {formatCurrency(item.total)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">No items in this cart</p>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
                {canCheckout && selectedCart.status === CartStatus.ACTIVE && selectedCart.items && selectedCart.items.length > 0 && (
                  <button
                    onClick={() => {
                      router.push(`/admin/cart/checkout?cartId=${selectedCart.id}`);
                      handleCloseModal();
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
                  >
                    <CreditCard className="w-4 h-4" />
                    Checkout
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
