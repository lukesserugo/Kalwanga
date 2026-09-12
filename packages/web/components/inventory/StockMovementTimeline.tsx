// D:\Projects\Kalwanga\packages\web\components\inventory\StockMovementTimeline.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Clock, Calendar,
  Filter, RefreshCw, Download, Eye, ArrowUp, ArrowDown,
  Package, User, MapPin, FileText, X, Loader2,
  ChevronLeft, ChevronRight, Search, AlertCircle,
  CheckCircle, Building, DollarSign, Tag, Truck,
  ShoppingCart, Plus, Minus, ArrowUpRight, ArrowDownRight,
  Printer, Copy, Link, ExternalLink
} from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { toast } from '../../utils/toast-manager';
import { formatDate, formatCurrency, formatNumber } from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';

// ============================================
// TYPES
// ============================================

interface Movement {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productImage?: string;
  productPrice?: number;
  transactionType: string;
  quantity: number;
  notes?: string;
  location?: string;
  fromLocation?: string;
  toLocation?: string;
  reference?: string;
  createdAt: string;
  user: { 
    id?: string;
    firstName: string; 
    lastName: string;
    email?: string;
  };
  inventoryId?: string;
  businessUnitId?: string;
  businessUnit?: {
    id: string;
    name: string;
    code: string;
  };
}

interface StockMovementTimelineProps {
  productId?: string;
  inventoryId?: string;
  businessUnitId?: string;
  limit?: number;
  compact?: boolean;
  showFilters?: boolean;
  showExport?: boolean;
  className?: string;
  onMovementClick?: (movement: Movement) => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// ============================================
// CONSTANTS
// ============================================

const TRANSACTION_TYPES = [
  { value: 'PURCHASE', label: 'Purchase', icon: ShoppingCart, color: 'green' },
  { value: 'SALE', label: 'Sale', icon: TrendingDown, color: 'red' },
  { value: 'RESTOCK', label: 'Restock', icon: Package, color: 'blue' },
  { value: 'ADJUSTMENT_IN', label: 'Adjustment In', icon: Plus, color: 'green' },
  { value: 'ADJUSTMENT_OUT', label: 'Adjustment Out', icon: Minus, color: 'red' },
  { value: 'TRANSFER_IN', label: 'Transfer In', icon: ArrowDownRight, color: 'blue' },
  { value: 'TRANSFER_OUT', label: 'Transfer Out', icon: ArrowUpRight, color: 'orange' },
  { value: 'ISSUE', label: 'Issue', icon: Truck, color: 'yellow' },
  { value: 'RETURN', label: 'Return', icon: ArrowUp, color: 'teal' },
  { value: 'INITIAL', label: 'Initial Stock', icon: CheckCircle, color: 'purple' },
  { value: 'DAMAGED', label: 'Damaged', icon: AlertCircle, color: 'red' },
  { value: 'LOST', label: 'Lost', icon: AlertCircle, color: 'red' },
];

const TRANSACTION_ICONS: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  PURCHASE: { 
    icon: ShoppingCart, 
    color: 'text-green-600 dark:text-green-400', 
    bgColor: 'bg-green-50 dark:bg-green-900/20' 
  },
  SALE: { 
    icon: TrendingDown, 
    color: 'text-red-600 dark:text-red-400', 
    bgColor: 'bg-red-50 dark:bg-red-900/20' 
  },
  RESTOCK: { 
    icon: Package, 
    color: 'text-blue-600 dark:text-blue-400', 
    bgColor: 'bg-blue-50 dark:bg-blue-900/20' 
  },
  ADJUSTMENT_IN: { 
    icon: Plus, 
    color: 'text-green-600 dark:text-green-400', 
    bgColor: 'bg-green-50 dark:bg-green-900/20' 
  },
  ADJUSTMENT_OUT: { 
    icon: Minus, 
    color: 'text-red-600 dark:text-red-400', 
    bgColor: 'bg-red-50 dark:bg-red-900/20' 
  },
  TRANSFER_IN: { 
    icon: ArrowDownRight, 
    color: 'text-blue-600 dark:text-blue-400', 
    bgColor: 'bg-blue-50 dark:bg-blue-900/20' 
  },
  TRANSFER_OUT: { 
    icon: ArrowUpRight, 
    color: 'text-orange-600 dark:text-orange-400', 
    bgColor: 'bg-orange-50 dark:bg-orange-900/20' 
  },
  ISSUE: { 
    icon: Truck, 
    color: 'text-yellow-600 dark:text-yellow-400', 
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20' 
  },
  RETURN: { 
    icon: ArrowUp, 
    color: 'text-teal-600 dark:text-teal-400', 
    bgColor: 'bg-teal-50 dark:bg-teal-900/20' 
  },
  INITIAL: { 
    icon: CheckCircle, 
    color: 'text-purple-600 dark:text-purple-400', 
    bgColor: 'bg-purple-50 dark:bg-purple-900/20' 
  },
  DAMAGED: { 
    icon: AlertCircle, 
    color: 'text-red-600 dark:text-red-400', 
    bgColor: 'bg-red-50 dark:bg-red-900/20' 
  },
  LOST: { 
    icon: AlertCircle, 
    color: 'text-red-600 dark:text-red-400', 
    bgColor: 'bg-red-50 dark:bg-red-900/20' 
  },
};

const TRANSACTION_LABELS: Record<string, string> = {
  PURCHASE: 'Purchase',
  SALE: 'Sale',
  RESTOCK: 'Restock',
  ADJUSTMENT_IN: 'Stock Added',
  ADJUSTMENT_OUT: 'Stock Removed',
  TRANSFER_IN: 'Transfer In',
  TRANSFER_OUT: 'Transfer Out',
  ISSUE: 'Issued',
  RETURN: 'Return',
  INITIAL: 'Initial Stock',
  DAMAGED: 'Damaged',
  LOST: 'Lost',
};

// ============================================
// SUB-COMPONENTS
// ============================================

const MovementIcon: React.FC<{ type: string }> = ({ type }) => {
  const config = TRANSACTION_ICONS[type] || TRANSACTION_ICONS['PURCHASE'];
  const Icon = config.icon;
  
  return (
    <div className={`p-2 rounded-lg ${config.bgColor} flex-shrink-0`}>
      <Icon className={`w-4 h-4 ${config.color}`} />
    </div>
  );
};

const MovementCard: React.FC<{
  movement: Movement;
  compact?: boolean;
  onClick?: () => void;
}> = ({ movement, compact = false, onClick }) => {
  const isPositive = movement.quantity > 0;
  const label = TRANSACTION_LABELS[movement.transactionType] || movement.transactionType;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.01 }}
      className={`flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all cursor-pointer ${compact ? 'p-2' : ''}`}
      onClick={onClick}
    >
      <MovementIcon type={movement.transactionType} />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {movement.productName || 'Unknown Product'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            {movement.productSku || 'N/A'}
          </span>
          <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
            isPositive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 
            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
          }`}>
            {label}
          </span>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(movement.createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {movement.user?.firstName || 'System'} {movement.user?.lastName || ''}
          </span>
          {movement.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {movement.location}
            </span>
          )}
          {movement.businessUnit && (
            <span className="flex items-center gap-1">
              <Building className="w-3 h-3" />
              {movement.businessUnit.name}
            </span>
          )}
          {movement.reference && (
            <span className="font-mono text-gray-400">
              #{movement.reference}
            </span>
          )}
        </div>
        
        {movement.notes && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {movement.notes}
          </p>
        )}
      </div>
      
      <div className="text-right flex-shrink-0">
        <p className={`text-base font-bold ${
          isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
        }`}>
          {isPositive ? '+' : ''}{movement.quantity}
        </p>
        {movement.productPrice && (
          <p className="text-xs text-gray-400">
            {formatCurrency(movement.quantity * movement.productPrice)}
          </p>
        )}
      </div>
    </motion.div>
  );
};

const LoadingSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="animate-pulse flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-lg flex-shrink-0" />
          <div className="flex-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-2" />
            <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2" />
          </div>
          <div className="w-16 h-6 bg-gray-200 dark:bg-gray-600 rounded" />
        </div>
      ))}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export function StockMovementTimeline({
  productId,
  inventoryId,
  businessUnitId: propBusinessUnitId,
  limit = 20,
  compact = false,
  showFilters = true,
  showExport = true,
  className = '',
  onMovementClick,
  autoRefresh = true,
  refreshInterval = 30000,
}: StockMovementTimelineProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [filter, setFilter] = useState({
    startDate: '',
    endDate: '',
    type: '',
    search: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: limit,
    total: 0,
    totalPages: 1,
  });
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const businessUnitId = propBusinessUnitId || 
    user?.businessUnits?.[0]?.businessUnitId || 
    (user?.businessUnits?.[0] as any)?.id || 
    localStorage.getItem('businessUnitId') || '';

  // ============================================
  // DATA LOADING
  // ============================================

  const loadMovements = useCallback(async () => {
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
      
      // Add filters
      if (productId) params.productId = productId;
      if (inventoryId) params.inventoryId = inventoryId;
      if (filter.startDate) params.startDate = filter.startDate;
      if (filter.endDate) params.endDate = filter.endDate;
      if (filter.type) params.transactionType = filter.type;
      
      const data = await inventoryService.getInventoryTransactions(params);
      
      // Map data to Movement interface
      const items = (data.data || []).map((item: any) => ({
        id: item.id || '',
        productId: item.productId || item.product?.id || '',
        productName: item.product?.name || 'Unknown Product',
        productSku: item.product?.sku || 'N/A',
        productImage: item.product?.images?.[0],
        productPrice: item.product?.unitPrice || item.product?.price || 0,
        transactionType: item.transactionType || 'UNKNOWN',
        quantity: item.quantity || 0,
        notes: item.notes,
        location: item.location || item.inventory?.location,
        fromLocation: item.fromLocation,
        toLocation: item.toLocation,
        reference: item.reference,
        createdAt: item.createdAt || new Date().toISOString(),
        user: {
          id: item.user?.id,
          firstName: item.user?.firstName || 'System',
          lastName: item.user?.lastName || '',
          email: item.user?.email,
        },
        inventoryId: item.inventoryId || item.inventory?.id,
        businessUnitId: item.businessUnitId || item.businessUnit?.id,
        businessUnit: item.businessUnit,
      }));
      
      // Filter by search if provided
      let filteredItems = items;
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        filteredItems = items.filter((item: Movement) =>
          item.productName.toLowerCase().includes(searchLower) ||
          item.productSku.toLowerCase().includes(searchLower) ||
          (item.notes && item.notes.toLowerCase().includes(searchLower))
        );
      }
      
      setMovements(filteredItems);
      setPagination(prev => ({
        ...prev,
        total: data.total || items.length,
        totalPages: data.totalPages || Math.ceil((data.total || items.length) / prev.limit),
      }));
      
    } catch (error: any) {
      console.error('Failed to load movements:', error);
      setError(error?.message || 'Failed to load stock movements');
      toast.error('Failed to load stock movements');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessUnitId, productId, inventoryId, filter, pagination.page, pagination.limit]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMovements();
    toast.success('Movements refreshed');
  };

  const handleExport = async () => {
    try {
      const blob = await inventoryService.exportInventory(businessUnitId, 'csv');
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `stock-movements-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Movements exported successfully');
    } catch (error) {
      toast.error('Failed to export movements');
    }
  };

  const handleMovementClick = (movement: Movement) => {
    if (onMovementClick) {
      onMovementClick(movement);
    } else {
      setSelectedMovement(movement);
      setShowDetailModal(true);
    }
  };

  const handleClearFilters = () => {
    setFilter({
      startDate: '',
      endDate: '',
      type: '',
      search: '',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getTransactionTypeLabel = (type: string) => {
    return TRANSACTION_LABELS[type] || type.replace('_', ' ');
  };

  const getTransactionTypeColor = (type: string) => {
    const config = TRANSACTION_TYPES.find(t => t.value === type);
    if (!config) return 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300';
    
    const colors: Record<string, string> = {
      green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      teal: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
      purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    };
    return colors[config.color] || colors.blue;
  };

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh && businessUnitId) {
      interval = setInterval(loadMovements, refreshInterval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval, businessUnitId, loadMovements]);

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Stock Movement Timeline</h3>
        </div>
        <LoadingSkeleton count={compact ? 3 : 5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Stock Movement Timeline</h3>
        </div>
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasActiveFilters = filter.startDate || filter.endDate || filter.type || filter.search;
  const filteredMovements = movements;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      {/* Header */}
      <div className={`flex flex-wrap items-center justify-between gap-2 p-4 border-b border-gray-200 dark:border-gray-700 ${compact ? 'p-3' : ''}`}>
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Stock Movement Timeline</h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            ({pagination.total} movements)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showFilters && (
            <button
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              className={`p-2 border rounded-lg transition-colors ${
                showFiltersPanel || hasActiveFilters
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 ${refreshing ? 'animate-spin' : ''}`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {showExport && (
            <button
              onClick={handleExport}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && showFiltersPanel && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filter.startDate}
                  onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Date</label>
                <input
                  type="date"
                  value={filter.endDate}
                  onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Transaction Type</label>
                <select
                  value={filter.type}
                  onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  <option value="">All Types</option>
                  {TRANSACTION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={filter.search}
                    onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                    placeholder="Search products..."
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
              </div>
            </div>
            {hasActiveFilters && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleClearFilters}
                  className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Movements List */}
      <div className={`p-4 ${compact ? 'p-2' : ''} max-h-[500px] overflow-y-auto`}>
        {filteredMovements.length === 0 ? (
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No movements found</p>
            {hasActiveFilters && (
              <p className="text-sm text-gray-400 dark:text-gray-500">Try adjusting your filters</p>
            )}
          </div>
        ) : (
          <div className={`space-y-2 ${compact ? 'space-y-1.5' : ''}`}>
            {filteredMovements.map((movement) => (
              <MovementCard
                key={movement.id}
                movement={movement}
                compact={compact}
                onClick={() => handleMovementClick(movement)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            Showing {movements.length} of {pagination.total} movements
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page <= 1}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-gray-700 dark:text-gray-300">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedMovement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDetailModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <button
                onClick={() => setShowDetailModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <MovementIcon type={selectedMovement.transactionType} />
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {selectedMovement.productName}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    SKU: {selectedMovement.productSku}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Quantity</p>
                    <p className={`text-xl font-bold ${
                      selectedMovement.quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {selectedMovement.quantity > 0 ? '+' : ''}{selectedMovement.quantity}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Type</p>
                    <p className="text-lg font-medium text-gray-900 dark:text-white">
                      {getTransactionTypeLabel(selectedMovement.transactionType)}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Date & Time</span>
                    <span className="text-gray-900 dark:text-white">{formatDate(selectedMovement.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-500 dark:text-gray-400">User</span>
                    <span className="text-gray-900 dark:text-white">
                      {selectedMovement.user.firstName} {selectedMovement.user.lastName}
                    </span>
                  </div>
                  {selectedMovement.location && (
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-gray-500 dark:text-gray-400">Location</span>
                      <span className="text-gray-900 dark:text-white">{selectedMovement.location}</span>
                    </div>
                  )}
                  {selectedMovement.reference && (
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-gray-500 dark:text-gray-400">Reference</span>
                      <span className="font-mono text-gray-900 dark:text-white">#{selectedMovement.reference}</span>
                    </div>
                  )}
                </div>

                {selectedMovement.notes && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Notes</p>
                    <p className="text-sm text-gray-900 dark:text-white">{selectedMovement.notes}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    router.push(`/admin/inventory/${selectedMovement.inventoryId || selectedMovement.productId}`);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View Product
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// EXPORT
// ============================================

export default StockMovementTimeline;
