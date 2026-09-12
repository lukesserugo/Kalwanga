// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\transactions\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History, TrendingUp, TrendingDown, RefreshCw,
  Search, Filter, Download, Calendar, User,
  Package, ArrowUp, ArrowDown, Lock,
  ChevronLeft, ChevronRight, X, AlertCircle,
  Barcode, QrCode, Scan, Copy, Check, Eye,
  Loader2, Shield, Building2, Clock, FileText,
  Printer, ExternalLink, MoreVertical, Grid,
  List, LayoutGrid, ChevronDown, ChevronUp,
  Info, HelpCircle, DollarSign, Tag, Hash,
  Link2, Globe, Star, Award, Archive,
  Plus,  // ✅ ADDED
  Minus, // ✅ ADDED
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { inventoryService, InventoryTransaction } from '../../../../../services/inventoryService';
import { barcodeService } from '../../../../../services/barcodeService';
import { productService } from '../../../../../services/productService';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency, formatDate, formatNumber } from '../../../../../utils/formatters';
import { PermissionResource } from '../../../../../types/enums';

// ============================================
// TYPES
// ============================================

interface Transaction extends InventoryTransaction {
  product?: {
    id: string;
    name: string;
    sku: string;
    barcode?: string | null;
    unitPrice?: number;
    images?: string[];
    category?: { id: string; name: string };
  };
  variant?: {
    id: string;
    name: string;
    sku: string;
  };
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
  inventory?: {
    id: string;
    location?: string;
  };
}

interface BarcodeLookupResult {
  barcode: string;
  productId: string;
  productName: string;
  sku: string;
  unitPrice?: number;
  image?: string;
}

interface TransactionFilters {
  type: string;
  startDate: string;
  endDate: string;
  productId: string;
  userId: string;
  location: string;
  minQuantity: number;
  maxQuantity: number;
  hasBarcode: 'all' | 'yes' | 'no';
}

interface TransactionStats {
  total: number;
  totalIn: number;
  totalOut: number;
  netChange: number;
  uniqueProducts: number;
  uniqueUsers: number;
  totalValue: number;
}

// ============================================
// CONSTANTS
// ============================================

const TRANSACTION_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'SALE', label: 'Sale' },
  { value: 'RESTOCK', label: 'Restock' },
  { value: 'ISSUE', label: 'Issue' },
  { value: 'RETURN', label: 'Return' },
  { value: 'ADJUSTMENT_IN', label: 'Adjustment In' },
  { value: 'ADJUSTMENT_OUT', label: 'Adjustment Out' },
  { value: 'TRANSFER_IN', label: 'Transfer In' },
  { value: 'TRANSFER_OUT', label: 'Transfer Out' },
  { value: 'INITIAL', label: 'Initial' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'LOST', label: 'Lost' },
];

const TYPE_COLORS: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  PURCHASE: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', icon: TrendingUp },
  RESTOCK: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300', icon: Package },
  SALE: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', icon: TrendingDown },
  ISSUE: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-300', icon: ArrowUp },
  RETURN: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-800 dark:text-teal-300', icon: RefreshCw },
  ADJUSTMENT_IN: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', icon: Plus },
  ADJUSTMENT_OUT: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', icon: Minus },
  TRANSFER_IN: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-800 dark:text-indigo-300', icon: ArrowDown },
  TRANSFER_OUT: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-300', icon: ArrowUp },
  INITIAL: { bg: 'bg-gray-100 dark:bg-gray-700/50', text: 'text-gray-800 dark:text-gray-300', icon: Package },
  DAMAGED: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', icon: AlertCircle },
  LOST: { bg: 'bg-gray-100 dark:bg-gray-700/50', text: 'text-gray-800 dark:text-gray-300', icon: AlertCircle },
};

// ============================================
// SUB-COMPONENTS
// ============================================

const TypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const config = TYPE_COLORS[type] || TYPE_COLORS['INITIAL'];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className="w-3 h-3" />
      {type.replace('_', ' ')}
    </span>
  );
};

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtext?: string;
}> = ({ label, value, icon: Icon, color, subtext }) => {
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
        </div>
        <div className={`p-2 rounded-lg bg-white dark:bg-gray-700/50`}>
          <Icon className={`w-5 h-5 ${colorClasses[color]?.text || colorClasses.blue.text}`} />
        </div>
      </div>
    </motion.div>
  );
};

const LoadingSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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

export default function TransactionsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermission();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats>({
    total: 0,
    totalIn: 0,
    totalOut: 0,
    netChange: 0,
    uniqueProducts: 0,
    uniqueUsers: 0,
    totalValue: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [barcodeLookupResult, setBarcodeLookupResult] = useState<BarcodeLookupResult | null>(null);
  const [lookingUpBarcode, setLookingUpBarcode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>({
    type: '',
    startDate: '',
    endDate: '',
    productId: '',
    userId: '',
    location: '',
    minQuantity: 0,
    maxQuantity: 0,
    hasBarcode: 'all',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || 
                          (user?.businessUnits?.[0] as any)?.id || 
                          localStorage.getItem('businessUnitId') || '';

  const canViewTransactions = hasPermission(`${PermissionResource.INVENTORY}:view`) || user?.role === 'SUPER_ADMIN';
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
        <p className="text-gray-500 dark:text-gray-400 mt-2">You need to be logged in to view transactions.</p>
      </div>
    );
  }

  if (!canViewTransactions) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Shield className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view transactions. Please contact your administrator.
        </p>
        <button
          onClick={() => router.push('/admin/inventory')}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to Inventory
        </button>
      </div>
    );
  }

  // ============================================
  // DATA LOADING
  // ============================================

  const loadTransactions = useCallback(async () => {
    if (!businessUnitId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params: any = {
        businessUnitId,
        page: pagination.page,
        limit: pagination.limit,
      };
      
      if (filters.type) params.transactionType = filters.type;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.productId) params.productId = filters.productId;
      if (filters.userId) params.userId = filters.userId;
      if (filters.location) params.location = filters.location;

      const data = await inventoryService.getInventoryTransactions(params);
      
      const mappedTransactions = (data.data || []).map((tx: any) => ({
        id: tx.id || '',
        transactionType: tx.transactionType || tx.type || 'UNKNOWN',
        quantity: tx.quantity || 0,
        notes: tx.notes || null,
        reference: tx.reference || null,
        productId: tx.productId || tx.product?.id || '',
        variantId: tx.variantId || tx.variant?.id || null,
        inventoryId: tx.inventoryId || tx.inventory?.id || '',
        businessUnitId: tx.businessUnitId || '',
        userId: tx.userId || tx.user?.id || '',
        createdAt: tx.createdAt || tx.transactionDate || new Date().toISOString(),
        updatedAt: tx.updatedAt || tx.createdAt || new Date().toISOString(),
        product: tx.product ? {
          id: tx.product.id || '',
          name: tx.product.name || 'Unknown Product',
          sku: tx.product.sku || 'N/A',
          barcode: tx.product.barcode || null,
          unitPrice: tx.product.unitPrice || 0,
          images: tx.product.images || [],
          category: tx.product.category,
        } : undefined,
        variant: tx.variant ? {
          id: tx.variant.id || '',
          name: tx.variant.name || 'Unknown Variant',
          sku: tx.variant.sku || 'N/A',
        } : undefined,
        user: tx.user ? {
          id: tx.user.id || '',
          firstName: tx.user.firstName || 'System',
          lastName: tx.user.lastName || '',
          email: tx.user.email || '',
        } : undefined,
        inventory: tx.inventory ? {
          id: tx.inventory.id || '',
          location: tx.inventory.location,
        } : undefined,
      }));

      setTransactions(mappedTransactions);
      setFilteredTransactions(mappedTransactions);
      
      // Calculate stats
      const totalIn = mappedTransactions.filter(t => t.quantity > 0).reduce((sum, t) => sum + t.quantity, 0);
      const totalOut = mappedTransactions.filter(t => t.quantity < 0).reduce((sum, t) => sum + Math.abs(t.quantity), 0);
      const uniqueProducts = new Set(mappedTransactions.map(t => t.productId)).size;
      const uniqueUsers = new Set(mappedTransactions.map(t => t.userId)).size;
      const totalValue = mappedTransactions.reduce((sum, t) => sum + (t.quantity * (t.product?.unitPrice || 0)), 0);

      setStats({
        total: data.total || mappedTransactions.length,
        totalIn,
        totalOut,
        netChange: totalIn - totalOut,
        uniqueProducts,
        uniqueUsers,
        totalValue,
      });

      setPagination(prev => ({
        ...prev,
        total: data.total || 0,
        totalPages: data.totalPages || 1,
      }));

    } catch (error: any) {
      console.error('Failed to load transactions:', error);
      const errorMsg = error?.message || 'Failed to load transactions';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessUnitId, filters, pagination.page, pagination.limit]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    toast.success('Transactions refreshed');
  };

  // ============================================
  // BARCODE HANDLERS
  // ============================================

  const handleBarcodeSearch = async () => {
    if (!barcodeSearch || barcodeSearch.length < 3) {
      toast.warning('Please enter a valid barcode');
      return;
    }

    setLookingUpBarcode(true);
    setError(null);
    try {
      const result = await barcodeService.getProductByBarcode(barcodeSearch);
      
      if (result && result.productId) {
        try {
          const product = await productService.getProductById(result.productId);
          
          if (product && product.id) {
            setBarcodeLookupResult({
              barcode: barcodeSearch,
              productId: product.id,
              productName: product.name || 'Unknown Product',
              sku: product.sku || 'N/A',
              unitPrice: product.unitPrice || 0,
              image: product.images?.[0],
            });
            setFilters(prev => ({ ...prev, productId: product.id }));
            toast.success(`Found product: ${product.name || 'Unknown Product'}`);
          } else {
            setBarcodeLookupResult({
              barcode: barcodeSearch,
              productId: result.productId,
              productName: 'Unknown Product',
              sku: 'N/A',
            });
            setFilters(prev => ({ ...prev, productId: result.productId }));
            toast.warning('Product found but details could not be loaded');
          }
        } catch (productError) {
          console.warn('Could not fetch product details:', productError);
          setBarcodeLookupResult({
            barcode: barcodeSearch,
            productId: result.productId,
            productName: 'Unknown Product',
            sku: 'N/A',
          });
          setFilters(prev => ({ ...prev, productId: result.productId }));
          toast.warning('Product found but details could not be loaded');
        }
      } else {
        setBarcodeLookupResult(null);
        toast.warning('No product found for this barcode');
      }
    } catch (error: any) {
      console.error('Failed to lookup barcode:', error);
      if (error?.response?.status === 404) {
        toast.warning('No product found for this barcode');
      } else {
        const errorMsg = error?.message || 'Failed to lookup barcode';
        setError(errorMsg);
        toast.error(errorMsg);
      }
      setBarcodeLookupResult(null);
    } finally {
      setLookingUpBarcode(false);
    }
  };

  const handleCopyBarcode = async () => {
    if (!barcodeLookupResult?.barcode) return;
    try {
      await navigator.clipboard.writeText(barcodeLookupResult.barcode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Barcode copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const clearBarcodeSearch = () => {
    setBarcodeSearch('');
    setBarcodeLookupResult(null);
    setFilters(prev => ({ ...prev, productId: '' }));
  };

  // ============================================
  // FILTERING
  // ============================================

  const applyFilters = useCallback(() => {
    let filtered = [...transactions];

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(tx =>
        tx.product?.name?.toLowerCase().includes(query) ||
        tx.product?.sku?.toLowerCase().includes(query) ||
        (tx.product?.barcode && tx.product.barcode.toLowerCase().includes(query)) ||
        tx.reference?.toLowerCase().includes(query)
      );
    }

    // Barcode filter
    if (filters.hasBarcode === 'yes') {
      filtered = filtered.filter(tx => !!tx.product?.barcode);
    } else if (filters.hasBarcode === 'no') {
      filtered = filtered.filter(tx => !tx.product?.barcode);
    }

    // Quantity range
    if (filters.minQuantity > 0) {
      filtered = filtered.filter(tx => Math.abs(tx.quantity) >= filters.minQuantity);
    }
    if (filters.maxQuantity > 0) {
      filtered = filtered.filter(tx => Math.abs(tx.quantity) <= filters.maxQuantity);
    }

    // Location
    if (filters.location) {
      filtered = filtered.filter(tx =>
        tx.inventory?.location?.toLowerCase().includes(filters.location.toLowerCase())
      );
    }

    setFilteredTransactions(filtered);
  }, [transactions, searchQuery, filters]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // ============================================
  // EXPORT HANDLERS
  // ============================================

  const handleExport = async () => {
    if (!canExport) {
      toast.error('You do not have permission to export transactions');
      return;
    }

    setExporting(true);
    setError(null);
    try {
      await inventoryService.exportInventory(businessUnitId, 'csv');
      toast.success('Transactions exported successfully');
    } catch (error: any) {
      console.error('Failed to export:', error);
      const errorMsg = error?.message || 'Failed to export transactions';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setExporting(false);
    }
  };

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    if (isAuthenticated && businessUnitId) {
      loadTransactions();
    }
  }, [isAuthenticated, businessUnitId, loadTransactions]);

  // ============================================
  // RENDER
  // ============================================

  if (loading && !refreshing) {
    return <LoadingSkeleton />;
  }

  const hasActiveFilters = filters.type || filters.startDate || filters.endDate || filters.productId || 
                           filters.userId || filters.location || filters.minQuantity > 0 || 
                           filters.maxQuantity > 0 || filters.hasBarcode !== 'all' || searchQuery;

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
            <History className="w-7 h-7 sm:w-8 sm:h-8 text-blue-500" />
            Transaction History
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {stats.total} transactions • {stats.uniqueProducts} products • {stats.uniqueUsers} users
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 border rounded-lg transition-colors ${
              showFilters || hasActiveFilters
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
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
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1 sm:gap-2 transition-colors disabled:opacity-50 text-sm"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'Export'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Transactions"
          value={formatNumber(stats.total)}
          icon={History}
          color="blue"
        />
        <StatCard
          label="Total In"
          value={formatNumber(stats.totalIn)}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          label="Total Out"
          value={formatNumber(stats.totalOut)}
          icon={TrendingDown}
          color="red"
        />
        <StatCard
          label="Net Change"
          value={stats.netChange >= 0 ? `+${stats.netChange}` : `${stats.netChange}`}
          icon={Package}
          color={stats.netChange >= 0 ? 'teal' : 'orange'}
          subtext={stats.netChange >= 0 ? 'Positive growth' : 'Negative growth'}
        />
      </div>

      {/* Barcode Search Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[180px] relative">
            <Barcode className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              id="barcode-input"
              type="text"
              placeholder="Search by barcode..."
              value={barcodeSearch}
              onChange={(e) => setBarcodeSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBarcodeSearch()}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
          <button
            onClick={handleBarcodeSearch}
            disabled={lookingUpBarcode || !barcodeSearch}
            className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 sm:gap-2 transition-colors text-sm"
          >
            {lookingUpBarcode ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Scan className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Lookup</span>
          </button>
          {barcodeLookupResult && (
            <button
              onClick={clearBarcodeSearch}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>

        {/* Barcode Lookup Result */}
        <AnimatePresence>
          {barcodeLookupResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                    {barcodeLookupResult.image ? (
                      <img 
                        src={barcodeLookupResult.image} 
                        alt={barcodeLookupResult.productName} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {barcodeLookupResult.productName}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-mono">SKU: {barcodeLookupResult.sku}</span>
                      <span className="flex items-center gap-1">
                        Barcode: <span className="font-mono">{barcodeLookupResult.barcode}</span>
                        <button
                          onClick={handleCopyBarcode}
                          className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                        >
                          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </span>
                      {barcodeLookupResult.unitPrice && (
                        <span>{formatCurrency(barcodeLookupResult.unitPrice)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/admin/inventory?search=${barcodeLookupResult.sku}`)}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 flex-shrink-0"
                >
                  <Eye className="w-3 h-3" />
                  View in Inventory
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by product, SKU, or barcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {TRANSACTION_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                <select
                  value={filters.hasBarcode}
                  onChange={(e) => setFilters({ ...filters, hasBarcode: e.target.value as 'all' | 'yes' | 'no' })}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Barcodes</option>
                  <option value="yes">Has Barcode</option>
                  <option value="no">No Barcode</option>
                </select>
                <input
                  type="text"
                  placeholder="Filter by location..."
                  value={filters.location}
                  onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Date Range:</span>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500">to</span>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Min Qty:</span>
                  <input
                    type="number"
                    value={filters.minQuantity || ''}
                    onChange={(e) => setFilters({ ...filters, minQuantity: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500">Max:</span>
                  <input
                    type="number"
                    value={filters.maxQuantity || ''}
                    onChange={(e) => setFilters({ ...filters, maxQuantity: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  {hasActiveFilters && (
                    <button
                      onClick={() => {
                        setFilters({
                          type: '',
                          startDate: '',
                          endDate: '',
                          productId: '',
                          userId: '',
                          location: '',
                          minQuantity: 0,
                          maxQuantity: 0,
                          hasBarcode: 'all',
                        });
                        setSearchQuery('');
                        clearBarcodeSearch();
                      }}
                      className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 flex items-center gap-1"
                    >
                      <X className="w-4 h-4" />
                      Clear All
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Barcode</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <History className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-lg font-medium">No transactions found</p>
                    <p className="text-sm">Try adjusting your filters or search query</p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isPositive = tx.quantity > 0;
                  const hasBarcode = !!tx.product?.barcode;
                  
                  return (
                    <motion.tr
                      key={tx.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedTransaction(tx);
                        setShowDetailModal(true);
                      }}
                    >
                      <td className="px-4 py-3">
                        <TypeBadge type={tx.transactionType} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                            {tx.product?.images?.[0] ? (
                              <img 
                                src={tx.product.images[0]} 
                                alt={tx.product?.name || 'Product'} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Package className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white truncate max-w-[150px] sm:max-w-[200px]">
                              {tx.product?.name || 'Unknown Product'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                              SKU: {tx.product?.sku || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {hasBarcode ? (
                          <div className="flex items-center gap-1">
                            <Barcode className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            <span className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate max-w-[100px]">
                              {tx.product?.barcode}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No barcode</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {isPositive ? '+' : ''}{tx.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[100px]">
                            {tx.user?.firstName || 'System'} {tx.user?.lastName || ''}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(tx.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate hidden sm:table-cell">
                        {tx.notes || '-'}
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Stats */}
        {filteredTransactions.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-gray-600 dark:text-gray-400">
                Total: <strong className="text-gray-900 dark:text-white">{formatNumber(filteredTransactions.length)}</strong>
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                Net: <strong className={`${stats.netChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {stats.netChange >= 0 ? '+' : ''}{stats.netChange}
                </strong>
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                In: <strong className="text-green-600 dark:text-green-400">{formatNumber(stats.totalIn)}</strong>
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                Out: <strong className="text-red-600 dark:text-red-400">{formatNumber(stats.totalOut)}</strong>
              </span>
              {barcodeLookupResult && (
                <span className="text-gray-600 dark:text-gray-400">
                  Filtered by: <strong className="text-blue-600 dark:text-blue-400">{barcodeLookupResult.productName}</strong>
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400">
              Value: {formatCurrency(stats.totalValue)}
            </span>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Showing {filteredTransactions.length} of {pagination.total} transactions
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page <= 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDetailModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
            >
              <button
                onClick={() => setShowDetailModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <History className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Transaction Details</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Transaction ID: {selectedTransaction.id}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Type</p>
                  <TypeBadge type={selectedTransaction.transactionType} />
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Quantity</p>
                  <p className={`text-lg font-bold ${selectedTransaction.quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {selectedTransaction.quantity > 0 ? '+' : ''}{selectedTransaction.quantity}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg sm:col-span-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Product</p>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {selectedTransaction.product?.name || 'Unknown Product'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {selectedTransaction.product?.sku || 'N/A'}</p>
                  {selectedTransaction.product?.barcode && (
                    <div className="flex items-center gap-2 mt-1">
                      <Barcode className="w-4 h-4 text-green-500" />
                      <span className="font-mono text-sm text-gray-600 dark:text-gray-300">{selectedTransaction.product.barcode}</span>
                    </div>
                  )}
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">User</p>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900 dark:text-white">
                      {selectedTransaction.user?.firstName || 'System'} {selectedTransaction.user?.lastName || ''}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Date & Time</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900 dark:text-white">{formatDate(selectedTransaction.createdAt)}</span>
                  </div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Location</p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {selectedTransaction.inventory?.location || 'N/A'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Reference</p>
                  <p className="font-mono text-sm text-gray-600 dark:text-gray-300">
                    {selectedTransaction.reference || 'N/A'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg sm:col-span-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Notes</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {selectedTransaction.notes || 'No notes'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
                {selectedTransaction.productId && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      router.push(`/admin/inventory/${selectedTransaction.productId}`);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    View Product
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
