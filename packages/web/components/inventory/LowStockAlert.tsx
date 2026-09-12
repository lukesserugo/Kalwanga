// D:\Projects\Kalwanga\packages\web\components\inventory\LowStockAlert.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Package, ShoppingCart, X, Check, Loader2,
  RefreshCw, Bell, Clock, User, Building, Eye, ArrowRight,
  Plus, Minus, Truck, FileText, Printer, Download,
  Filter, Search, ChevronDown, ChevronUp, AlertCircle,
  CheckCircle, TrendingUp, TrendingDown, DollarSign,
  Tag, MapPin, Calendar, Hash, Weight, Percent,
  Globe, Star, Archive, Shield, Lock, Users
} from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { purchaseOrderService } from '../../services/purchaseOrderService';
import { toast } from '../../utils/toast-manager';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';
import { PermissionResource } from '../../types/enums';

// ============================================
// TYPES
// ============================================

interface InventoryItem {
  id: string;
  productId: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    images?: string[];
    unitPrice: number;
    costPrice?: number;
    category?: { id: string; name: string };
    supplier?: { id: string; name: string };
    description?: string;
    taxRate?: number;
    weight?: number;
  };
  variantId?: string;
  variant?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    attributes: Record<string, any>;
  };
  businessUnitId: string;
  businessUnit?: {
    id: string;
    name: string;
    code: string;
  };
  quantity: number;
  reserved: number;
  available?: number;
  reorderPoint: number;
  reorderQuantity: number;
  location?: string;
  shelfNumber?: string;
  supplier?: string;
  supplierId?: string;
  notes?: string;
  status: string;
  isActive?: boolean;
  isDigital?: boolean;
  featured?: boolean;
  unit?: string;
  weight?: number;
  taxRate?: number;
  tags?: string[];
  images?: string[];
  expiryDate?: string;
  batchNumber?: string;
  createdAt: string;
  updatedAt: string;
}

interface LowStockAlertProps {
  className?: string;
  maxItems?: number;
  showFilters?: boolean;
  showActions?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
  compact?: boolean;
  onItemSelect?: (item: InventoryItem) => void;
  onGeneratePO?: (items: InventoryItem[]) => void;
}

// ============================================
// SUB-COMPONENTS
// ============================================

const StatusBadge: React.FC<{ 
  quantity: number; 
  reorderPoint: number;
  isActive?: boolean;
}> = ({ quantity, reorderPoint, isActive = true }) => {
  if (!isActive) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
        Inactive
      </span>
    );
  }
  
  if (quantity === 0) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Out of Stock
      </span>
    );
  }
  if (quantity <= reorderPoint) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        Low Stock
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 flex items-center gap-1">
      <CheckCircle className="w-3 h-3" />
      In Stock
    </span>
  );
};

const ProgressBar: React.FC<{
  value: number;
  max: number;
  label?: string;
  color?: string;
}> = ({ value, max, label, color = 'blue' }) => {
  const percentage = Math.min((value / max) * 100, 100);
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
  };

  return (
    <div className="w-full">
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
        <motion.div
          className={`h-full ${colorClasses[color as keyof typeof colorClasses] || colorClasses.blue} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      {label && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export function LowStockAlert({
  className = '',
  maxItems = 50,
  showFilters = true,
  showActions = true,
  autoRefresh = true,
  refreshInterval = 60000,
  compact = false,
  onItemSelect,
  onGeneratePO,
}: LowStockAlertProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermission();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [generatingPO, setGeneratingPO] = useState(false);
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    lowStock: 0,
    outOfStock: 0,
    totalValue: 0,
  });

  const canManage = hasPermission(`${PermissionResource.INVENTORY}:manage`) || user?.role === 'SUPER_ADMIN';
  const canCreatePO = hasPermission(`${PermissionResource.INVENTORY}:create`) || user?.role === 'SUPER_ADMIN';

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || 
                          (user?.businessUnits?.[0] as any)?.id || 
                          localStorage.getItem('businessUnitId') || '';

  // ============================================
  // DATA LOADING
  // ============================================

  const loadLowStockItems = useCallback(async () => {
    if (!businessUnitId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const data = await inventoryService.getLowStockItems(businessUnitId);
      
      // Ensure data is an array
      const itemsArray = Array.isArray(data) ? data : [];
      setItems(itemsArray);
      
      // Calculate stats
      const lowStock = itemsArray.filter(item => 
        item.quantity > 0 && item.quantity <= (item.reorderPoint || 5)
      ).length;
      const outOfStock = itemsArray.filter(item => item.quantity === 0).length;
      const totalValue = itemsArray.reduce((sum, item) => 
        sum + ((item.quantity || 0) * (item.product?.unitPrice || 0)), 0
      );
      
      setStats({
        total: itemsArray.length,
        lowStock,
        outOfStock,
        totalValue,
      });
      
    } catch (error: any) {
      console.error('Failed to load low stock items:', error);
      setError(error?.message || 'Failed to load low stock items');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessUnitId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLowStockItems();
    toast.success('Inventory refreshed');
  };

  // ============================================
  // SELECTION HANDLERS
  // ============================================

  const handleSelectAll = () => {
    const filteredItems = getFilteredItems;
    if (selectedItems.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map(item => item.id));
    }
  };

  const handleSelectItem = (id: string) => {
    setSelectedItems(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      }
      return [...prev, id];
    });
  };

  // ============================================
  // PURCHASE ORDER GENERATION
  // ============================================

  const handleGeneratePO = async () => {
    if (selectedItems.length === 0) {
      toast.warning('Please select items to reorder');
      return;
    }

    if (!businessUnitId) {
      toast.error('Business unit not found');
      return;
    }

    if (!canCreatePO) {
      toast.error('You do not have permission to create purchase orders');
      return;
    }

    setGeneratingPO(true);
    try {
      const selectedInventoryItems = items.filter(item => selectedItems.includes(item.id));
      
      if (onGeneratePO) {
        await onGeneratePO(selectedInventoryItems);
      } else {
        // Group items by supplier
        const supplierGroups = new Map<string, InventoryItem[]>();
        selectedInventoryItems.forEach(item => {
          const supplierId = item.supplierId || item.supplier || 'default';
          if (!supplierGroups.has(supplierId)) {
            supplierGroups.set(supplierId, []);
          }
          supplierGroups.get(supplierId)!.push(item);
        });

        // Create POs for each supplier
        const results = [];
        for (const [supplierId, supplierItems] of supplierGroups) {
          try {
            const po = await purchaseOrderService.createPurchaseOrder({
              supplierId: supplierId,
              businessUnitId: businessUnitId,
              items: supplierItems.map(item => ({
                productId: item.productId || item.id,
                quantity: Math.max(item.reorderQuantity || 10, item.reorderPoint - item.quantity + 10),
                unitPrice: item.product?.costPrice || item.product?.unitPrice || 0,
              })),
              notes: 'Auto-generated from low stock alert',
            });
            results.push(po);
          } catch (err) {
            console.error(`Failed to create PO for supplier ${supplierId}:`, err);
          }
        }

        if (results.length > 0) {
          toast.success(`${results.length} purchase order(s) created successfully`);
          setSelectedItems([]);
          await loadLowStockItems();
        } else {
          toast.error('Failed to create purchase orders');
        }
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to generate purchase order');
    } finally {
      setGeneratingPO(false);
    }
  };

  const handleReorderSingle = async (itemId: string) => {
    setSelectedItems([itemId]);
    await handleGeneratePO();
  };

  // ============================================
  // FILTERING - ✅ FIXED
  // ============================================

  // ✅ FIXED: Use useMemo with explicit return type, not a function call
  const getFilteredItems = useMemo((): InventoryItem[] => {
    let filtered = items;
    
    if (filter === 'low') {
      filtered = filtered.filter((item: InventoryItem) => 
        item.quantity > 0 && item.quantity <= (item.reorderPoint || 5)
      );
    } else if (filter === 'out') {
      filtered = filtered.filter((item: InventoryItem) => item.quantity === 0);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item: InventoryItem) =>
        item.product?.name?.toLowerCase().includes(query) ||
        item.product?.sku?.toLowerCase().includes(query) ||
        item.supplier?.toLowerCase().includes(query)
      );
    }
    
    // Sort by severity: out of stock first, then low stock
    return filtered.sort((a, b) => {
      const aSeverity = a.quantity === 0 ? 0 : (a.quantity <= (a.reorderPoint || 5) ? 1 : 2);
      const bSeverity = b.quantity === 0 ? 0 : (b.quantity <= (b.reorderPoint || 5) ? 1 : 2);
      return aSeverity - bSeverity;
    }).slice(0, showAll ? maxItems : Math.min(10, maxItems));
  }, [items, filter, searchQuery, showAll, maxItems]);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    if (isAuthenticated && businessUnitId) {
      loadLowStockItems();
    }
  }, [isAuthenticated, businessUnitId, loadLowStockItems]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh && isAuthenticated && businessUnitId) {
      interval = setInterval(loadLowStockItems, refreshInterval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval, isAuthenticated, businessUnitId, loadLowStockItems]);

  // ============================================
  // RENDER
  // ============================================

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Please login to view low stock alerts</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading low stock items...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3 ${className}`}>
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
    );
  }

  const hasLowStockItems = items.length > 0;
  const filteredItems = getFilteredItems;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      {/* Header */}
      <div className={`p-4 border-b bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 ${compact ? 'p-3' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-red-700 dark:text-red-300 text-sm sm:text-base">
                Low Stock Alert
              </h3>
              <p className="text-xs text-red-600 dark:text-red-400">
                {items.length > 0 
                  ? `${items.length} items need attention` 
                  : 'All stock levels are healthy'}
              </p>
            </div>
          </div>
          
          {!compact && showActions && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-1.5 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              
              {canManage && hasLowStockItems && (
                <>
                  <button
                    onClick={handleSelectAll}
                    className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors"
                  >
                    {selectedItems.length === filteredItems.length && filteredItems.length > 0 
                      ? 'Deselect All' 
                      : 'Select All'}
                  </button>
                  
                  {canCreatePO && (
                    <button
                      onClick={handleGeneratePO}
                      disabled={selectedItems.length === 0 || generatingPO}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                    >
                      {generatingPO ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ShoppingCart className="w-3 h-3" />
                      )}
                      Generate PO ({selectedItems.length})
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Filters */}
        {showFilters && hasLowStockItems && !compact && (
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <div className="flex gap-1">
              <button
                onClick={() => setFilter('all')}
                className={`px-2 py-0.5 text-xs rounded-lg transition-colors ${
                  filter === 'all' 
                    ? 'bg-white dark:bg-gray-700 shadow-sm dark:shadow-gray-900' 
                    : 'hover:bg-white/50 dark:hover:bg-gray-700/50'
                }`}
              >
                All ({stats.total})
              </button>
              <button
                onClick={() => setFilter('low')}
                className={`px-2 py-0.5 text-xs rounded-lg transition-colors ${
                  filter === 'low' 
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' 
                    : 'hover:bg-white/50 dark:hover:bg-gray-700/50'
                }`}
              >
                Low ({stats.lowStock})
              </button>
              <button
                onClick={() => setFilter('out')}
                className={`px-2 py-0.5 text-xs rounded-lg transition-colors ${
                  filter === 'out' 
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
                    : 'hover:bg-white/50 dark:hover:bg-gray-700/50'
                }`}
              >
                Out ({stats.outOfStock})
              </button>
            </div>
            <div className="flex-1 min-w-[120px] relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white/80 dark:bg-gray-700/80 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Stats Summary - Compact */}
      {compact && hasLowStockItems && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-gray-600 dark:text-gray-400">
            <span className="text-red-600 dark:text-red-400 font-medium">{stats.outOfStock}</span> out of stock · 
            <span className="text-yellow-600 dark:text-yellow-400 font-medium"> {stats.lowStock}</span> low stock
          </span>
          <span className="text-gray-400">Value: {formatCurrency(stats.totalValue)}</span>
        </div>
      )}

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="p-8 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <Check className="w-12 h-12 text-green-500 dark:text-green-400 mx-auto mb-3" />
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">All Stock Levels Are Healthy</h4>
            <p className="text-gray-500 dark:text-gray-400 text-sm">No items are currently below their reorder point</p>
          </motion.div>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[500px] overflow-y-auto">
          {filteredItems.map((item, index) => {
            const isSelected = selectedItems.includes(item.id);
            const needed = Math.max(0, (item.reorderPoint || 5) - (item.quantity || 0) + (item.reorderQuantity || 10));
            const hasImage = (item.product?.images && item.product.images.length > 0) || 
                             (item.images && item.images.length > 0);
            const imageUrl = item.product?.images?.[0] || item.images?.[0];

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.5) }}
                className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${compact ? 'p-2' : ''}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Left: Checkbox + Image + Info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {showActions && canManage && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectItem(item.id)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 flex-shrink-0"
                      />
                    )}
                    
                    <div className="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {hasImage && imageUrl ? (
                        <img 
                          src={imageUrl} 
                          alt={item.product?.name || 'Product'} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/placeholder-image.png';
                          }}
                        />
                      ) : (
                        <Package className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                        {item.product?.name || 'Unknown Product'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-mono">{item.product?.sku || 'N/A'}</span>
                        {item.location && (
                          <>
                            <span className="text-gray-300 dark:text-gray-600">|</span>
                            <span className="flex items-center gap-0.5">
                              <MapPin className="w-3 h-3" />
                              {item.location}
                            </span>
                          </>
                        )}
                        {item.supplier && (
                          <>
                            <span className="text-gray-300 dark:text-gray-600">|</span>
                            <span className="flex items-center gap-0.5">
                              <Building className="w-3 h-3" />
                              {item.supplier}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Stats + Actions */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Stock</p>
                        <p className={`text-sm font-bold ${
                          item.quantity === 0 ? 'text-red-600 dark:text-red-400' :
                          item.quantity <= (item.reorderPoint || 5) ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-green-600 dark:text-green-400'
                        }`}>
                          {item.quantity}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Reorder</p>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.reorderPoint || 5}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Needed</p>
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{needed}</p>
                      </div>
                    </div>

                    <StatusBadge 
                      quantity={item.quantity || 0} 
                      reorderPoint={item.reorderPoint || 5}
                      isActive={item.isActive}
                    />

                    {showActions && !compact && (
                      <div className="flex gap-1">
                        {canCreatePO && item.quantity <= (item.reorderPoint || 5) && (
                          <button
                            onClick={() => handleReorderSingle(item.id)}
                            disabled={generatingPO}
                            className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/50 text-xs font-medium disabled:opacity-50 transition-colors"
                          >
                            Reorder
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (onItemSelect) {
                              onItemSelect(item);
                            } else {
                              router.push(`/admin/inventory/${item.id}`);
                            }
                          }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Progress Bar */}
                {!compact && (
                  <div className="mt-2">
                    <ProgressBar
                      value={item.quantity || 0}
                      max={Math.max((item.reorderPoint || 5) * 2, 10)}
                      color={item.quantity === 0 ? 'red' : item.quantity <= (item.reorderPoint || 5) ? 'yellow' : 'green'}
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {filteredItems.length > 0 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-3">
            <span>Showing {filteredItems.length} of {items.length} items</span>
            {items.length > 10 && filteredItems.length === 10 && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
              >
                View all ({items.length})
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {selectedItems.length > 0 && (
              <span className="text-blue-600 dark:text-blue-400">
                {selectedItems.length} selected
              </span>
            )}
            <span>Updated: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// EXPORT
// ============================================

export default LowStockAlert;
