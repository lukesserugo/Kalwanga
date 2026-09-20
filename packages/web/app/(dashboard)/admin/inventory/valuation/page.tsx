// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\valuation\page.tsx

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, TrendingUp, TrendingDown, Package,
  RefreshCw, Download, Lock, AlertCircle,
  Calendar, BarChart3, PieChart, FileText,
  ChevronDown, ChevronUp, Info, Shield,
  Clock, Building, User, CheckCircle,
  AlertTriangle, X, Loader2, Eye,
  Printer, ExternalLink, Copy, Link2,
  Filter,
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { inventoryService } from '../../../../../services/inventoryService';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency, formatDate, formatNumber, formatPercent } from '../../../../../utils/formatters';

// ============================================
// TYPES
// ============================================

interface ValuationData {
  totalValue: number;
  totalCost: number;
  potentialProfit: number;
  profitMargin: number;
  totalItems: number;
  averageValue: number;
  averageCost: number;
  categories: Array<{
    id: string;
    name: string;
    categoryId?: string;
    count: number;
    value: number;
    cost: number;
    percentage: number;
    profit: number;
    profitMargin: number;
  }>;
  locations: Array<{
    location: string;
    count: number;
    value: number;
    cost: number;
    percentage: number;
  }>;
  stockStatus: {
    inStock: number;
    lowStock: number;
    outOfStock: number;
    total: number;
    healthScore: number;
  };
  lowStockItems: any[];
  outOfStockItems: any[];
  topValuableItems: Array<{
    id: string;
    name: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    totalValue: number;
    category: string;
    location: string;
  }>;
  valueDistribution: {
    byCategory: Array<{ category: string; value: number }>;
    byLocation: Array<{ location: string; value: number }>;
  };
  timestamp: string;
}

interface FilterState {
  category: string;
  location: string;
  minValue: number | null;
  maxValue: number | null;
  stockStatus: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  search: string;
}

// ============================================
// CONSTANTS
// ============================================

const STATUS_CONFIG = {
  in_stock: { label: 'In Stock', color: 'text-success-600 dark:text-success-400 bg-success-50 dark:bg-success-950/20 border-success-200 dark:border-success-800', icon: CheckCircle },
  low_stock: { label: 'Low Stock', color: 'text-warning-600 dark:text-warning-400 bg-warning-50 dark:bg-warning-950/20 border-warning-200 dark:border-warning-800', icon: AlertTriangle },
  out_of_stock: { label: 'Out of Stock', color: 'text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-950/20 border-danger-200 dark:border-danger-800', icon: AlertCircle },
};

// ============================================
// SUB-COMPONENTS
// ============================================

const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: string;
}> = ({ title, value, subtitle, icon, color }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <p className={`text-2xl font-bold tabular-nums ${color || 'text-gray-900 dark:text-white'}`}>
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
      {icon && (
        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
          {icon}
        </div>
      )}
    </div>
  </div>
);

const StatusBadge: React.FC<{ status: 'in_stock' | 'low_stock' | 'out_of_stock' }> = ({ status }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.in_stock;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function ValuationPage() {
  const router = useRouter();
  const { user, isAuthenticated, isSuperAdmin, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [valuation, setValuation] = useState<ValuationData | null>(null);
  const [filteredValuation, setFilteredValuation] = useState<ValuationData | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    category: '',
    location: '',
    minValue: null,
    maxValue: null,
    stockStatus: 'all',
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    categories: true,
    locations: true,
    topItems: true,
    lowStock: true,
    outOfStock: true,
  });

  // ✅ FIXED: Use businessUnits array instead of direct businessUnitId
  const businessUnitId = useMemo(() => {
    const units = user?.businessUnits;
    if (units && units.length > 0) {
      const firstUnit = units[0] as any;
      return firstUnit?.businessUnitId || firstUnit?.id || '';
    }
    const userAny = user as any;
    return userAny?.businessUnitId || localStorage.getItem('businessUnitId') || '';
  }, [user]);

  // Permission check
  const canViewReports = isSuperAdmin || isAdmin;

  // ============================================
  // PERMISSION GUARD
  // ============================================

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Please Login</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You need to be logged in to view valuation reports.</p>
        <button
          onClick={() => router.push('/login')}
          className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors shadow-brand focus-ring"
        >
          Go to Login
        </button>
      </div>
    );
  }

  if (!canViewReports) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to view valuation reports.</p>
          <button
            onClick={() => router.push('/admin/inventory')}
            className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors shadow-brand focus-ring"
          >
            Back to Inventory
          </button>
        </motion.div>
      </div>
    );
  }

  // ============================================
  // DATA LOADING
  // ============================================

  const loadValuation = useCallback(async () => {
    if (!businessUnitId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch all necessary data in parallel
      const [summary, stats, allInventory, lowStock, outOfStock, categorySummary] = await Promise.all([
        inventoryService.getInventorySummary(businessUnitId),
        inventoryService.getInventoryStats(businessUnitId),
        inventoryService.getAllInventory(businessUnitId),
        inventoryService.getLowStockItems(businessUnitId),
        inventoryService.getOutOfStockItems(businessUnitId),
        inventoryService.getCategorySummary(businessUnitId),
      ]);

      // Extract data with fallbacks
      const totalValue = stats?.totalValue || summary?.totalValue || 0;
      const totalCost = stats?.totalCost || summary?.totalCost || 0;
      const totalItems = stats?.totalProducts || summary?.totalItems || allInventory?.items?.length || 0;

      // Build categories
      const categories = (categorySummary || summary?.categories || []).map((cat: any) => {
        const value = cat.value || 0;
        const count = cat.count || 0;
        const cost = cat.cost || 0;
        const profit = value - cost;
        return {
          id: cat.id || cat.categoryId || `cat-${Math.random()}`,
          name: cat.name || cat.category || 'Uncategorized',
          categoryId: cat.categoryId || cat.id || null,
          count,
          value,
          cost,
          percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
          profit,
          profitMargin: cost > 0 ? (profit / cost) * 100 : 0,
        };
      });

      // Build locations
      const locationMap = new Map<string, { count: number; value: number; cost: number }>();
      if (allInventory?.items && Array.isArray(allInventory.items)) {
        allInventory.items.forEach((item: any) => {
          const location = item.location || 'Warehouse';
          const existing = locationMap.get(location) || { count: 0, value: 0, cost: 0 };
          const price = item.unitPrice || item.price || 0;
          const cost = item.costPrice || 0;
          const quantity = item.quantity || item.stock || 0;
          existing.count += quantity;
          existing.value += quantity * price;
          existing.cost += quantity * cost;
          locationMap.set(location, existing);
        });
      }

      const locations = Array.from(locationMap.entries()).map(([location, data]) => ({
        location,
        count: data.count,
        value: data.value,
        cost: data.cost,
        percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      }));

      // Build top valuable items
      const topValuableItems = (allInventory?.items || [])
        .map((item: any) => {
          const quantity = item.quantity || item.stock || 0;
          const unitPrice = item.unitPrice || item.price || 0;
          return {
            id: item.id || item.productId || '',
            name: item.name || item.product?.name || 'Unknown',
            sku: item.sku || item.product?.sku || 'N/A',
            quantity,
            unitPrice,
            totalValue: quantity * unitPrice,
            category: item.category || item.product?.category?.name || 'Uncategorized',
            location: item.location || 'Warehouse',
          };
        })
        .sort((a: any, b: any) => b.totalValue - a.totalValue)
        .slice(0, 10);

      // Build stock status
      const lowStockCount = lowStock?.length || 0;
      const outOfStockCount = outOfStock?.length || 0;
      const inStockCount = Math.max(0, (stats?.totalProducts || totalItems) - lowStockCount - outOfStockCount);

      const stockStatus = {
        inStock: inStockCount,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
        total: stats?.totalProducts || totalItems,
        healthScore: 0,
      };
      stockStatus.healthScore = stockStatus.total > 0
        ? Math.round((stockStatus.inStock / stockStatus.total) * 100)
        : 0;

      // Build complete valuation data
      const valuationData: ValuationData = {
        totalValue,
        totalCost,
        potentialProfit: totalValue - totalCost,
        profitMargin: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
        totalItems,
        averageValue: totalItems > 0 ? totalValue / totalItems : 0,
        averageCost: totalItems > 0 ? totalCost / totalItems : 0,
        categories: categories.sort((a: any, b: any) => b.value - a.value),
        locations: locations.sort((a: any, b: any) => b.value - a.value),
        stockStatus,
        lowStockItems: lowStock || [],
        outOfStockItems: outOfStock || [],
        topValuableItems,
        valueDistribution: {
          byCategory: categories.map((c: any) => ({ category: c.name, value: c.value })),
          byLocation: locations.map((l: any) => ({ location: l.location, value: l.value })),
        },
        timestamp: new Date().toISOString(),
      };

      setValuation(valuationData);
      setFilteredValuation(valuationData);

    } catch (error: any) {
      console.error('Failed to load valuation:', error);
      const errorMsg = error?.message || 'Failed to load valuation data';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessUnitId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadValuation();
    toast.success('Valuation refreshed');
  };

  const handleExport = async () => {
    if (!businessUnitId) {
      toast.error('No business unit selected');
      return;
    }

    setExporting(true);
    try {
      await inventoryService.exportInventory(businessUnitId, 'csv');
      toast.success('Valuation report exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export valuation');
    } finally {
      setExporting(false);
    }
  };

  // ============================================
  // FILTERING
  // ============================================

  useEffect(() => {
    if (!valuation) return;

    let filtered = { ...valuation };

    // Apply search filter
    if (filters.search.trim()) {
      const searchLower = filters.search.toLowerCase().trim();
      filtered = {
        ...filtered,
        categories: filtered.categories.filter((cat: any) =>
          cat.name.toLowerCase().includes(searchLower)
        ),
        topValuableItems: filtered.topValuableItems.filter((item: any) =>
          item.name.toLowerCase().includes(searchLower) ||
          item.sku.toLowerCase().includes(searchLower)
        ),
        lowStockItems: filtered.lowStockItems.filter((item: any) =>
          item.name?.toLowerCase().includes(searchLower) ||
          item.sku?.toLowerCase().includes(searchLower)
        ),
        outOfStockItems: filtered.outOfStockItems.filter((item: any) =>
          item.name?.toLowerCase().includes(searchLower) ||
          item.sku?.toLowerCase().includes(searchLower)
        ),
      };
    }

    // Apply category filter
    if (filters.category) {
      filtered = {
        ...filtered,
        categories: filtered.categories.filter((cat: any) =>
          cat.id === filters.category
        ),
        topValuableItems: filtered.topValuableItems.filter((item: any) =>
          item.category === filters.category
        ),
      };
    }

    // Apply location filter
    if (filters.location) {
      filtered = {
        ...filtered,
        locations: filtered.locations.filter((loc: any) =>
          loc.location === filters.location
        ),
        topValuableItems: filtered.topValuableItems.filter((item: any) =>
          item.location === filters.location
        ),
      };
    }

    // Apply stock status filter
    if (filters.stockStatus !== 'all') {
      filtered = {
        ...filtered,
        lowStockItems: filters.stockStatus === 'low_stock' ? filtered.lowStockItems : [],
        outOfStockItems: filters.stockStatus === 'out_of_stock' ? filtered.outOfStockItems : [],
      };
    }

    // Apply value range filters
    if (filters.minValue !== null || filters.maxValue !== null) {
      filtered = {
        ...filtered,
        topValuableItems: filtered.topValuableItems.filter((item: any) => {
          const value = item.totalValue || 0;
          if (filters.minValue !== null && value < filters.minValue) return false;
          if (filters.maxValue !== null && value > filters.maxValue) return false;
          return true;
        }),
      };
    }

    setFilteredValuation(filtered);
  }, [valuation, filters]);

  const resetFilters = () => {
    setFilters({
      category: '',
      location: '',
      minValue: null,
      maxValue: null,
      stockStatus: 'all',
      search: '',
    });
    setShowFilters(false);
    toast.info('Filters reset');
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    if (isAuthenticated && businessUnitId) {
      loadValuation();
    }
  }, [isAuthenticated, businessUnitId, loadValuation]);

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-brand-600 dark:border-brand-400"></div>
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading valuation data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-brand-accent-50 dark:bg-brand-accent-950/20 border border-brand-accent-200 dark:border-brand-accent-800 rounded-xl flex items-start gap-3 max-w-4xl mx-auto mt-8">
        <AlertCircle className="w-5 h-5 text-brand-accent-600 dark:text-brand-accent-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-brand-accent-700 dark:text-brand-accent-300">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-2 text-sm text-brand-accent-600 dark:text-brand-accent-400 hover:text-brand-accent-800 dark:hover:text-brand-accent-300 transition-colors focus-ring"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const data = filteredValuation || valuation;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <DollarSign className="w-7 h-7 sm:w-8 sm:h-8 text-success-500" />
            Inventory Valuation
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Track the value of your inventory
            </p>
            {data?.timestamp && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Updated: {formatDate(data.timestamp)}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors disabled:opacity-50 focus-ring"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 border rounded-lg transition-colors focus-ring ${
              showFilters ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400' :
              'border-gray-300 dark:border-gray-600 hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 flex items-center gap-1 sm:gap-2 transition-colors disabled:opacity-50 text-sm focus-ring"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Search</label>
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    placeholder="Search items..."
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category</label>
                  <select
                    value={filters.category}
                    onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                  >
                    <option value="">All Categories</option>
                    {data?.categories?.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Location</label>
                  <select
                    value={filters.location}
                    onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                  >
                    <option value="">All Locations</option>
                    {data?.locations?.map((loc) => (
                      <option key={loc.location} value={loc.location}>{loc.location}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Stock Status</label>
                  <select
                    value={filters.stockStatus}
                    onChange={(e) => setFilters({ ...filters, stockStatus: e.target.value as FilterState['stockStatus'] })}
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                  >
                    <option value="all">All Status</option>
                    <option value="in_stock">In Stock</option>
                    <option value="low_stock">Low Stock</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 dark:text-gray-400">Min Value:</label>
                  <input
                    type="number"
                    value={filters.minValue || ''}
                    onChange={(e) => setFilters({ ...filters, minValue: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="Min"
                    className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                  />
                  <label className="text-xs text-gray-500 dark:text-gray-400">Max:</label>
                  <input
                    type="number"
                    value={filters.maxValue || ''}
                    onChange={(e) => setFilters({ ...filters, maxValue: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="Max"
                    className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                  />
                </div>
                <button
                  onClick={resetFilters}
                  className="px-3 py-1.5 text-sm text-brand-accent-600 hover:text-brand-accent-700 dark:text-brand-accent-400 dark:hover:text-brand-accent-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-accent-50 dark:hover:bg-gray-700 transition-colors focus-ring"
                >
                  <X className="w-3 h-3 inline mr-1" />
                  Reset Filters
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Value"
          value={formatCurrency(data?.totalValue || 0)}
          subtitle={`${data?.totalItems || 0} items`}
          icon={<DollarSign className="w-5 h-5 text-success-500" />}
          color="text-success-600 dark:text-success-400"
        />
        <StatCard
          title="Total Cost"
          value={formatCurrency(data?.totalCost || 0)}
          subtitle={`Avg: ${formatCurrency(data?.averageCost || 0)}/item`}
          icon={<Package className="w-5 h-5 text-brand-500" />}
          color="text-brand-600 dark:text-brand-400"
        />
        <StatCard
          title="Potential Profit"
          value={formatCurrency(data?.potentialProfit || 0)}
          subtitle={`Margin: ${formatPercent((data?.profitMargin || 0) / 100)}`}
          icon={<TrendingUp className="w-5 h-5 text-secondary-500" />}
          color="text-secondary-600 dark:text-secondary-400"
        />
        <StatCard
          title="Health Score"
          value={`${data?.stockStatus?.healthScore || 0}%`}
          subtitle={`${data?.stockStatus?.inStock || 0} in stock, ${data?.stockStatus?.lowStock || 0} low, ${data?.stockStatus?.outOfStock || 0} out`}
          icon={<CheckCircle className="w-5 h-5" />}
          color={(data?.stockStatus?.healthScore ?? 0) >= 80 ? 'text-success-600 dark:text-success-400' :
                (data?.stockStatus?.healthScore ?? 0) >= 50 ? 'text-warning-600 dark:text-warning-400' :
                'text-danger-600 dark:text-danger-400'}
        />
      </div>

      {/* Stock Health Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Stock Health Overview
          </h3>
          <span className="text-xs text-gray-400 tabular-nums">
            {data?.stockStatus?.total || 0} total items
          </span>
        </div>
        <div className="flex h-4 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${((data?.stockStatus?.inStock || 0) / (data?.stockStatus?.total || 1)) * 100}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="bg-success-500 h-full"
            title={`In Stock: ${data?.stockStatus?.inStock || 0}`}
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${((data?.stockStatus?.lowStock || 0) / (data?.stockStatus?.total || 1)) * 100}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
            className="bg-warning-500 h-full"
            title={`Low Stock: ${data?.stockStatus?.lowStock || 0}`}
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${((data?.stockStatus?.outOfStock || 0) / (data?.stockStatus?.total || 1)) * 100}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
            className="bg-brand-accent-500 h-full"
            title={`Out of Stock: ${data?.stockStatus?.outOfStock || 0}`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-success-500"></div>
            <span className="text-xs text-gray-600 dark:text-gray-400 tabular-nums">In Stock: {data?.stockStatus?.inStock || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-warning-500"></div>
            <span className="text-xs text-gray-600 dark:text-gray-400 tabular-nums">Low Stock: {data?.stockStatus?.lowStock || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-brand-accent-500"></div>
            <span className="text-xs text-gray-600 dark:text-gray-400 tabular-nums">Out of Stock: {data?.stockStatus?.outOfStock || 0}</span>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          onClick={() => toggleSection('categories')}
          className="w-full flex items-center justify-between p-4 hover:bg-brand-50/50 dark:hover:bg-gray-700/50 transition-colors focus-ring"
        >
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-brand-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Category Breakdown</h3>
            <span className="text-xs text-gray-400 tabular-nums">({data?.categories?.length || 0} categories)</span>
          </div>
          {expandedSections.categories ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {expandedSections.categories && (
          <div className="p-4 pt-0 border-t border-gray-200 dark:border-gray-700">
            {data?.categories?.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">No categories found</p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                {data?.categories?.map((category, index) => (
                  <motion.div
                    key={category.id || index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 dark:text-gray-300 truncate pr-2">
                        {category.name}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap tabular-nums">
                        {category.count} items · {formatCurrency(category.value)}
                        <span className="text-xs text-gray-400 ml-1">
                          ({formatPercent((category.percentage || 0) / 100)})
                        </span>
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 relative overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(category.percentage || 0, 100)}%` }}
                        transition={{ duration: 0.8, delay: index * 0.05 }}
                        className="bg-gradient-to-r from-brand-500 to-success-500 rounded-full h-2"
                      />
                    </div>
                    <div className="flex justify-end mt-0.5">
                      <span className="text-xs text-gray-400 tabular-nums">
                        Profit: {formatCurrency(category.profit || 0)} ·
                        Margin: {formatPercent((category.profitMargin || 0) / 100)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Top Valuable Items */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          onClick={() => toggleSection('topItems')}
          className="w-full flex items-center justify-between p-4 hover:bg-brand-50/50 dark:hover:bg-gray-700/50 transition-colors focus-ring"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Valuable Items</h3>
            <span className="text-xs text-gray-400 tabular-nums">({data?.topValuableItems?.length || 0} items)</span>
          </div>
          {expandedSections.topItems ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {expandedSections.topItems && (
          <div className="p-4 pt-0 border-t border-gray-200 dark:border-gray-700">
            {data?.topValuableItems?.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">No items found</p>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">Item</th>
                      <th className="pb-2 font-medium">SKU</th>
                      <th className="pb-2 font-medium text-right hidden md:table-cell">Category</th>
                      <th className="pb-2 font-medium text-right">Qty</th>
                      <th className="pb-2 font-medium text-right">Unit Price</th>
                      <th className="pb-2 font-medium text-right">Total Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.topValuableItems?.map((item, index) => (
                      <motion.tr
                        key={item.id || index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-brand-50/50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                        onClick={() => router.push(`/admin/inventory/items/${item.id}`)}
                      >
                        <td className="py-2 text-gray-400 tabular-nums">#{index + 1}</td>
                        <td className="py-2 font-medium text-gray-900 dark:text-white">{item.name}</td>
                        <td className="py-2 text-gray-500 dark:text-gray-400 font-mono text-xs">{item.sku}</td>
                        <td className="py-2 text-right text-gray-600 dark:text-gray-400 hidden md:table-cell">{item.category}</td>
                        <td className="py-2 text-right text-gray-600 dark:text-gray-400 tabular-nums">{formatNumber(item.quantity)}</td>
                        <td className="py-2 text-right text-gray-600 dark:text-gray-400 tabular-nums">{formatCurrency(item.unitPrice)}</td>
                        <td className="py-2 text-right font-semibold text-success-600 dark:text-success-400 tabular-nums">{formatCurrency(item.totalValue)}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Low Stock & Out of Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Items */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => toggleSection('lowStock')}
            className="w-full flex items-center justify-between p-4 hover:bg-brand-50/50 dark:hover:bg-gray-700/50 transition-colors focus-ring"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Low Stock Items</h3>
              <span className="text-xs text-warning-600 dark:text-warning-400 bg-warning-50 dark:bg-warning-950/20 px-2 py-0.5 rounded-full tabular-nums">
                {data?.stockStatus?.lowStock || 0}
              </span>
            </div>
            {expandedSections.lowStock ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {expandedSections.lowStock && (
            <div className="p-4 pt-0 border-t border-gray-200 dark:border-gray-700">
              {data?.lowStockItems?.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-success-500 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">No low stock items</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                  {data?.lowStockItems?.map((item, index) => (
                    <motion.div
                      key={item.id || index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="flex items-center justify-between p-3 bg-warning-50 dark:bg-warning-950/10 rounded-lg border border-warning-200 dark:border-warning-800/30 hover:bg-warning-100 dark:hover:bg-warning-950/20 transition-colors cursor-pointer"
                      onClick={() => router.push(`/admin/inventory/items/${item.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.name || item.product?.name || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          SKU: {item.sku || item.product?.sku || 'N/A'} ·
                          Location: {item.location || 'Warehouse'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-sm font-semibold text-warning-600 dark:text-warning-400 tabular-nums">
                          {item.quantity || item.stock || 0} units
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                          Reorder: {item.reorderPoint || 5}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Out of Stock Items */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => toggleSection('outOfStock')}
            className="w-full flex items-center justify-between p-4 hover:bg-brand-50/50 dark:hover:bg-gray-700/50 transition-colors focus-ring"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-brand-accent-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Out of Stock Items</h3>
              <span className="text-xs text-brand-accent-600 dark:text-brand-accent-400 bg-brand-accent-50 dark:bg-brand-accent-950/20 px-2 py-0.5 rounded-full tabular-nums">
                {data?.stockStatus?.outOfStock || 0}
              </span>
            </div>
            {expandedSections.outOfStock ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {expandedSections.outOfStock && (
            <div className="p-4 pt-0 border-t border-gray-200 dark:border-gray-700">
              {data?.outOfStockItems?.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-success-500 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">No out of stock items</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                  {data?.outOfStockItems?.map((item, index) => (
                    <motion.div
                      key={item.id || index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="flex items-center justify-between p-3 bg-brand-accent-50 dark:bg-brand-accent-950/10 rounded-lg border border-brand-accent-200 dark:border-brand-accent-800/30 hover:bg-brand-accent-100 dark:hover:bg-brand-accent-950/20 transition-colors cursor-pointer"
                      onClick={() => router.push(`/admin/inventory/items/${item.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.name || item.product?.name || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          SKU: {item.sku || item.product?.sku || 'N/A'} ·
                          Location: {item.location || 'Warehouse'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-sm font-semibold text-brand-accent-600 dark:text-brand-accent-400 tabular-nums">0 units</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Last updated: {item.updatedAt ? formatDate(item.updatedAt) : 'N/A'}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
        <div>
          <span>Valuation Report</span>
          <span className="mx-2">·</span>
          <span>Generated: {data?.timestamp ? formatDate(data.timestamp) : 'N/A'}</span>
          <span className="mx-2">·</span>
          <span>Business Unit: {businessUnitId ? businessUnitId.slice(0, 8) : 'N/A'}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Report ID: {data?.timestamp ? `V-${data.timestamp.replace(/[-:T.Z]/g, '').slice(0, 12)}` : 'N/A'}</span>
          <button
            onClick={() => window.print()}
            className="p-1.5 hover:bg-brand-50 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
            title="Print Report"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
