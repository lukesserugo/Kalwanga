// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\reports\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, TrendingUp, TrendingDown, Package, DollarSign,
  Calendar, Download, RefreshCw, Filter, FileText,
  PieChart, ArrowUp, ArrowDown, AlertTriangle, CheckCircle,
  Printer, Mail, Share2, Clock, Users, Building,
  Lock, Barcode, QrCode, Scan, Copy, ChevronDown,
  ChevronRight, X, Eye, ExternalLink, Loader2,
  AlertCircle, Info, HelpCircle, Zap, Award,
  Star, Globe, Archive, Layers, Tag, Hash,
  Weight, Percent, Image as ImageIcon, Link2,
  MoreVertical, Grid, List, LayoutGrid, Search, ChevronUp,
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { inventoryService } from '../../../../../services/inventoryService';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency, formatDate, formatNumber } from '../../../../../utils/formatters';
import { PermissionResource } from '../../../../../types/enums';

// ============================================
// TYPES
// ============================================

interface BarcodeStats {
  totalProducts: number;
  withBarcode: number;
  withoutBarcode: number;
  barcodeCoverage: number;
  barcodeTypes: Record<string, number>;
  recentBarcodes: Array<{
    productName: string;
    sku: string;
    barcode: string;
    createdAt: string;
  }>;
  qrCodesGenerated: number;
  scansToday: number;
  scansTotal: number;
  averageScansPerDay: number;
  topBarcodeFormat: string;
}

interface BarcodeAnalytics {
  dailyScans: Array<{ date: string; count: number }>;
  topScannedProducts: Array<{ name: string; sku: string; scans: number; category?: string }>;
  barcodeUsageByCategory: Array<{ category: string; count: number }>;
  scansByHour: Array<{ hour: number; count: number }>;
  weeklyTrend: Array<{ week: string; count: number }>;
}

interface ReportData {
  summary: {
    totalItems: number;
    totalValue: number;
    totalCost: number;
    lowStock: number;
    outOfStock: number;
    inStock: number;
    categories: Array<{ name: string; count: number; value: number }>;
  };
  movements: Array<{
    date: string;
    in: number;
    out: number;
    net: number;
  }>;
  valuation: Array<{
    category: string;
    value: number;
    cost: number;
    profit: number;
  }>;
  topProducts: Array<{
    name: string;
    sku: string;
    quantity: number;
    value: number;
    category?: string;
  }>;
}

interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf';
  includeCharts: boolean;
  includeRawData: boolean;
}

// ============================================
// SUB-COMPONENTS
// ============================================

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtext?: string;
  trend?: { value: number; direction: 'up' | 'down' | 'neutral' };
}> = ({ label, value, icon: Icon, color, subtext, trend }) => {
  const colorClasses: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
    green: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400' },
    yellow: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400' },
    red: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400' },
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400' },
    teal: { bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-600 dark:text-teal-400' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400' },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${colorClasses[color]?.bg || colorClasses.blue.bg} rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`text-2xl font-bold ${colorClasses[color]?.text || colorClasses.blue.text} mt-1`}>
            {value}
          </p>
          {subtext && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtext}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-1 text-xs ${
              trend.direction === 'up' ? 'text-green-600 dark:text-green-400' :
              trend.direction === 'down' ? 'text-red-600 dark:text-red-400' :
              'text-gray-400'
            }`}>
              {trend.direction === 'up' && <ArrowUp className="w-3 h-3" />}
              {trend.direction === 'down' && <ArrowDown className="w-3 h-3" />}
              <span>{trend.value > 0 ? '+' : ''}{trend.value.toFixed(1)}%</span>
            </div>
          )}
        </div>
        <div className={`p-2 rounded-lg bg-white dark:bg-gray-700/50`}>
          <Icon className={`w-5 h-5 ${colorClasses[color]?.text || colorClasses.blue.text}`} />
        </div>
      </div>
    </motion.div>
  );
};

const CoverageBadge: React.FC<{ percentage: number }> = ({ percentage }) => {
  const getBadge = () => {
    if (percentage >= 80) return { label: 'Excellent', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' };
    if (percentage >= 60) return { label: 'Good', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' };
    if (percentage >= 40) return { label: 'Fair', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' };
    return { label: 'Poor', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' };
  };

  const badge = getBadge();
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
      {badge.label}
    </span>
  );
};

const LoadingSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-24" />
          </div>
        ))}
      </div>
      <div className="animate-pulse">
        <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-64" />
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function ReportsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermission();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportType, setReportType] = useState<'summary' | 'movements' | 'valuation' | 'categories' | 'barcode'>('summary');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [barcodeStats, setBarcodeStats] = useState<BarcodeStats | null>(null);
  const [barcodeAnalytics, setBarcodeAnalytics] = useState<BarcodeAnalytics | null>(null);
  const [exporting, setExporting] = useState(false);
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    coverage: true,
    scans: true,
    types: true,
    recent: true,
    topProducts: true,
    categoryUsage: true,
    dailyScans: true,
    hourlyScans: false,
    weeklyTrend: false,
  });
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'csv',
    includeCharts: true,
    includeRawData: true,
  });
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || 
                          (user?.businessUnits?.[0] as any)?.id || 
                          localStorage.getItem('businessUnitId') || '';

  const canViewReports = hasPermission(`${PermissionResource.INVENTORY}:view`) || user?.role === 'SUPER_ADMIN';
  const canExport = hasPermission(`${PermissionResource.INVENTORY}:export`) || user?.role === 'SUPER_ADMIN';

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
        <p className="text-gray-500 dark:text-gray-400 mt-2">You need to be logged in to view reports.</p>
      </div>
    );
  }

  if (!canViewReports) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
            You don't have permission to view reports. Please contact your administrator.
          </p>
          <button
            onClick={() => router.push('/admin/inventory')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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

  const loadReport = useCallback(async () => {
    if (!businessUnitId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Load summary data
      const summary = await inventoryService.getInventorySummary(businessUnitId);
      
      // Load barcode stats if barcode tab is selected
      let barcodeStatsData = null;
      let barcodeAnalyticsData = null;
      
      if (reportType === 'barcode') {
        barcodeStatsData = await loadBarcodeStats();
        barcodeAnalyticsData = await loadBarcodeAnalytics();
      }

      // Build report data
      const report: ReportData = {
        summary: {
          totalItems: summary.totalItems || 0,
          totalValue: summary.totalValue || 0,
          totalCost: summary.totalCost || 0,
          lowStock: summary.lowStockItems || 0,
          outOfStock: summary.outOfStockItems || 0,
          inStock: (summary.totalItems || 0) - (summary.lowStockItems || 0) - (summary.outOfStockItems || 0),
          categories: (summary.categories || []).map((cat: any) => ({
            name: cat.category || cat.name || 'Uncategorized',
            count: cat.count || 0,
            value: cat.value || 0,
          })),
        },
        movements: [],
        valuation: [],
        topProducts: [],
      };

      setReportData(report);
      setBarcodeStats(barcodeStatsData);
      setBarcodeAnalytics(barcodeAnalyticsData);

    } catch (error: any) {
      console.error('Failed to load report:', error);
      const errorMsg = error?.message || 'Failed to load report';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessUnitId, reportType]);

  const loadBarcodeStats = async (): Promise<BarcodeStats> => {
    try {
      // Mock data for development
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        totalProducts: 256,
        withBarcode: 189,
        withoutBarcode: 67,
        barcodeCoverage: 73.8,
        barcodeTypes: {
          'EAN-13': 145,
          'UPC-A': 32,
          'CODE128': 12,
        },
        recentBarcodes: [
          { productName: 'iPhone 15 Pro', sku: 'APP-001', barcode: '8901234567890', createdAt: new Date().toISOString() },
          { productName: 'MacBook Pro', sku: 'APP-002', barcode: '8901234567891', createdAt: new Date(Date.now() - 3600000).toISOString() },
          { productName: 'Samsung Galaxy S24', sku: 'SAM-001', barcode: '9876543210123', createdAt: new Date(Date.now() - 7200000).toISOString() },
          { productName: 'Sony Headphones', sku: 'SON-001', barcode: '8765432109876', createdAt: new Date(Date.now() - 86400000).toISOString() },
          { productName: 'Dell XPS 15', sku: 'DEL-001', barcode: '7654321098765', createdAt: new Date(Date.now() - 172800000).toISOString() },
        ],
        qrCodesGenerated: 45,
        scansToday: 23,
        scansTotal: 156,
        averageScansPerDay: 5.2,
        topBarcodeFormat: 'EAN-13',
      };
    } catch (error) {
      console.error('Failed to load barcode stats:', error);
      return {
        totalProducts: 0,
        withBarcode: 0,
        withoutBarcode: 0,
        barcodeCoverage: 0,
        barcodeTypes: {},
        recentBarcodes: [],
        qrCodesGenerated: 0,
        scansToday: 0,
        scansTotal: 0,
        averageScansPerDay: 0,
        topBarcodeFormat: '',
      };
    }
  };

  const loadBarcodeAnalytics = async (): Promise<BarcodeAnalytics> => {
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      return {
        dailyScans: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          count: Math.floor(Math.random() * 15) + 1,
        })),
        topScannedProducts: [
          { name: 'iPhone 15 Pro', sku: 'APP-001', scans: 45, category: 'Electronics' },
          { name: 'Samsung Galaxy S24', sku: 'SAM-001', scans: 32, category: 'Mobile' },
          { name: 'MacBook Pro', sku: 'APP-002', scans: 28, category: 'Computers' },
          { name: 'Sony Headphones', sku: 'SON-001', scans: 19, category: 'Audio' },
          { name: 'Dell XPS 15', sku: 'DEL-001', scans: 15, category: 'Computers' },
        ],
        barcodeUsageByCategory: [
          { category: 'Electronics', count: 78 },
          { category: 'Accessories', count: 45 },
          { category: 'Computers', count: 32 },
          { category: 'Audio', count: 21 },
          { category: 'Mobile', count: 13 },
        ],
        scansByHour: Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          count: Math.floor(Math.random() * 10) + (i >= 8 && i <= 18 ? 5 : 0),
        })),
        weeklyTrend: [
          { week: 'Week 1', count: 45 },
          { week: 'Week 2', count: 52 },
          { week: 'Week 3', count: 38 },
          { week: 'Week 4', count: 61 },
          { week: 'Week 5', count: 48 },
        ],
      };
    } catch (error) {
      console.error('Failed to load barcode analytics:', error);
      return {
        dailyScans: [],
        topScannedProducts: [],
        barcodeUsageByCategory: [],
        scansByHour: [],
        weeklyTrend: [],
      };
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReport();
    toast.success('Report refreshed');
  };

  // ============================================
  // EXPORT HANDLERS
  // ============================================

  const handleExport = async () => {
    if (!canExport) {
      toast.error('You do not have permission to export reports');
      return;
    }

    setExporting(true);
    setError(null);
    try {
      const format = exportOptions.format;
      await inventoryService.exportInventory(businessUnitId, format === 'csv' ? 'csv' : 'excel');
      toast.success(`Report exported as ${format.toUpperCase()}`);
      setShowExportOptions(false);
    } catch (error: any) {
      console.error('Export failed:', error);
      const errorMsg = error?.message || 'Failed to export report';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setExporting(false);
    }
  };

  const handleCopyBarcode = async (barcode: string) => {
    try {
      await navigator.clipboard.writeText(barcode);
      setCopiedBarcode(barcode);
      toast.success('Barcode copied');
      setTimeout(() => setCopiedBarcode(null), 2000);
    } catch {
      toast.error('Failed to copy barcode');
    }
  };

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getCoverageColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600 dark:text-green-400';
    if (percentage >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    if (isAuthenticated && businessUnitId) {
      loadReport();
    }
  }, [isAuthenticated, businessUnitId, loadReport]);

  // ============================================
  // RENDER
  // ============================================

  if (loading && !refreshing) {
    return <LoadingSkeleton />;
  }

  const tabConfigs = [
    { id: 'summary', label: 'Summary', icon: BarChart3 },
    { id: 'barcode', label: 'Barcode Analytics', icon: Barcode },
    { id: 'categories', label: 'Categories', icon: PieChart },
    { id: 'movements', label: 'Movements', icon: TrendingUp },
    { id: 'valuation', label: 'Valuation', icon: DollarSign },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-800/30 rounded transition"
          >
            <X className="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <BarChart3 className="w-7 h-7 sm:w-8 sm:h-8 text-blue-500" />
            Inventory Reports
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Analyze your inventory performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 border rounded-lg transition-colors ${
              showFilters ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {canExport && (
            <div className="relative">
              <button
                onClick={() => setShowExportOptions(!showExportOptions)}
                className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1 sm:gap-2 transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
                {showExportOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              <AnimatePresence>
                {showExportOptions && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute right-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-10 min-w-[200px]"
                  >
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Format</p>
                      <div className="flex gap-2">
                        {(['csv', 'excel', 'pdf'] as const).map((format) => (
                          <button
                            key={format}
                            onClick={() => setExportOptions({ ...exportOptions, format })}
                            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                              exportOptions.format === format
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            {format.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                        <button
                          onClick={handleExport}
                          disabled={exporting}
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                        >
                          {exporting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          Export {exportOptions.format.toUpperCase()}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Filters Panel */}
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
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Date Range:</span>
                </div>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500">to</span>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => loadReport()}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  Apply
                </button>
                <button
                  onClick={() => setDateRange({
                    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    endDate: new Date().toISOString().split('T')[0],
                  })}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Last 30 Days
                </button>
                <button
                  onClick={() => setDateRange({
                    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    endDate: new Date().toISOString().split('T')[0],
                  })}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Last 7 Days
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Type Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-4">
        {tabConfigs.map((tab) => {
          const Icon = tab.icon;
          const isActive = reportType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Report Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        {reportType === 'barcode' ? (
          renderBarcodeSection()
        ) : reportType === 'summary' && reportData ? (
          renderSummarySection(reportData)
        ) : reportType === 'categories' && reportData ? (
          renderCategoriesSection(reportData)
        ) : reportType === 'movements' ? (
          renderMovementsSection()
        ) : reportType === 'valuation' ? (
          renderValuationSection(reportData)
        ) : null}
      </div>
    </div>
  );

  // ============================================
  // RENDER HELPER FUNCTIONS
  // ============================================

  function renderSummarySection(reportData: ReportData) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Inventory Summary</h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total Items"
            value={reportData.summary.totalItems}
            icon={Package}
            color="blue"
          />
          <StatCard
            label="Total Value"
            value={formatCurrency(reportData.summary.totalValue)}
            icon={DollarSign}
            color="green"
          />
          <StatCard
            label="Low Stock"
            value={reportData.summary.lowStock}
            icon={AlertTriangle}
            color="yellow"
          />
          <StatCard
            label="Out of Stock"
            value={reportData.summary.outOfStock}
            icon={AlertCircle}
            color="red"
          />
        </div>

        {/* Stock Health */}
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Stock Health</span>
            <span className="text-sm font-bold text-green-600 dark:text-green-400">
              {((reportData.summary.inStock / (reportData.summary.totalItems || 1)) * 100).toFixed(1)}% Healthy
            </span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
            <motion.div
              className="h-full bg-green-500"
              initial={{ width: 0 }}
              animate={{ width: `${(reportData.summary.inStock / (reportData.summary.totalItems || 1)) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
            <motion.div
              className="h-full bg-yellow-500"
              initial={{ width: 0 }}
              animate={{ width: `${(reportData.summary.lowStock / (reportData.summary.totalItems || 1)) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
            <motion.div
              className="h-full bg-red-500"
              initial={{ width: 0 }}
              animate={{ width: `${(reportData.summary.outOfStock / (reportData.summary.totalItems || 1)) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              In Stock ({reportData.summary.inStock})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              Low Stock ({reportData.summary.lowStock})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Out of Stock ({reportData.summary.outOfStock})
            </span>
          </div>
        </div>

        {/* Barcode Summary */}
        {barcodeStats && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Barcode className="w-4 h-4 text-blue-500" />
              Barcode Coverage Summary
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">With Barcode</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{barcodeStats.withBarcode}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Without Barcode</p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{barcodeStats.withoutBarcode}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Coverage</p>
                <p className={`text-lg font-bold ${getCoverageColor(barcodeStats.barcodeCoverage)}`}>
                  {barcodeStats.barcodeCoverage.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderCategoriesSection(reportData: ReportData) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Category Breakdown</h3>
        {reportData.summary.categories.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No categories found</p>
        ) : (
          <div className="space-y-3">
            {reportData.summary.categories.map((category, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700 dark:text-gray-300">{category.name}</span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {category.count} items - {formatCurrency(category.value)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((category.value / reportData.summary.totalValue) * 100, 100)}%` }}
                    transition={{ duration: 0.8, delay: index * 0.05 }}
                    className="bg-blue-500 rounded-full h-2"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderMovementsSection() {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Stock Movements</h3>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Movement data will appear here</p>
          <p className="text-sm">Select a date range to view movements</p>
        </div>
      </div>
    );
  }

  function renderValuationSection(reportData: ReportData | null) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Inventory Valuation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total Value"
            value={formatCurrency(reportData?.summary.totalValue || 0)}
            icon={DollarSign}
            color="green"
          />
          <StatCard
            label="Total Cost"
            value={formatCurrency(reportData?.summary.totalCost || 0)}
            icon={Package}
            color="purple"
          />
          <StatCard
            label="Potential Profit"
            value={formatCurrency((reportData?.summary.totalValue || 0) - (reportData?.summary.totalCost || 0))}
            icon={TrendingUp}
            color="teal"
          />
        </div>
        {reportData?.summary.categories && reportData.summary.categories.length > 0 && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Valuation by Category</h4>
            <div className="space-y-2">
              {reportData.summary.categories.map((category, index) => (
                <div key={index} className="flex justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-700 dark:text-gray-300">{category.name}</span>
                  <span className="text-gray-900 dark:text-white font-medium">{formatCurrency(category.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderBarcodeSection() {
    if (!barcodeStats) {
      return (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Barcode className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No barcode data available</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Barcode className="w-5 h-5 text-blue-500" />
          Barcode Analytics
        </h3>

        {/* Coverage Section */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('coverage')}
            className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Barcode className="w-5 h-5 text-blue-500" />
              <h4 className="font-medium text-gray-900 dark:text-white">Barcode Coverage</h4>
              <CoverageBadge percentage={barcodeStats.barcodeCoverage} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {barcodeStats.barcodeCoverage.toFixed(1)}%
              </span>
              {expandedSections.coverage ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </div>
          </button>
          
          <AnimatePresence>
            {expandedSections.coverage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="p-4 space-y-4"
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Products</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{barcodeStats.totalProducts}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center border border-green-200 dark:border-green-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">With Barcode</p>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">{barcodeStats.withBarcode}</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center border border-red-200 dark:border-red-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Without Barcode</p>
                    <p className="text-xl font-bold text-red-600 dark:text-red-400">{barcodeStats.withoutBarcode}</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Coverage</p>
                    <p className={`text-xl font-bold ${getCoverageColor(barcodeStats.barcodeCoverage)}`}>
                      {barcodeStats.barcodeCoverage.toFixed(1)}%
                    </p>
                  </div>
                </div>
                
                {/* Coverage Progress Bar */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Coverage Progress</span>
                    <span className="text-gray-700 dark:text-gray-300">{barcodeStats.barcodeCoverage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barcodeStats.barcodeCoverage}%` }}
                      transition={{ duration: 1 }}
                      className={`h-3 rounded-full ${
                        barcodeStats.barcodeCoverage >= 80 ? 'bg-green-500' :
                        barcodeStats.barcodeCoverage >= 50 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Scan Activity Section */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('scans')}
            className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Scan className="w-5 h-5 text-green-500" />
              <h4 className="font-medium text-gray-900 dark:text-white">Scan Activity</h4>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {barcodeStats.scansToday} today
              </span>
              {expandedSections.scans ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </div>
          </button>
          
          <AnimatePresence>
            {expandedSections.scans && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="p-4 space-y-4"
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Today's Scans</p>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{barcodeStats.scansToday}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center border border-green-200 dark:border-green-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Scans</p>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">{barcodeStats.scansTotal}</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center border border-purple-200 dark:border-purple-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">QR Codes Generated</p>
                    <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{barcodeStats.qrCodesGenerated}</p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center border border-orange-200 dark:border-orange-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Avg Scans/Day</p>
                    <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{barcodeStats.averageScansPerDay.toFixed(1)}</p>
                  </div>
                </div>

                {/* Daily Scans Chart */}
                {barcodeAnalytics && barcodeAnalytics.dailyScans.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Daily Scan Activity</p>
                    <div className="h-32 flex items-end gap-1">
                      {barcodeAnalytics.dailyScans.slice(-14).map((day, index) => {
                        const maxCount = Math.max(...barcodeAnalytics.dailyScans.map(d => d.count), 1);
                        const height = (day.count / maxCount) * 100;
                        return (
                          <div key={index} className="flex-1 flex flex-col items-center group">
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${Math.max(5, height)}%` }}
                              transition={{ duration: 0.5, delay: index * 0.02 }}
                              className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600 cursor-pointer"
                            />
                            <span className="text-[8px] text-gray-400 mt-1 rotate-45 origin-left group-hover:scale-110 transition-transform">
                              {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Barcode Type Distribution */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('types')}
            className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-purple-500" />
              <h4 className="font-medium text-gray-900 dark:text-white">Barcode Type Distribution</h4>
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                {barcodeStats.topBarcodeFormat}
              </span>
            </div>
            <div>
              {expandedSections.types ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </div>
          </button>
          
          <AnimatePresence>
            {expandedSections.types && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="p-4 space-y-3"
              >
                {Object.entries(barcodeStats.barcodeTypes).map(([type, count]) => (
                  <div key={type}>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{type}</span>
                      <span className="text-gray-700 dark:text-gray-300">{count} ({((count / barcodeStats.withBarcode) * 100).toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(count / barcodeStats.withBarcode) * 100}%` }}
                        transition={{ duration: 0.8 }}
                        className={`h-2 rounded-full ${
                          type === 'EAN-13' ? 'bg-blue-500' :
                          type === 'UPC-A' ? 'bg-green-500' :
                          type === 'CODE128' ? 'bg-purple-500' :
                          'bg-gray-500'
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recent Barcodes */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('recent')}
            className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              <h4 className="font-medium text-gray-900 dark:text-white">Recently Generated Barcodes</h4>
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                {barcodeStats.recentBarcodes.length}
              </span>
            </div>
            <div>
              {expandedSections.recent ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </div>
          </button>
          
          <AnimatePresence>
            {expandedSections.recent && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="p-4"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">Product</th>
                        <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">SKU</th>
                        <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">Barcode</th>
                        <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">Date</th>
                        <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {barcodeStats.recentBarcodes.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-3 py-2 text-gray-900 dark:text-white">{item.productName}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 font-mono">{item.sku}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <Barcode className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                              <span className="font-mono text-gray-600 dark:text-gray-300 text-xs">{item.barcode}</span>
                              <button
                                onClick={() => handleCopyBarcode(item.barcode)}
                                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                                title="Copy barcode"
                              >
                                {copiedBarcode === item.barcode ? (
                                  <CheckCircle className="w-3 h-3 text-green-500" />
                                ) : (
                                  <Copy className="w-3 h-3 text-gray-400" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{formatDate(item.createdAt)}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(JSON.stringify({ barcode: item.barcode }))}&size=200x200`;
                                  window.open(qrUrl, '_blank');
                                }}
                                className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                                title="Generate QR Code"
                              >
                                <QrCode className="w-3.5 h-3.5 text-blue-500" />
                              </button>
                              <button
                                onClick={() => router.push(`/admin/inventory?search=${item.sku}`)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                title="View in Inventory"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Top Scanned Products */}
        {barcodeAnalytics && barcodeAnalytics.topScannedProducts.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('topProducts')}
              className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <h4 className="font-medium text-gray-900 dark:text-white">Top Scanned Products</h4>
              </div>
              <div>
                {expandedSections.topProducts ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </div>
            </button>
            
            <AnimatePresence>
              {expandedSections.topProducts && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="p-4 space-y-3"
                >
                  {barcodeAnalytics.topScannedProducts.map((product, index) => (
                    <div key={index}>
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-700 dark:text-gray-300">{product.name}</span>
                          {product.category && (
                            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-500 dark:text-gray-400">
                              {product.category}
                            </span>
                          )}
                        </div>
                        <span className="text-gray-600 dark:text-gray-400">{product.scans} scans</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(product.scans / barcodeAnalytics.topScannedProducts[0].scans) * 100}%` }}
                          transition={{ duration: 0.8 }}
                          className="bg-green-500 rounded-full h-2"
                        />
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Barcode Usage by Category */}
        {barcodeAnalytics && barcodeAnalytics.barcodeUsageByCategory.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('categoryUsage')}
              className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-purple-500" />
                <h4 className="font-medium text-gray-900 dark:text-white">Barcode Usage by Category</h4>
              </div>
              <div>
                {expandedSections.categoryUsage ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </div>
            </button>
            
            <AnimatePresence>
              {expandedSections.categoryUsage && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="p-4 space-y-3"
                >
                  {barcodeAnalytics.barcodeUsageByCategory.map((category, index) => (
                    <div key={index}>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">{category.category}</span>
                        <span className="text-gray-600 dark:text-gray-400">{category.count}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(category.count / barcodeAnalytics.barcodeUsageByCategory[0].count) * 100}%` }}
                          transition={{ duration: 0.8 }}
                          className="bg-purple-500 rounded-full h-2"
                        />
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  }
}
