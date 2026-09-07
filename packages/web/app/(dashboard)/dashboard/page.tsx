// D:\Projects\Kalwanga\packages\web\app\(dashboard)\dashboard\page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Package, 
  ShoppingBag, 
  AlertTriangle, 
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  CreditCard,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Download,
  Filter,
  Eye,
  Printer,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  Target,
  Shield,
  Lock,
  Unlock,
  UserCheck,
  UserX,
  Building,
  Store,
  Globe,
  Database,
  Zap,
  Activity,
  PieChart,
  Layers,
  Grid,
  List,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

// Import reusable components
import { Dashboard as DashboardComponent } from '../../../components/dashboard/Dashboard';
import { StatsCard } from '../../../components/dashboard/StatsCard';
import { SalesChart } from '../../../components/dashboard/SalesChart';
import { RecentActivity } from '../../../components/dashboard/RecentActivity';

// Services and hooks
import { apiService } from '../../../services/api';
import { useToast } from '../../../hooks/useToast';
import { useAuth } from '../../../hooks/useAuth';
import { formatCurrency, formatDate } from '../../../utils/helpers';
import { UserRole } from '../../../types/enums';

// Types
interface DashboardStats {
  sales: {
    today: { total: number; count: number; trend?: number };
    week: { total: number; count: number; trend?: number };
    month: { total: number; count: number; trend?: number };
    year: { total: number; count: number; trend?: number };
  };
  customers: {
    total: number;
    new: number;
    active: number;
    trend?: number;
    growth: number;
  };
  products: {
    total: number;
    active: number;
    outOfStock: number;
    lowStock: number;
    categories: number;
  };
  inventory: {
    totalValue: number;
    totalItems: number;
    categories: number;
    turnover: number;
    valueChange: number;
  };
  orders: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    cancelled: number;
    refunded: number;
    completionRate: number;
  };
  revenue: {
    total: number;
    average: number;
    growth: number;
    target: number;
    progress: number;
  };
  registers: {
    open: number;
    total: number;
    active: number;
    utilization: number;
  };
  employees: {
    total: number;
    active: number;
    online: number;
    turnover: number;
  };
  suppliers: {
    total: number;
    active: number;
    new: number;
  };
  performance: {
    conversionRate: number;
    averageOrderValue: number;
    customerSatisfaction: number;
    retentionRate: number;
  };
}

interface SalesTrend {
  date: string;
  revenue: number;
  orders: number;
  average: number;
  targets?: number;
}

interface RecentSale {
  id: string;
  receiptNumber: string;
  customerName: string;
  total: number;
  status: 'COMPLETED' | 'PENDING' | 'PROCESSING' | 'CANCELLED' | 'REFUNDED';
  createdAt: string;
  items: number;
  paymentMethod: string;
}

interface TopProduct {
  id: string;
  name: string;
  sku: string;
  sales: number;
  revenue: number;
  stock: number;
  category: string;
  growth: number;
}

interface RecentActivityItem {
  id: string;
  type: 'sale' | 'order' | 'customer' | 'inventory' | 'payment' | 'alert' | 'system';
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high';
  metadata?: Record<string, any>;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  isRead: boolean;
}

interface FilterState {
  dateRange: 'today' | 'week' | 'month' | 'year' | 'custom';
  businessUnit?: string;
  status?: string[];
  category?: string[];
  search?: string;
  department?: string[];
  region?: string[];
}

interface Permission {
  canViewSales: boolean;
  canViewCustomers: boolean;
  canViewProducts: boolean;
  canViewInventory: boolean;
  canViewOrders: boolean;
  canViewEmployees: boolean;
  canViewSuppliers: boolean;
  canViewRegisters: boolean;
  canViewReports: boolean;
  canExportData: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
}

// Helper function to format numbers
const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

// Default empty state for stats
const getEmptyStats = (): DashboardStats => ({
  sales: {
    today: { total: 0, count: 0 },
    week: { total: 0, count: 0 },
    month: { total: 0, count: 0 },
    year: { total: 0, count: 0 }
  },
  customers: {
    total: 0,
    new: 0,
    active: 0,
    growth: 0
  },
  products: {
    total: 0,
    active: 0,
    outOfStock: 0,
    lowStock: 0,
    categories: 0
  },
  inventory: {
    totalValue: 0,
    totalItems: 0,
    categories: 0,
    turnover: 0,
    valueChange: 0
  },
  orders: {
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    cancelled: 0,
    refunded: 0,
    completionRate: 0
  },
  revenue: {
    total: 0,
    average: 0,
    growth: 0,
    target: 0,
    progress: 0
  },
  registers: {
    open: 0,
    total: 0,
    active: 0,
    utilization: 0
  },
  employees: {
    total: 0,
    active: 0,
    online: 0,
    turnover: 0
  },
  suppliers: {
    total: 0,
    active: 0,
    new: 0
  },
  performance: {
    conversionRate: 0,
    averageOrderValue: 0,
    customerSatisfaction: 0,
    retentionRate: 0
  }
});

// Type guard for fulfilled promises
function isFulfilled<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> {
  return result.status === 'fulfilled';
}

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const { user: authUser } = useAuth();
  const { showToast } = useToast();
  
  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [salesTrend, setSalesTrend] = useState<SalesTrend[]>([]);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // UI State
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'year'>('week');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ dateRange: 'week' });
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>(['overview', 'sales', 'customers', 'inventory']);

  // Permissions
  const [permissions, setPermissions] = useState<Permission>({
    canViewSales: false,
    canViewCustomers: false,
    canViewProducts: false,
    canViewInventory: false,
    canViewOrders: false,
    canViewEmployees: false,
    canViewSuppliers: false,
    canViewRegisters: false,
    canViewReports: false,
    canExportData: false,
    canManageUsers: false,
    canManageSettings: false,
  });

  // Check user permissions
  const isAdmin = authUser?.role === 'SUPER_ADMIN' || authUser?.role === 'ADMIN';
  const isManager = authUser?.role === 'MANAGER';
  const isSuperAdmin = authUser?.role === 'SUPER_ADMIN';
  const hasAccess = isAdmin || isManager;

  // Get user role from authUser
  const userRole = authUser?.role || 'USER';

  // Get business units
  const businessUnits = useMemo(() => {
    if (isSuperAdmin) {
      return ['All', 'HQ', 'Branch 1', 'Branch 2', 'Warehouse'];
    }
    if (isAdmin || isManager) {
      return authUser?.businessUnits?.map((bu: any) => bu.name) || ['HQ'];
    }
    return [];
  }, [authUser, isSuperAdmin, isAdmin, isManager]);

  // Initialize permissions based on role
  useEffect(() => {
    if (authUser) {
      const userPermissions: Permission = {
        canViewSales: isAdmin || isManager,
        canViewCustomers: isAdmin || isManager,
        canViewProducts: isAdmin || isManager,
        canViewInventory: isAdmin || isManager,
        canViewOrders: isAdmin || isManager,
        canViewEmployees: isAdmin || isSuperAdmin,
        canViewSuppliers: isAdmin || isManager,
        canViewRegisters: isAdmin || isManager,
        canViewReports: isAdmin || isSuperAdmin,
        canExportData: isAdmin || isManager || isSuperAdmin,
        canManageUsers: isAdmin || isSuperAdmin,
        canManageSettings: isAdmin || isSuperAdmin,
      };
      setPermissions(userPermissions);
    }
  }, [authUser, isAdmin, isManager, isSuperAdmin]);

  // Fetch data
  useEffect(() => {
    if (isLoaded && user && hasAccess) {
      fetchDashboardData();
      fetchNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user, timeRange, filters, selectedBusinessUnit]);

  const fetchDashboardData = async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const params: any = { 
        range: timeRange,
        businessUnit: selectedBusinessUnit || 'all'
      };
      
      // Add filters
      if (filters.businessUnit) params.businessUnitId = filters.businessUnit;
      if (filters.status?.length) params.status = filters.status.join(',');
      if (filters.category?.length) params.category = filters.category.join(',');
      if (filters.search) params.search = filters.search;
      if (filters.department?.length) params.department = filters.department.join(',');
      if (filters.region?.length) params.region = filters.region.join(',');

      // Build business unit filter for managers
      const businessUnitId = (isManager || isAdmin) && authUser?.businessUnits?.length 
        ? authUser.businessUnits[0].businessUnitId 
        : undefined;

      const requestParams = businessUnitId ? { ...params, businessUnitId } : params;

      // Build fetch requests based on permissions
      const fetchPromises: Promise<any>[] = [];
      
      if (permissions.canViewSales) {
        fetchPromises.push(
          apiService.get('/api/dashboard/stats', { params: requestParams }),
          apiService.get('/api/dashboard/trends', { params: requestParams }),
          apiService.get('/api/sales/recent', { params: { limit: 10, ...requestParams } })
        );
      }

      if (permissions.canViewProducts) {
        fetchPromises.push(
          apiService.get('/api/dashboard/top-products', { params: { limit: 10, ...requestParams } })
        );
      }

      if (permissions.canViewCustomers || permissions.canViewOrders) {
        fetchPromises.push(
          apiService.get('/api/dashboard/activity', { params: { limit: 10, ...requestParams } })
        );
      }

      // Execute all promises with error handling
      const results = await Promise.allSettled(fetchPromises);

      // Track which responses we've processed
      let resultIndex = 0;
      let hasData = false;

      // Process stats
      if (permissions.canViewSales) {
        const result = results[resultIndex];
        if (isFulfilled(result)) {
          const statsData = result.value;
          if (statsData && typeof statsData === 'object') {
            const data = 'data' in statsData ? statsData.data : statsData;
            if (data && Object.keys(data).length > 0) {
              setStats(data);
              hasData = true;
            }
          }
        }
        resultIndex++;
      }

      // Process trends
      if (permissions.canViewSales) {
        const result = results[resultIndex];
        if (isFulfilled(result)) {
          const trendsData = result.value;
          if (trendsData && typeof trendsData === 'object') {
            const data = 'data' in trendsData ? trendsData.data : trendsData;
            if (Array.isArray(data) && data.length > 0) {
              setSalesTrend(data);
              hasData = true;
            }
          }
        }
        resultIndex++;
      }

      // Process recent sales
      if (permissions.canViewSales) {
        const result = results[resultIndex];
        if (isFulfilled(result)) {
          const salesData = result.value;
          if (salesData && typeof salesData === 'object') {
            const data = 'data' in salesData ? salesData.data : salesData;
            if (Array.isArray(data) && data.length > 0) {
              setRecentSales(data);
              hasData = true;
            }
          }
        }
        resultIndex++;
      }

      // Process top products
      if (permissions.canViewProducts) {
        const result = results[resultIndex];
        if (isFulfilled(result)) {
          const productsData = result.value;
          if (productsData && typeof productsData === 'object') {
            const data = 'data' in productsData ? productsData.data : productsData;
            if (Array.isArray(data) && data.length > 0) {
              setTopProducts(data);
              hasData = true;
            }
          }
        }
        resultIndex++;
      }

      // Process activity
      if (permissions.canViewCustomers || permissions.canViewOrders) {
        const result = results[resultIndex];
        if (isFulfilled(result)) {
          const activityData = result.value;
          if (activityData && typeof activityData === 'object') {
            const data = 'data' in activityData ? activityData.data : activityData;
            if (Array.isArray(data) && data.length > 0) {
              setRecentActivity(data);
              hasData = true;
            }
          }
        }
        resultIndex++;
      }

      // If no data was loaded, set empty stats
      if (!hasData && !stats) {
        setStats(getEmptyStats());
      }

      // Check for any failed requests
      const hasErrors = results.some(r => r.status === 'rejected');
      if (hasErrors) {
        console.warn('Some dashboard data requests failed');
        if (showToast && !silent) {
          showToast('Some data could not be loaded', 'warning');
        }
      }

      if (silent && showToast) {
        showToast('Dashboard data refreshed successfully', 'success');
      }

    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data');
      
      // Only set empty stats if we have no data
      if (!stats) {
        setStats(getEmptyStats());
      }
      
      if (showToast && !silent) {
        showToast('Failed to load dashboard data', 'error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await apiService.get('/api/notifications', { 
        params: { limit: 10, unread: true } 
      });
      
      if (response && typeof response === 'object') {
        const data = 'data' in response ? response.data : response;
        if (Array.isArray(data) && data.length > 0) {
          setNotifications(data);
        } else {
          setNotifications([]);
        }
      } else {
        setNotifications([]);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setNotifications([]);
    }
  };

  // Handlers
  const handleRefresh = useCallback(() => {
    fetchDashboardData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const params: any = { range: timeRange, ...filters };
      if (selectedBusinessUnit) params.businessUnit = selectedBusinessUnit;
      
      const response = await apiService.get('/api/dashboard/export', {
        params,
        responseType: 'blob'
      });
      
      if (response && typeof response === 'object') {
        const blob = response as unknown as Blob;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `dashboard-export-${new Date().toISOString()}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        
        if (showToast) {
          showToast('Dashboard data exported successfully', 'success');
        }
      }
    } catch (err) {
      console.error('Export failed:', err);
      if (showToast) {
        showToast('Failed to export data', 'error');
      }
    } finally {
      setExportLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const handleBusinessUnitChange = (unit: string | null) => {
    setSelectedBusinessUnit(unit);
    fetchDashboardData(true);
  };

  // Loading state
  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Access restricted
  if (!hasAccess) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          You need admin or manager privileges to view the dashboard.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`space-y-6 ${isFullScreen ? 'fixed inset-0 z-50 overflow-auto p-6 bg-gray-50 dark:bg-gray-900' : ''}`}
    >
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Dashboard
              {isSuperAdmin && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                  Super Admin
                </span>
              )}
              {isAdmin && !isSuperAdmin && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  Admin
                </span>
              )}
              {isManager && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  Manager
                </span>
              )}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Welcome back, {user?.firstName}! Here's your business overview.
              {isManager && <span className="ml-2 text-sm text-blue-600 dark:text-blue-400">(Manager View)</span>}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Business Unit Selector */}
          {businessUnits.length > 0 && (
            <select
              value={selectedBusinessUnit || 'all'}
              onChange={(e) => handleBusinessUnitChange(e.target.value === 'all' ? null : e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
            >
              <option value="all">All Business Units</option>
              {businessUnits.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          )}

          {/* Time Range Selector */}
          <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
            {['today', 'week', 'month', 'year'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range as any)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  timeRange === range
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>

          {/* View Mode */}
          <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
            {['grid', 'list', 'compact'].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode as any)}
                className={`px-2 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  viewMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Filter className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {permissions.canExportData && (
            <button
              onClick={handleExport}
              disabled={exportLoading}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Download className={`w-4 h-4 ${exportLoading ? 'animate-pulse' : ''}`} />
            </button>
          )}

          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {isFullScreen ? <X className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors relative"
            >
              <Bell className="w-4 h-4" />
              {notifications.filter(n => !n.isRead).length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {notifications.filter(n => !n.isRead).length}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <h3 className="font-semibold">Notifications</h3>
                  <button 
                    onClick={() => setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Mark all read
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>No notifications</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => setNotifications(prev => 
                        prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
                      )}
                      className={`p-3 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        !notification.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`flex-1`}>
                          <p className="text-sm font-medium">{notification.title}</p>
                          <p className="text-xs text-gray-500 mt-1">{notification.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(notification.timestamp)}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full mt-1"></div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Permission Summary */}
      <div className="flex flex-wrap gap-2 text-sm">
        <div className="flex items-center gap-1 text-green-600">
          <Shield className="w-4 h-4" />
          <span>Permissions:</span>
        </div>
        {Object.entries(permissions).map(([key, value]) => (
          value && (
            <span key={key} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs">
              {value ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
              {key.replace('can', '').replace(/([A-Z])/g, ' $1').trim()}
            </span>
          )
        ))}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date Range
              </label>
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                multiple
                value={filters.status || []}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value);
                  setFilters({ ...filters, status: values });
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="COMPLETED">Completed</option>
                <option value="PENDING">Pending</option>
                <option value="PROCESSING">Processing</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                multiple
                value={filters.category || []}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value);
                  setFilters({ ...filters, category: values });
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="ELECTRONICS">Electronics</option>
                <option value="CLOTHING">Clothing</option>
                <option value="FOOD">Food</option>
                <option value="ACCESSORIES">Accessories</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Search
              </label>
              <input
                type="text"
                value={filters.search || ''}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                setFilters({ dateRange: 'week' });
                setShowFilters(false);
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Clear Filters
            </button>
            <button
              onClick={() => setShowFilters(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>
        </motion.div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <span className="text-red-700 dark:text-red-300">{error}</span>
          <button
            onClick={() => fetchDashboardData(true)}
            className="ml-auto px-3 py-1 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Dashboard Content */}
      <div className="space-y-6">
        {/* Overview Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => toggleSection('overview')}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Overview</h2>
              <span className="text-sm text-gray-500">Key metrics at a glance</span>
            </div>
            {expandedSections.includes('overview') ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
          
          {expandedSections.includes('overview') && (
            <div className="p-6 pt-0">
              <div className={`grid gap-4 ${
                viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' :
                viewMode === 'list' ? 'grid-cols-1' :
                'grid-cols-2 sm:grid-cols-4'
              }`}>
                <StatsCard
                  title="Today's Sales"
                  value={formatCurrency(stats?.sales.today.total || 0)}
                  subtitle={`${stats?.sales.today.count || 0} transactions`}
                  icon={<DollarSign className="w-5 h-5" />}
                  trend={stats?.sales.today.trend && stats.sales.today.trend > 0 ? 'up' : 'down'}
                  color="blue"
                />
                <StatsCard
                  title="Weekly Sales"
                  value={formatCurrency(stats?.sales.week.total || 0)}
                  subtitle={`${stats?.sales.week.count || 0} transactions`}
                  icon={<TrendingUp className="w-5 h-5" />}
                  trend={stats?.sales.week.trend && stats.sales.week.trend > 0 ? 'up' : 'down'}
                  color="green"
                />
                <StatsCard
                  title="Monthly Sales"
                  value={formatCurrency(stats?.sales.month.total || 0)}
                  subtitle={`${stats?.sales.month.count || 0} transactions`}
                  icon={<Calendar className="w-5 h-5" />}
                  trend={stats?.sales.month.trend && stats.sales.month.trend > 0 ? 'up' : 'down'}
                  color="purple"
                />
                <StatsCard
                  title="Total Revenue"
                  value={formatCurrency(stats?.revenue.total || 0)}
                  subtitle={`Avg: ${formatCurrency(stats?.revenue.average || 0)} per order`}
                  icon={<BarChart3 className="w-5 h-5" />}
                  trend={stats?.revenue.growth && stats.revenue.growth > 0 ? 'up' : 'down'}
                  color="yellow"
                />
              </div>
            </div>
          )}
        </div>

        {/* Sales Section */}
        {permissions.canViewSales && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => toggleSection('sales')}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-green-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sales Analytics</h2>
                <span className="text-sm text-gray-500">Revenue and order trends</span>
              </div>
              {expandedSections.includes('sales') ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
            
            {expandedSections.includes('sales') && (
              <div className="p-6 pt-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <SalesChart data={salesTrend.map(t => ({
                      date: t.date,
                      revenue: t.revenue,
                      orders: t.orders
                    }))} />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Top Products</h4>
                    <div className="space-y-3">
                      {topProducts.length > 0 ? (
                        topProducts.slice(0, 5).map((product, index) => (
                          <div key={product.id} className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              index === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                              index === 1 ? 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-400' :
                              index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                              'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{product.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{product.sales} sold</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(product.revenue)}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">No product data available</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Customers Section */}
        {permissions.canViewCustomers && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => toggleSection('customers')}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Customer Insights</h2>
                <span className="text-sm text-gray-500">Customer growth and engagement</span>
              </div>
              {expandedSections.includes('customers') ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
            
            {expandedSections.includes('customers') && (
              <div className="p-6 pt-0">
                <div className={`grid gap-4 ${
                  viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' :
                  viewMode === 'list' ? 'grid-cols-1' :
                  'grid-cols-2 sm:grid-cols-4'
                }`}>
                  <StatsCard
                    title="Total Customers"
                    value={formatNumber(stats?.customers.total || 0)}
                    subtitle={`${stats?.customers.new || 0} new this ${timeRange}`}
                    icon={<Users className="w-5 h-5" />}
                    trend={stats?.customers.trend && stats.customers.trend > 0 ? 'up' : 'down'}
                    color="indigo"
                  />
                  <StatsCard
                    title="Active Customers"
                    value={stats?.customers.active || 0}
                    subtitle={`${stats?.customers.total || 0} total`}
                    icon={<UserCheck className="w-5 h-5" />}
                    color="green"
                  />
                  <StatsCard
                    title="Customer Growth"
                    value={`${stats?.customers.growth || 0}%`}
                    subtitle="Month over month"
                    icon={<TrendingUp className="w-5 h-5" />}
                    trend={stats?.customers.growth && stats.customers.growth > 0 ? 'up' : 'down'}
                    color="purple"
                  />
                  <StatsCard
                    title="Retention Rate"
                    value={`${stats?.performance?.retentionRate || 0}%`}
                    subtitle="Customer retention"
                    icon={<Activity className="w-5 h-5" />}
                    color="cyan"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inventory Section */}
        {permissions.canViewInventory && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => toggleSection('inventory')}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Inventory Management</h2>
                <span className="text-sm text-gray-500">Stock levels and value</span>
              </div>
              {expandedSections.includes('inventory') ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
            
            {expandedSections.includes('inventory') && (
              <div className="p-6 pt-0">
                <div className={`grid gap-4 ${
                  viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' :
                  viewMode === 'list' ? 'grid-cols-1' :
                  'grid-cols-2 sm:grid-cols-4'
                }`}>
                  <StatsCard
                    title="Total Products"
                    value={stats?.products.total || 0}
                    subtitle={`${stats?.products.active || 0} active`}
                    icon={<Package className="w-5 h-5" />}
                    color="orange"
                  />
                  <StatsCard
                    title="Inventory Value"
                    value={formatCurrency(stats?.inventory.totalValue || 0)}
                    subtitle={`${stats?.inventory.totalItems || 0} items`}
                    icon={<DollarSign className="w-5 h-5" />}
                    color="blue"
                  />
                  <StatsCard
                    title="Low Stock Items"
                    value={stats?.products.lowStock || 0}
                    subtitle={`${stats?.products.outOfStock || 0} out of stock`}
                    icon={<AlertTriangle className="w-5 h-5" />}
                    trend={stats?.products.lowStock && stats.products.lowStock > 0 ? 'down' : 'up'}
                    color="red"
                  />
                  <StatsCard
                    title="Turnover Rate"
                    value={`${stats?.inventory.turnover || 0}x`}
                    subtitle="Inventory turnover"
                    icon={<RefreshCw className="w-5 h-5" />}
                    color="cyan"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentActivity activities={recentActivity} limit={5} />
          
          {/* Quick Stats Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30">
                <p className="text-sm text-gray-600 dark:text-gray-400">Order Completion</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.orders.completionRate || 0}%</p>
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">{stats?.orders.completed || 0} completed</span>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 rounded-xl p-4 border border-green-100 dark:border-green-800/30">
                <p className="text-sm text-gray-600 dark:text-gray-400">Customer Satisfaction</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats?.performance?.customerSatisfaction || 0}⭐</p>
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <Users className="w-4 h-4 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">from {stats?.customers.active || 0} customers</span>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 border border-purple-100 dark:border-purple-800/30">
                <p className="text-sm text-gray-600 dark:text-gray-400">Conversion Rate</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats?.performance?.conversionRate || 0}%</p>
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <TrendingUp className="w-4 h-4 text-purple-500" />
                  <span className="text-purple-600 dark:text-purple-400">visitors to customers</span>
                </div>
              </div>

              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-4 border border-yellow-100 dark:border-yellow-800/30">
                <p className="text-sm text-gray-600 dark:text-gray-400">Revenue Target</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats?.revenue?.progress || 0}%</p>
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <Target className="w-4 h-4 text-yellow-500" />
                  <span className="text-yellow-600 dark:text-yellow-400">
                    {formatCurrency(stats?.revenue?.total || 0)} / {formatCurrency(stats?.revenue?.target || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center gap-4">
          <span>Last updated: {new Date().toLocaleString()}</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Shield className="w-4 h-4" />
            Role: {authUser?.role || 'Unknown'}
          </span>
        </div>
        <div className="flex gap-4">
          <span>Data source: Real-time API</span>
          <span>•</span>
          <span>Business Units: {authUser?.businessUnits?.length || 0}</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            {isSuperAdmin ? <Globe className="w-4 h-4" /> : <Building className="w-4 h-4" />}
            {isSuperAdmin ? 'Global Access' : 'Business Unit Access'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
