// D:\Projects\Kalwanga\packages\web\app\(dashboard)\dashboard\page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  DollarSign,
  Users,
  Package,
  AlertTriangle,
  Calendar,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Filter,
  Settings,
  Bell,
  X,
  Target,
  Shield,
  UserCheck,
  BarChart3,
  Activity,
  Layers,
  ChevronDown,
  ChevronRight,
  Globe,
  Building,
} from 'lucide-react';

import { StatsCard } from '../../../components/dashboard/StatsCard';
import { SalesChart } from '../../../components/dashboard/SalesChart';
import { RecentActivity } from '../../../components/dashboard/RecentActivity';

import { apiService } from '../../../services/api';
import { useToast } from '../../../hooks/useToast';
import { useAuth } from '../../../hooks/useAuth';
import { formatCurrency, formatDate } from '../../../utils/helpers';

// ============================================
// TYPES
// ============================================

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
  type:
    | 'sale'
    | 'order'
    | 'customer'
    | 'inventory'
    | 'payment'
    | 'alert'
    | 'system';
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

// ============================================
// HELPERS
// ============================================

const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const getEmptyStats = (): DashboardStats => ({
  sales: {
    today: { total: 0, count: 0 },
    week: { total: 0, count: 0 },
    month: { total: 0, count: 0 },
    year: { total: 0, count: 0 },
  },
  customers: { total: 0, new: 0, active: 0, growth: 0 },
  products: { total: 0, active: 0, outOfStock: 0, lowStock: 0, categories: 0 },
  inventory: {
    totalValue: 0,
    totalItems: 0,
    categories: 0,
    turnover: 0,
    valueChange: 0,
  },
  orders: {
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    cancelled: 0,
    refunded: 0,
    completionRate: 0,
  },
  revenue: { total: 0, average: 0, growth: 0, target: 0, progress: 0 },
  registers: { open: 0, total: 0, active: 0, utilization: 0 },
  employees: { total: 0, active: 0, online: 0, turnover: 0 },
  suppliers: { total: 0, active: 0, new: 0 },
  performance: {
    conversionRate: 0,
    averageOrderValue: 0,
    customerSatisfaction: 0,
    retentionRate: 0,
  },
});

const getEmptyPermissions = (): Permission => ({
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

function isFulfilled<T>(
  result: PromiseSettledResult<T>
): result is PromiseFulfilledResult<T> {
  return result.status === 'fulfilled';
}

/**
 * Extract the payload from a response that may be wrapped as
 * `{ data: ... }` or returned bare.
 */
function unwrap<T = any>(response: any): T | null {
  if (!response || typeof response !== 'object') return null;
  if ('data' in response) return (response as any).data as T;
  return response as T;
}

/**
 * Compute a trend direction. Returns undefined when there's no
 * meaningful signal — the caller can render a neutral state.
 */
function trendDirection(value: number | undefined): 'up' | 'down' | undefined {
  if (value === undefined || value === null || value === 0) return undefined;
  return value > 0 ? 'up' : 'down';
}

/**
 * Deep-merge a partial DashboardStats payload with the defaults.
 *
 * ⚠️ The backend may not return every nested field. Without this
 *    merge, a response like `{ sales: {...} }` leaves
 *    `stats.revenue` as `undefined`, and the render crashes on
 *    `stats.revenue.total`.
 */
function mergeStats(partial: Partial<DashboardStats>): DashboardStats {
  const defaults = getEmptyStats();
  return {
    sales: {
      today: { ...defaults.sales.today, ...(partial.sales?.today ?? {}) },
      week: { ...defaults.sales.week, ...(partial.sales?.week ?? {}) },
      month: { ...defaults.sales.month, ...(partial.sales?.month ?? {}) },
      year: { ...defaults.sales.year, ...(partial.sales?.year ?? {}) },
    },
    customers: { ...defaults.customers, ...(partial.customers ?? {}) },
    products: { ...defaults.products, ...(partial.products ?? {}) },
    inventory: { ...defaults.inventory, ...(partial.inventory ?? {}) },
    orders: { ...defaults.orders, ...(partial.orders ?? {}) },
    revenue: { ...defaults.revenue, ...(partial.revenue ?? {}) },
    registers: { ...defaults.registers, ...(partial.registers ?? {}) },
    employees: { ...defaults.employees, ...(partial.employees ?? {}) },
    suppliers: { ...defaults.suppliers, ...(partial.suppliers ?? {}) },
    performance: { ...defaults.performance, ...(partial.performance ?? {}) },
  };
}

/**
 * Fetch a dashboard sub-resource. Returns `null` when the endpoint
 * is missing (404) — that's not an error, it just means the backend
 * hasn't implemented this view yet.
 */
async function safeFetch<T = any>(
  url: string,
  options?: { params?: Record<string, any> }
): Promise<T | null> {
  try {
    const response = await apiService.get<any>(url, options);
    return unwrap<T>(response);
  } catch (err: any) {
    if (err?.response?.status === 404) {
      console.warn(
        `ℹ️ [dashboard] ${url} returned 404 — endpoint not implemented yet`
      );
      return null;
    }
    throw err;
  }
}

/**
 * Normalize a raw top-product payload into the canonical `TopProduct`
 * shape and guarantee a **unique, stable `id`**.
 *
 * The backend may return identifiers under any of:
 *   id | productId | _id | sku | code
 * and may use alternate names for other fields. Missing ids are the
 * #1 cause of React's "unique key" warning — so we synthesize one
 * as a last resort.
 */
function normalizeTopProduct(raw: any, index: number): TopProduct {
  const id =
    raw?.id ??
    raw?.productId ??
    raw?._id ??
    raw?.sku ??
    raw?.code ??
    `tp-${index}`;

  return {
    id: String(id),
    name: raw?.name ?? raw?.productName ?? raw?.title ?? 'Unnamed product',
    sku: raw?.sku ?? raw?.code ?? '',
    sales: Number(raw?.sales ?? raw?.quantitySold ?? raw?.qty ?? 0),
    revenue: Number(raw?.revenue ?? raw?.totalRevenue ?? raw?.amount ?? 0),
    stock: Number(raw?.stock ?? raw?.quantity ?? raw?.stockLevel ?? 0),
    category: raw?.category ?? raw?.categoryName ?? '',
    growth: Number(raw?.growth ?? raw?.growthRate ?? 0),
  };
}

/**
 * Normalize a raw notification payload into the canonical
 * `Notification` shape and guarantee a unique `id`.
 */
function normalizeNotification(raw: any, index: number): Notification {
  const id = raw?.id ?? raw?._id ?? raw?.notificationId ?? `n-${index}`;

  return {
    id: String(id),
    title: raw?.title ?? raw?.subject ?? 'Notification',
    message: raw?.message ?? raw?.body ?? raw?.description ?? '',
    type: raw?.type ?? 'info',
    timestamp:
      raw?.timestamp ??
      raw?.createdAt ??
      raw?.created_at ??
      new Date().toISOString(),
    isRead: Boolean(raw?.isRead ?? raw?.read ?? false),
  };
}

// ============================================
// COMPONENT
// ============================================

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const { user: authUser } = useAuth();
  const { showToast } = useToast();

  // ---------- Primitive derivations from unstable objects ----------
  const userId = user?.id ?? null;
  const hasAuthUser = !!authUser;

  // ---------- State ----------
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [salesTrend, setSalesTrend] = useState<SalesTrend[]>([]);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>(
    []
  );
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const [timeRange, setTimeRange] = useState<
    'today' | 'week' | 'month' | 'year'
  >('week');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>(
    'grid'
  );
  const [showFilters, setShowFilters] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ dateRange: 'week' });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<
    string | null
  >(null);
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'overview',
    'sales',
    'customers',
    'inventory',
  ]);

  // ---------- Derived roles ----------
  const role = authUser?.role;
  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const isManager = role === 'MANAGER';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const hasAccess = isAdmin || isManager;

  // ---------- Permissions (DERIVED, not state) ----------
  const permissions: Permission = useMemo<Permission>(() => {
    if (!hasAuthUser) return getEmptyPermissions();

    return {
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
  }, [hasAuthUser, isAdmin, isManager, isSuperAdmin]);

  // ---------- Business units (derived, stable array) ----------
  const businessUnits = useMemo<string[]>(() => {
    if (isSuperAdmin) {
      return ['All', 'HQ', 'Branch 1', 'Branch 2', 'Warehouse'];
    }
    if (isAdmin || isManager) {
      const units = authUser?.businessUnits;
      if (Array.isArray(units) && units.length > 0) {
        return units.map((bu: any) => bu.name);
      }
      return ['HQ'];
    }
    return [];
  }, [hasAuthUser, isSuperAdmin, isAdmin, isManager]);

  // ---------- Primitive form of authUser fields used in deps ----------
  const primaryBusinessUnitId = useMemo<string | undefined>(() => {
    if (!(isManager || isAdmin)) return undefined;
    const units = authUser?.businessUnits;
    if (!Array.isArray(units) || units.length === 0) return undefined;
    return units[0]?.businessUnitId;
  }, [hasAuthUser, isManager, isAdmin]);

  // ---------- Primitive form of the filters object ----------
  const filtersKey = useMemo(
    () =>
      [
        filters.dateRange,
        filters.search ?? '',
        filters.businessUnit ?? '',
        (filters.status ?? []).join(','),
        (filters.category ?? []).join(','),
        (filters.department ?? []).join(','),
        (filters.region ?? []).join(','),
      ].join('|'),
    [filters]
  );

  // ---------- Stable `showToast` ref ----------
  const showToastRef = useRef(showToast);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  // ---------- fetchNotifications ----------
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await apiService.get('/notifications', {
        params: { limit: 10, unread: true },
      });
      const data = unwrap<any[]>(response);
      const list = Array.isArray(data)
        ? data.map(normalizeNotification)
        : [];
      setNotifications(list);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setNotifications([]);
    }
  }, []);

  // ---------- fetchDashboardData ----------
  const fetchDashboardData = useCallback(
    async (silent = false) => {
      try {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const params: Record<string, any> = {
          range: timeRange,
          businessUnit: selectedBusinessUnit || 'all',
        };

        if (filters.businessUnit) params.businessUnitId = filters.businessUnit;
        if (filters.status?.length) params.status = filters.status.join(',');
        if (filters.category?.length)
          params.category = filters.category.join(',');
        if (filters.search) params.search = filters.search;
        if (filters.department?.length)
          params.department = filters.department.join(',');
        if (filters.region?.length)
          params.region = filters.region.join(',');

        const requestParams = primaryBusinessUnitId
          ? { ...params, businessUnitId: primaryBusinessUnitId }
          : params;

        type Slot =
          | 'stats'
          | 'trends'
          | 'recentSales'
          | 'topProducts'
          | 'activity';
        const slots: Slot[] = [];
        const fetchPromises: Promise<any>[] = [];

        if (permissions.canViewSales) {
          slots.push('stats', 'trends', 'recentSales');
          fetchPromises.push(
            safeFetch('/dashboard/stats', { params: requestParams }),
            safeFetch('/dashboard/trends', { params: requestParams }),
            safeFetch('/sales/recent', {
              params: { limit: 10, ...requestParams },
            })
          );
        }

        if (permissions.canViewProducts) {
          slots.push('topProducts');
          fetchPromises.push(
            safeFetch('/dashboard/top-products', {
              params: { limit: 10, ...requestParams },
            })
          );
        }

        if (permissions.canViewCustomers || permissions.canViewOrders) {
          slots.push('activity');
          fetchPromises.push(
            safeFetch('/dashboard/activity', {
              params: { limit: 10, ...requestParams },
            })
          );
        }

        const results = await Promise.allSettled(fetchPromises);

        const bySlot: Partial<Record<Slot, any>> = {};
        slots.forEach((slot, i) => {
          const result = results[i];
          if (isFulfilled(result) && result.value !== null) {
            bySlot[slot] = result.value;
          }
        });

        let hasData = false;

        if (bySlot.stats) {
          const data = bySlot.stats as Partial<DashboardStats>;
          if (data && Object.keys(data).length > 0) {
            setStats(mergeStats(data));
            hasData = true;
          }
        }

        if (bySlot.trends) {
          const data = bySlot.trends as SalesTrend[];
          if (Array.isArray(data) && data.length > 0) {
            setSalesTrend(data);
            hasData = true;
          }
        }

        if (bySlot.recentSales) {
          const data = bySlot.recentSales as RecentSale[];
          if (Array.isArray(data) && data.length > 0) {
            setRecentSales(data);
            hasData = true;
          }
        }

        if (bySlot.topProducts) {
          const raw = bySlot.topProducts as any[];
          if (Array.isArray(raw) && raw.length > 0) {
            // Normalize so every product has a unique, stable id.
            const data = raw.map(normalizeTopProduct);
            setTopProducts(data);
            hasData = true;
          }
        }

        if (bySlot.activity) {
          const data = bySlot.activity as RecentActivityItem[];
          if (Array.isArray(data) && data.length > 0) {
            setRecentActivity(data);
            hasData = true;
          }
        }

        setStats((prev) => prev ?? getEmptyStats());
        if (!hasData) hasData = true;

        const hasErrors = results.some((r) => r.status === 'rejected');
        if (hasErrors) {
          console.warn('Some dashboard data requests failed');
          if (showToastRef.current && !silent) {
            showToastRef.current('Some data could not be loaded', 'warning');
          }
        }

        if (silent && showToastRef.current) {
          showToastRef.current(
            'Dashboard data refreshed successfully',
            'success'
          );
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError('Failed to load dashboard data');
        setStats((prev) => prev ?? getEmptyStats());
        if (showToastRef.current && !silent) {
          showToastRef.current('Failed to load dashboard data', 'error');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      timeRange,
      selectedBusinessUnit,
      filters.businessUnit,
      filters.search,
      filtersKey,
      primaryBusinessUnitId,
      permissions.canViewSales,
      permissions.canViewProducts,
      permissions.canViewCustomers,
      permissions.canViewOrders,
    ]
  );

  // ---------- Mount + refetch effect ----------
  useEffect(() => {
    if (!isLoaded || !userId || !hasAccess) return;
    fetchDashboardData();
    fetchNotifications();
  }, [
    isLoaded,
    userId,
    hasAccess,
    timeRange,
    selectedBusinessUnit,
    filtersKey,
    fetchDashboardData,
    fetchNotifications,
  ]);

  // ---------- Handlers ----------
  const handleRefresh = useCallback(() => {
    fetchDashboardData(true);
    fetchNotifications();
  }, [fetchDashboardData, fetchNotifications]);

  const handleExport = useCallback(async () => {
    setExportLoading(true);
    try {
      const params: any = { range: timeRange, ...filters };
      if (selectedBusinessUnit) params.businessUnit = selectedBusinessUnit;

      const response = await apiService.get('/dashboard/export', {
        params,
        responseType: 'blob',
      });

      if (response && typeof response === 'object') {
        const blob = response as unknown as Blob;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute(
          'download',
          `dashboard-export-${new Date().toISOString()}.csv`
        );
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        if (showToastRef.current) {
          showToastRef.current(
            'Dashboard data exported successfully',
            'success'
          );
        }
      }
    } catch (err) {
      console.error('Export failed:', err);
      if (showToastRef.current) {
        showToastRef.current('Failed to export data', 'error');
      }
    } finally {
      setExportLoading(false);
    }
  }, [timeRange, filters, selectedBusinessUnit]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  }, []);

  const handleBusinessUnitChange = useCallback((unit: string | null) => {
    setSelectedBusinessUnit(unit);
  }, []);

  // ---------- Memoized derivations for render ----------
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const chartData = useMemo(
    () =>
      salesTrend.map((t) => ({
        date: t.date,
        revenue: t.revenue,
        orders: t.orders,
      })),
    [salesTrend]
  );

  const topProductsSlice = useMemo(
    () => topProducts.slice(0, 5),
    [topProducts]
  );

  // ---------- Early returns ----------
  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          You need admin or manager privileges to view the dashboard.
        </p>
      </div>
    );
  }

  // ---------- Local stats (never null past this point) ----------
  const s: DashboardStats = stats ?? getEmptyStats();

  // ---------- Render ----------
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`space-y-6 animate-fade-in ${
        isFullScreen
          ? 'fixed inset-0 z-modal overflow-auto p-6 bg-gray-50 dark:bg-gray-900'
          : ''
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Dashboard
              {isSuperAdmin && (
                <span className="text-2xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-semibold uppercase tracking-wide">
                  Super Admin
                </span>
              )}
              {isAdmin && !isSuperAdmin && (
                <span className="text-2xs bg-brand-100 text-brand-700 px-2 py-1 rounded-full font-semibold uppercase tracking-wide">
                  Admin
                </span>
              )}
              {isManager && (
                <span className="text-2xs bg-success-100 text-success-700 px-2 py-1 rounded-full font-semibold uppercase tracking-wide">
                  Manager
                </span>
              )}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Welcome back, {user?.firstName}! Here's your business overview.
              {isManager && (
                <span className="ml-2 text-sm text-brand-600 dark:text-brand-400">
                  (Manager View)
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {businessUnits.length > 0 && (
            <select
              value={selectedBusinessUnit || 'all'}
              onChange={(e) =>
                handleBusinessUnitChange(
                  e.target.value === 'all' ? null : e.target.value
                )
              }
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus-ring"
            >
              <option value="all">All Business Units</option>
              {businessUnits.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          )}

          <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
            {(['today', 'week', 'month', 'year'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 focus-ring ${
                  timeRange === range
                    ? 'bg-brand-gradient text-white shadow-brand'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-700'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
            {(['grid', 'list', 'compact'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 focus-ring ${
                  viewMode === mode
                    ? 'bg-brand-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-700'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowFilters((s) => !s)}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors focus-ring"
            aria-label="Filters"
          >
            <Filter className="w-4 h-4" />
          </button>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors focus-ring disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>

          {permissions.canExportData && (
            <button
              onClick={handleExport}
              disabled={exportLoading}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors focus-ring disabled:opacity-50"
              aria-label="Export"
            >
              <Download
                className={`w-4 h-4 ${exportLoading ? 'animate-pulse' : ''}`}
              />
            </button>
          )}

          <button
            onClick={() => setIsFullScreen((s) => !s)}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors focus-ring"
            aria-label="Toggle fullscreen"
          >
            {isFullScreen ? (
              <X className="w-4 h-4" />
            ) : (
              <Settings className="w-4 h-4" />
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowNotifications((s) => !s)}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors relative focus-ring"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-accent-500 text-white text-2xs rounded-full flex items-center justify-center animate-badge-pop">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-card-hover border border-gray-200 dark:border-gray-700 z-toast max-h-96 overflow-y-auto custom-scrollbar animate-slide-down">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <h3 className="font-semibold">Notifications</h3>
                  <button
                    onClick={() =>
                      setNotifications((prev) =>
                        prev.map((n) => ({ ...n, isRead: true }))
                      )
                    }
                    className="text-sm text-brand-600 hover:text-brand-700 font-medium"
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
                  notifications.map((notification, index) => (
                    <div
                      key={notification.id ?? `notif-${index}`}
                      onClick={() =>
                        setNotifications((prev) =>
                          prev.map((n) =>
                            n.id === notification.id
                              ? { ...n, isRead: true }
                              : n
                          )
                        )
                      }
                      className={`p-3 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors ${
                        !notification.isRead
                          ? 'bg-brand-50 dark:bg-brand-900/20'
                          : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {notification.message}
                          </p>
                          <p className="text-2xs text-gray-400 mt-1">
                            {formatDate(notification.timestamp)}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-brand-500 rounded-full mt-1" />
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

      {/* Permissions summary */}
      <div className="flex flex-wrap gap-2 text-sm">
        <div className="flex items-center gap-1 text-success-600">
          <Shield className="w-4 h-4" />
          <span className="font-medium">Permissions:</span>
        </div>
        {Object.entries(permissions).map(([key, value]) => (
          <span
            key={key}
            className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-2xs font-medium"
          >
            {value ? (
              <CheckCircle className="w-3 h-3 text-success-500" />
            ) : (
              <XCircle className="w-3 h-3 text-danger-500" />
            )}
            {key.replace('can', '').replace(/([A-Z])/g, ' $1').trim()}
          </span>
        ))}
      </div>

      {/* Filters panel */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="card-brand !p-4 animate-slide-down"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date Range
              </label>
              <select
                value={filters.dateRange}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    dateRange: e.target.value as FilterState['dateRange'],
                  }))
                }
                className="input-brand"
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
                  const values = Array.from(
                    e.target.selectedOptions,
                    (o) => o.value
                  );
                  setFilters((f) => ({ ...f, status: values }));
                }}
                className="input-brand custom-scrollbar"
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
                  const values = Array.from(
                    e.target.selectedOptions,
                    (o) => o.value
                  );
                  setFilters((f) => ({ ...f, category: values }));
                }}
                className="input-brand custom-scrollbar"
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
                onChange={(e) =>
                  setFilters((f) => ({ ...f, search: e.target.value }))
                }
                placeholder="Search..."
                className="input-brand"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => {
                setFilters({ dateRange: 'week' });
                setShowFilters(false);
              }}
              className="btn-secondary"
            >
              Clear Filters
            </button>
            <button
              onClick={() => setShowFilters(false)}
              className="btn-brand !py-2 !px-4 text-sm"
            >
              Apply Filters
            </button>
          </div>
        </motion.div>
      )}

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-2xl p-4 flex items-center gap-3 animate-slide-down">
          <AlertTriangle className="w-5 h-5 text-danger-600 dark:text-danger-400" />
          <span className="text-danger-700 dark:text-danger-300">{error}</span>
          <button
            onClick={() => fetchDashboardData(true)}
            className="ml-auto px-3 py-1 bg-danger-100 dark:bg-danger-800 text-danger-700 dark:text-danger-300 rounded-lg text-sm hover:bg-danger-200 transition-colors focus-ring"
          >
            Retry
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* Overview */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => toggleSection('overview')}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-brand-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Overview
              </h2>
              <span className="text-sm text-gray-500">
                Key metrics at a glance
              </span>
            </div>
            {expandedSections.includes('overview') ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>

          {expandedSections.includes('overview') && (
            <div className="p-6 pt-0">
              <div
                className={`grid gap-4 ${
                  viewMode === 'grid'
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                    : viewMode === 'list'
                    ? 'grid-cols-1'
                    : 'grid-cols-2 sm:grid-cols-4'
                }`}
              >
                <StatsCard
                  title="Today's Sales"
                  value={formatCurrency(s.sales.today.total || 0)}
                  subtitle={`${s.sales.today.count || 0} transactions`}
                  icon={<DollarSign className="w-5 h-5" />}
                  trend={trendDirection(s.sales.today.trend)}
                  color="blue"
                />
                <StatsCard
                  title="Weekly Sales"
                  value={formatCurrency(s.sales.week.total || 0)}
                  subtitle={`${s.sales.week.count || 0} transactions`}
                  icon={<TrendingUp className="w-5 h-5" />}
                  trend={trendDirection(s.sales.week.trend)}
                  color="green"
                />
                <StatsCard
                  title="Monthly Sales"
                  value={formatCurrency(s.sales.month.total || 0)}
                  subtitle={`${s.sales.month.count || 0} transactions`}
                  icon={<Calendar className="w-5 h-5" />}
                  trend={trendDirection(s.sales.month.trend)}
                  color="purple"
                />
                <StatsCard
                  title="Total Revenue"
                  value={formatCurrency(s.revenue.total || 0)}
                  subtitle={`Avg: ${formatCurrency(
                    s.revenue.average || 0
                  )} per order`}
                  icon={<BarChart3 className="w-5 h-5" />}
                  trend={trendDirection(s.revenue.growth)}
                  color="yellow"
                />
              </div>
            </div>
          )}
        </div>

        {/* Sales */}
        {permissions.canViewSales && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => toggleSection('sales')}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-success-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Sales Analytics
                </h2>
                <span className="text-sm text-gray-500">
                  Revenue and order trends
                </span>
              </div>
              {expandedSections.includes('sales') ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>

            {expandedSections.includes('sales') && (
              <div className="p-6 pt-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <SalesChart data={chartData} />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Top Products
                    </h4>
                    <div className="space-y-3">
                      {topProductsSlice.length > 0 ? (
                        topProductsSlice.map((product, index) => (
                          <div
                            key={product.id ?? `tp-${index}`}
                            className="flex items-center gap-3"
                          >
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-2xs font-bold ${
                                index === 0
                                  ? 'bg-warning-100 text-warning-700'
                                  : index === 1
                                  ? 'bg-gray-100 text-gray-700'
                                  : index === 2
                                  ? 'bg-brand-100 text-brand-700'
                                  : 'bg-brand-50 text-brand-600'
                              }`}
                            >
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {product.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {product.sales} sold
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                                {formatCurrency(product.revenue)}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-500">
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

        {/* Customers */}
        {permissions.canViewCustomers && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => toggleSection('customers')}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-secondary-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Customer Insights
                </h2>
                <span className="text-sm text-gray-500">
                  Customer growth and engagement
                </span>
              </div>
              {expandedSections.includes('customers') ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>

            {expandedSections.includes('customers') && (
              <div className="p-6 pt-0">
                <div
                  className={`grid gap-4 ${
                    viewMode === 'grid'
                      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                      : viewMode === 'list'
                      ? 'grid-cols-1'
                      : 'grid-cols-2 sm:grid-cols-4'
                  }`}
                >
                  <StatsCard
                    title="Total Customers"
                    value={formatNumber(s.customers.total || 0)}
                    subtitle={`${s.customers.new || 0} new this ${timeRange}`}
                    icon={<Users className="w-5 h-5" />}
                    trend={trendDirection(s.customers.trend)}
                    color="indigo"
                  />
                  <StatsCard
                    title="Active Customers"
                    value={s.customers.active || 0}
                    subtitle={`${s.customers.total || 0} total`}
                    icon={<UserCheck className="w-5 h-5" />}
                    color="green"
                  />
                  <StatsCard
                    title="Customer Growth"
                    value={`${s.customers.growth || 0}%`}
                    subtitle="Month over month"
                    icon={<TrendingUp className="w-5 h-5" />}
                    trend={trendDirection(s.customers.growth)}
                    color="purple"
                  />
                  <StatsCard
                    title="Retention Rate"
                    value={`${s.performance.retentionRate || 0}%`}
                    subtitle="Customer retention"
                    icon={<Activity className="w-5 h-5" />}
                    color="cyan"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inventory */}
        {permissions.canViewInventory && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => toggleSection('inventory')}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-brand-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Inventory Management
                </h2>
                <span className="text-sm text-gray-500">
                  Stock levels and value
                </span>
              </div>
              {expandedSections.includes('inventory') ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>

            {expandedSections.includes('inventory') && (
              <div className="p-6 pt-0">
                <div
                  className={`grid gap-4 ${
                    viewMode === 'grid'
                      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                      : viewMode === 'list'
                      ? 'grid-cols-1'
                      : 'grid-cols-2 sm:grid-cols-4'
                  }`}
                >
                  <StatsCard
                    title="Total Products"
                    value={s.products.total || 0}
                    subtitle={`${s.products.active || 0} active`}
                    icon={<Package className="w-5 h-5" />}
                    color="orange"
                  />
                  <StatsCard
                    title="Inventory Value"
                    value={formatCurrency(s.inventory.totalValue || 0)}
                    subtitle={`${s.inventory.totalItems || 0} items`}
                    icon={<DollarSign className="w-5 h-5" />}
                    color="blue"
                  />
                  <StatsCard
                    title="Low Stock Items"
                    value={s.products.lowStock || 0}
                    subtitle={`${s.products.outOfStock || 0} out of stock`}
                    icon={<AlertTriangle className="w-5 h-5" />}
                    trend={(s.products.lowStock ?? 0) > 0 ? 'down' : 'up'}
                    color="red"
                  />
                  <StatsCard
                    title="Turnover Rate"
                    value={`${s.inventory.turnover || 0}x`}
                    subtitle="Inventory turnover"
                    icon={<RefreshCw className="w-5 h-5" />}
                    color="cyan"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recent Activity + Quick Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentActivity activities={recentActivity} limit={5} />

          <div className="card-brand">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Quick Stats
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-r from-brand-50 to-secondary-50 dark:from-brand-900/20 dark:to-secondary-900/20 rounded-2xl p-4 border border-brand-100 dark:border-brand-800/30">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Order Completion
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                  {s.orders.completionRate || 0}%
                </p>
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <CheckCircle className="w-4 h-4 text-success-500" />
                  <span className="text-success-600 dark:text-success-400">
                    {s.orders.completed || 0} completed
                  </span>
                </div>
              </div>

              <div className="bg-gradient-to-r from-success-50 to-emerald-50 dark:from-success-900/20 dark:to-emerald-900/20 rounded-2xl p-4 border border-success-100 dark:border-success-800/30">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Customer Satisfaction
                </p>
                <p className="text-2xl font-bold text-success-600 dark:text-success-400 tabular-nums">
                  {s.performance.customerSatisfaction || 0}⭐
                </p>
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <Users className="w-4 h-4 text-success-500" />
                  <span className="text-success-600 dark:text-success-400">
                    from {s.customers.active || 0} customers
                  </span>
                </div>
              </div>

              <div className="bg-gradient-to-r from-secondary-50 to-pink-50 dark:from-secondary-900/20 dark:to-pink-900/20 rounded-2xl p-4 border border-secondary-100 dark:border-secondary-800/30">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Conversion Rate
                </p>
                <p className="text-2xl font-bold text-secondary-600 dark:text-secondary-400 tabular-nums">
                  {s.performance.conversionRate || 0}%
                </p>
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <TrendingUp className="w-4 h-4 text-secondary-500" />
                  <span className="text-secondary-600 dark:text-secondary-400">
                    visitors to customers
                  </span>
                </div>
              </div>

              <div className="bg-gradient-to-r from-warning-50 to-brand-50 dark:from-warning-900/20 dark:to-brand-900/20 rounded-2xl p-4 border border-warning-100 dark:border-warning-800/30">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Revenue Target
                </p>
                <p className="text-2xl font-bold text-warning-600 dark:text-warning-400 tabular-nums">
                  {s.revenue.progress || 0}%
                </p>
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <Target className="w-4 h-4 text-warning-500" />
                  <span className="text-warning-600 dark:text-warning-400">
                    {formatCurrency(s.revenue.total || 0)} /{' '}
                    {formatCurrency(s.revenue.target || 0)}
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
            {isSuperAdmin ? (
              <Globe className="w-4 h-4" />
            ) : (
              <Building className="w-4 h-4" />
            )}
            {isSuperAdmin ? 'Global Access' : 'Business Unit Access'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
