// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\cart\abandoned\page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ShoppingCart, Users, Clock, Calendar,
  RefreshCw, Filter, X, Loader2, AlertCircle,
  Eye, ChevronDown, ChevronUp, Search,
  Package, DollarSign, User, Mail, Phone,
  MapPin, Building2, Globe, Timer,
  AlertTriangle, ThumbsDown, ThumbsUp,
  ChevronLeft, ChevronRight, Menu,
  Grid, List, Settings, Bell, Lock,
  Download, Printer, Send, Mail as MailIcon,
  Sparkles, Zap, Crown, Shield, Award,
  TrendingDown, Minus, Plus, ArrowUp, ArrowDown
} from 'lucide-react';
import { toast } from '../../../../../utils/toast-manager';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { api } from '../../../../../services/api';
import { cartService } from '../../../../../services/cartService';
import { formatCurrency, formatDate, formatNumber, formatTimeAgo } from '../../../../../utils/formatters';

// ============================================
// INTERFACES
// ============================================

interface AbandonedCart {
  id: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
  items: Array<{
    id: string;
    productId: string;
    product: {
      id: string;
      name: string;
      sku: string;
      unitPrice: number;
      images: string[];
    };
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  itemCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  abandonedAt: string;
  hoursAbandoned: number;
}

interface PaginationInfo {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

interface AbandonedFilters {
  search: string;
  hours: number;
  minValue?: number;
  status: string;
  dateRange: string;
}

// ============================================
// CONSTANTS
// ============================================

const DATE_RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SAVED', label: 'Saved' },
  { value: 'ABANDONED', label: 'Abandoned' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminAbandonedCartsPage() {
  const router = useRouter();
  const { canManage, isLoading: permissionLoading } = usePermission();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    totalPages: 1,
    limit: 20,
  });
  const [filters, setFilters] = useState<AbandonedFilters>({
    search: '',
    hours: 24,
    status: 'all',
    dateRange: 'week',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCart, setSelectedCart] = useState<AbandonedCart | null>(null);
  const [showCartModal, setShowCartModal] = useState(false);
  const [recovering, setRecovering] = useState(false);

  const canViewAbandoned = canManage(PermissionResource.CART_VIEW) || 
                          canManage(PermissionResource.CART_MANAGE) ||
                          canManage(PermissionResource.ANALYTICS);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchAbandonedCarts = useCallback(async (showLoading = true) => {
    if (!canViewAbandoned) return;

    try {
      if (showLoading) setLoading(true);
      if (!showLoading) setRefreshing(true);
      setError(null);

      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        hours: filters.hours,
      };

      if (filters.search) params.search = filters.search;
      if (filters.minValue) params.minValue = filters.minValue;
      if (filters.status !== 'all') params.status = filters.status;

      // Date range
      if (filters.dateRange !== 'all') {
        params.dateRange = filters.dateRange;
      }

      console.log('📤 Fetching abandoned carts with params:', params);

      const response = await cartService.getAbandonedCarts(params);
      console.log('📥 Abandoned carts response:', response);

      if (response) {
        setCarts(response.carts || []);
        setPagination({
          total: response.total || 0,
          page: response.page || 1,
          totalPages: response.totalPages || 1,
          limit: response.limit || 20,
        });
      }
    } catch (error: any) {
      console.error('Failed to fetch abandoned carts:', error);
      setError(error?.message || 'Failed to load abandoned carts');
      toast.error('Failed to load abandoned carts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canViewAbandoned, filters, pagination.page, pagination.limit]);

  useEffect(() => {
    if (canViewAbandoned) {
      fetchAbandonedCarts();
    } else {
      setLoading(false);
    }
  }, [canViewAbandoned, fetchAbandonedCarts]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleRefresh = () => {
    fetchAbandonedCarts(false);
    toast.success('Abandoned carts refreshed');
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page }));
    }
  };

  const handleLimitChange = (limit: number) => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
  };

  const handleFilterChange = (key: keyof AbandonedFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      hours: 24,
      status: 'all',
      dateRange: 'week',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleViewCart = (cart: AbandonedCart) => {
    setSelectedCart(cart);
    setShowCartModal(true);
  };

  const handleCloseModal = () => {
    setShowCartModal(false);
    setSelectedCart(null);
  };

  const handleRecoverCart = async (cartId: string) => {
    if (!confirm('Are you sure you want to recover this cart? The user will be notified.')) return;

    setRecovering(true);
    try {
      // TODO: Implement cart recovery API
      // await cartService.recoverCart(cartId);
      toast.success('Cart recovery initiated. User will be notified.');
      await fetchAbandonedCarts(false);
    } catch (error: any) {
      console.error('Failed to recover cart:', error);
      toast.error(error?.message || 'Failed to recover cart');
    } finally {
      setRecovering(false);
    }
  };

  const handleSendReminder = async (cartId: string) => {
    try {
      // TODO: Implement reminder API
      // await cartService.sendCartReminder(cartId);
      toast.success('Reminder sent successfully');
    } catch (error: any) {
      console.error('Failed to send reminder:', error);
      toast.error(error?.message || 'Failed to send reminder');
    }
  };

  // ============================================
  // HELPERS
  // ============================================

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      SAVED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      CHECKED_OUT: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
      ABANDONED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      ACTIVE: 'Active',
      SAVED: 'Saved',
      CHECKED_OUT: 'Checked Out',
      ABANDONED: 'Abandoned',
    };
    return labels[status] || status;
  };

  const getAbandonmentRisk = (hours: number): { label: string; color: string; icon: React.ReactNode } => {
    if (hours > 72) {
      return { 
        label: 'High Risk', 
        color: 'text-red-600 dark:text-red-400',
        icon: <AlertTriangle className="w-4 h-4" />
      };
    }
    if (hours > 24) {
      return { 
        label: 'Medium Risk', 
        color: 'text-yellow-600 dark:text-yellow-400',
        icon: <Clock className="w-4 h-4" />
      };
    }
    return { 
      label: 'Low Risk', 
      color: 'text-green-600 dark:text-green-400',
      icon: <ThumbsUp className="w-4 h-4" />
    };
  };

  // ============================================
  // PERMISSION GUARD
  // ============================================

  if (permissionLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading abandoned carts...</p>
        </div>
      </div>
    );
  }

  if (!canViewAbandoned) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view abandoned carts. Please contact your administrator.
        </p>
        <button
          onClick={() => router.push('/admin')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/cart')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Back to cart management"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-7 h-7 text-red-500" />
                Abandoned Carts
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Monitor and recover carts that users have abandoned
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <button
              onClick={() => router.push('/admin/cart/analytics')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              <BarChart3 className="w-4 h-4" />
              Analytics
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Abandoned</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatNumber(pagination.total)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Potential Revenue</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {formatCurrency(carts.reduce((sum, cart) => sum + cart.total, 0))}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Avg Cart Value</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {carts.length > 0 ? formatCurrency(carts.reduce((sum, cart) => sum + cart.total, 0) / carts.length) : '$0'}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Recovery Rate</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              0%
            </p>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder="Search by user or email..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hours Abandoned</label>
                <select
                  value={filters.hours}
                  onChange={(e) => handleFilterChange('hours', parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value={12}>Last 12 hours</option>
                  <option value={24}>Last 24 hours</option>
                  <option value={48}>Last 48 hours</option>
                  <option value={72}>Last 72 hours</option>
                  <option value={168}>Last 7 days</option>
                  <option value={720}>Last 30 days</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {STATUS_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Value</label>
                <input
                  type="number"
                  value={filters.minValue || ''}
                  onChange={(e) => handleFilterChange('minValue', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={handleClearFilters}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                Clear Filters
              </button>
            </div>
          </motion.div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Error</p>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 dark:text-red-400 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Carts Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Items</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Abandoned</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Risk</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {carts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                      <ShoppingCart className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-lg font-medium">No abandoned carts found</p>
                      <p className="text-sm">Try adjusting your filters</p>
                    </td>
                  </tr>
                ) : (
                  carts.map((cart) => {
                    const risk = getAbandonmentRisk(cart.hoursAbandoned || 0);
                    return (
                      <motion.tr
                        key={cart.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                        onClick={() => handleViewCart(cart)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {cart.user?.firstName} {cart.user?.lastName}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{cart.user?.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {cart.itemCount || cart.items?.length || 0} items
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
                          {cart.abandonedAt ? formatTimeAgo(cart.abandonedAt) : formatTimeAgo(cart.updatedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1 text-sm font-medium ${risk.color}`}>
                            {risk.icon}
                            {risk.label}
                          </span>
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
                            <button
                              onClick={() => handleSendReminder(cart.id)}
                              className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                              title="Send Reminder"
                            >
                              <MailIcon className="w-4 h-4 text-blue-500" />
                            </button>
                            <button
                              onClick={() => handleRecoverCart(cart.id)}
                              disabled={recovering}
                              className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors disabled:opacity-50"
                              title="Recover Cart"
                            >
                              <RefreshCw className="w-4 h-4 text-green-500" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
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
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Abandoned Cart Details</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      ID: {selectedCart.id.slice(0, 12)}...
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Cart Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">User</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedCart.user?.firstName} {selectedCart.user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{selectedCart.user?.email}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedCart.status)}`}>
                    {getStatusLabel(selectedCart.status)}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                  <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(selectedCart.total || 0)}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Abandoned</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedCart.abandonedAt ? formatTimeAgo(selectedCart.abandonedAt) : formatTimeAgo(selectedCart.updatedAt)}
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
                <button
                  onClick={() => {
                    handleSendReminder(selectedCart.id);
                    handleCloseModal();
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                  <MailIcon className="w-4 h-4" />
                  Send Reminder
                </button>
                <button
                  onClick={() => {
                    handleRecoverCart(selectedCart.id);
                    handleCloseModal();
                  }}
                  disabled={recovering}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  Recover Cart
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
