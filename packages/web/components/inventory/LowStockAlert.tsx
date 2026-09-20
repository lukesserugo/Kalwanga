'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Package, ShoppingCart, X, Check, Loader2,
  RefreshCw, Bell, Clock, User, Building, Eye, ArrowRight,
  Plus, Minus, Truck, FileText, Printer, Download,
  Filter, Search, ChevronDown, ChevronUp, AlertCircle,
  CheckCircle, TrendingUp, TrendingDown, DollarSign,
  Tag, MapPin, Calendar, Hash, Weight, Percent,
  Globe, Star, Archive, Shield, Lock, Users,
} from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { purchaseOrderService } from '../../services/purchaseOrderService';
import { toast } from '../../utils/toast-manager';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from '../../utils/formatters';
import { PermissionResource } from '../../types/enums';

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
  businessUnit?: { id: string; name: string; code: string };
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

const StatusBadge: React.FC<{
  quantity: number;
  reorderPoint: number;
  isActive?: boolean;
}> = ({ quantity, reorderPoint, isActive = true }) => {
  if (!isActive) {
    return (
      <span className="px-2 py-0.5 rounded-full text-2xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
        Inactive
      </span>
    );
  }

  if (quantity === 0) {
    return (
      <span className="px-2 py-0.5 rounded-full text-2xs font-medium bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-300 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Out of Stock
      </span>
    );
  }
  if (quantity <= reorderPoint) {
    return (
      <span className="px-2 py-0.5 rounded-full text-2xs font-medium bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        Low Stock
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-2xs font-medium bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300 flex items-center gap-1">
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
    blue: 'bg-brand-500',
    green: 'bg-success-500',
    yellow: 'bg-warning-500',
    red: 'bg-danger-500',
    purple: 'bg-secondary-500',
  };

  return (
    <div className="w-full">
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
        <motion.div
          className={`h-full ${
            colorClasses[color as keyof typeof colorClasses] ||
            colorClasses.blue
          } rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      {label && (
        <p className="text-2xs text-gray-500 dark:text-gray-400 mt-1">
          {label}
        </p>
      )}
    </div>
  );
};

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

  const canManage =
    hasPermission(`${PermissionResource.INVENTORY}:manage`) ||
    user?.role === 'SUPER_ADMIN';
  const canCreatePO =
    hasPermission(`${PermissionResource.INVENTORY}:create`) ||
    user?.role === 'SUPER_ADMIN';

  const businessUnitId =
    user?.businessUnits?.[0]?.businessUnitId ||
    (user?.businessUnits?.[0] as any)?.id ||
    localStorage.getItem('businessUnitId') ||
    '';

  const loadLowStockItems = useCallback(async () => {
    if (!businessUnitId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await inventoryService.getLowStockItems(businessUnitId);

      const itemsArray = Array.isArray(data) ? data : [];
      setItems(itemsArray);

      const lowStock = itemsArray.filter(
        (item) => item.quantity > 0 && item.quantity <= (item.reorderPoint || 5)
      ).length;
      const outOfStock = itemsArray.filter(
        (item) => item.quantity === 0
      ).length;
      const totalValue = itemsArray.reduce(
        (sum, item) =>
          sum + (item.quantity || 0) * (item.product?.unitPrice || 0),
        0
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

  const handleSelectAll = () => {
    const filteredItems = getFilteredItems;
    if (
      selectedItems.length === filteredItems.length &&
      filteredItems.length > 0
    ) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map((item) => item.id));
    }
  };

  const handleSelectItem = (id: string) => {
    setSelectedItems((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

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
      const selectedInventoryItems = items.filter((item) =>
        selectedItems.includes(item.id)
      );

      if (onGeneratePO) {
        await onGeneratePO(selectedInventoryItems);
      } else {
        const supplierGroups = new Map<string, InventoryItem[]>();
        selectedInventoryItems.forEach((item) => {
          const supplierId =
            item.supplierId || item.supplier || 'default';
          if (!supplierGroups.has(supplierId)) {
            supplierGroups.set(supplierId, []);
          }
          supplierGroups.get(supplierId)!.push(item);
        });

        const results = [];
        for (const [supplierId, supplierItems] of supplierGroups) {
          try {
            const po = await purchaseOrderService.createPurchaseOrder({
              supplierId: supplierId,
              businessUnitId: businessUnitId,
              items: supplierItems.map((item) => ({
                productId: item.productId || item.id,
                quantity: Math.max(
                  item.reorderQuantity || 10,
                  item.reorderPoint - item.quantity + 10
                ),
                unitPrice:
                  item.product?.costPrice || item.product?.unitPrice || 0,
              })),
              notes: 'Auto-generated from low stock alert',
            });
            results.push(po);
          } catch (err) {
            console.error(
              `Failed to create PO for supplier ${supplierId}:`,
              err
            );
          }
        }

        if (results.length > 0) {
          toast.success(
            `${results.length} purchase order(s) created successfully`
          );
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

  const getFilteredItems = useMemo((): InventoryItem[] => {
    let filtered = items;

    if (filter === 'low') {
      filtered = filtered.filter(
        (item: InventoryItem) =>
          item.quantity > 0 && item.quantity <= (item.reorderPoint || 5)
      );
    } else if (filter === 'out') {
      filtered = filtered.filter(
        (item: InventoryItem) => item.quantity === 0
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item: InventoryItem) =>
          item.product?.name?.toLowerCase().includes(query) ||
          item.product?.sku?.toLowerCase().includes(query) ||
          item.supplier?.toLowerCase().includes(query)
      );
    }

    return filtered
      .sort((a, b) => {
        const aSeverity =
          a.quantity === 0
            ? 0
            : a.quantity <= (a.reorderPoint || 5)
            ? 1
            : 2;
        const bSeverity =
          b.quantity === 0
            ? 0
            : b.quantity <= (b.reorderPoint || 5)
            ? 1
            : 2;
        return aSeverity - bSeverity;
      })
      .slice(0, showAll ? maxItems : Math.min(10, maxItems));
  }, [items, filter, searchQuery, showAll, maxItems]);

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
  }, [
    autoRefresh,
    refreshInterval,
    isAuthenticated,
    businessUnitId,
    loadLowStockItems,
  ]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Please login to view low stock alerts
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center py-12 ${className}`}
      >
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">
          Loading low stock items...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-2xl flex items-start gap-3 ${className}`}
      >
        <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-danger-700 dark:text-danger-300">
            {error}
          </p>
          <button
            onClick={handleRefresh}
            className="mt-2 text-sm text-danger-600 dark:text-danger-400 hover:text-danger-800 dark:hover:text-danger-300 focus-ring rounded"
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
    <div
      className={`card-brand !p-0 overflow-hidden ${className}`}
    >
      <div
        className={`p-4 border-b bg-gradient-to-r from-danger-50 to-brand-50 dark:from-danger-900/20 dark:to-brand-900/20 ${
          compact ? 'p-3' : ''
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-danger-100 dark:bg-danger-900/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-danger-600 dark:text-danger-400" />
            </div>
            <div>
              <h3 className="font-semibold text-danger-700 dark:text-danger-300 text-sm sm:text-base">
                Low Stock Alert
              </h3>
              <p className="text-2xs text-danger-600 dark:text-danger-400 tabular-nums">
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
                className="p-1.5 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors disabled:opacity-50 focus-ring"
              >
                <RefreshCw
                  className={`w-4 h-4 ${
                    refreshing ? 'animate-spin' : ''
                  }`}
                />
              </button>

              {canManage && hasLowStockItems && (
                <>
                  <button
                    onClick={handleSelectAll}
                    className="px-2 py-1 text-2xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors focus-ring"
                  >
                    {selectedItems.length === filteredItems.length &&
                    filteredItems.length > 0
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>

                  {canCreatePO && (
                    <button
                      onClick={handleGeneratePO}
                      disabled={
                        selectedItems.length === 0 || generatingPO
                      }
                      className="px-3 py-1 text-2xs bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg disabled:opacity-50 flex items-center gap-1.5 transition-all focus-ring tabular-nums"
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

        {showFilters && hasLowStockItems && !compact && (
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <div className="flex gap-1">
              <button
                onClick={() => setFilter('all')}
                className={`px-2 py-0.5 text-2xs rounded-lg transition-colors tabular-nums focus-ring ${
                  filter === 'all'
                    ? 'bg-white dark:bg-gray-700 shadow-sm dark:shadow-gray-900'
                    : 'hover:bg-white/50 dark:hover:bg-gray-700/50'
                }`}
              >
                All ({stats.total})
              </button>
              <button
                onClick={() => setFilter('low')}
                className={`px-2 py-0.5 text-2xs rounded-lg transition-colors tabular-nums focus-ring ${
                  filter === 'low'
                    ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300'
                    : 'hover:bg-white/50 dark:hover:bg-gray-700/50'
                }`}
              >
                Low ({stats.lowStock})
              </button>
              <button
                onClick={() => setFilter('out')}
                className={`px-2 py-0.5 text-2xs rounded-lg transition-colors tabular-nums focus-ring ${
                  filter === 'out'
                    ? 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300'
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
                className="w-full pl-7 pr-2 py-1 text-2xs border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 bg-white/80 dark:bg-gray-700/80 dark:text-white focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {compact && hasLowStockItems && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 text-2xs">
          <span className="text-gray-600 dark:text-gray-400 tabular-nums">
            <span className="text-danger-600 dark:text-danger-400 font-medium">
              {stats.outOfStock}
            </span>{' '}
            out of stock ·
            <span className="text-warning-600 dark:text-warning-400 font-medium">
              {' '}
              {stats.lowStock}
            </span>{' '}
            low stock
          </span>
          <span className="text-gray-400 tabular-nums">
            Value: {formatCurrency(stats.totalValue)}
          </span>
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className="p-8 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <Check className="w-12 h-12 text-success-500 dark:text-success-400 mx-auto mb-3" />
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
              All Stock Levels Are Healthy
            </h4>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No items are currently below their reorder point
            </p>
          </motion.div>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[500px] overflow-y-auto custom-scrollbar">
          {filteredItems.map((item, index) => {
            const isSelected = selectedItems.includes(item.id);
            const needed = Math.max(
              0,
              (item.reorderPoint || 5) -
                (item.quantity || 0) +
                (item.reorderQuantity || 10)
            );
            const hasImage =
              (item.product?.images && item.product.images.length > 0) ||
              (item.images && item.images.length > 0);
            const imageUrl =
              item.product?.images?.[0] || item.images?.[0];

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.5) }}
                className={`p-3 hover:bg-orange-50 dark:hover:bg-gray-700/50 transition-colors ${
                  compact ? 'p-2' : ''
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {showActions && canManage && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectItem(item.id)}
                        className="w-4 h-4 text-brand-600 rounded border-gray-300 dark:border-gray-600 focus:ring-brand-500 focus:outline-none flex-shrink-0"
                      />
                    )}

                    <div className="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {hasImage && imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={item.product?.name || 'Product'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              '/images/placeholder-image.png';
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
                      <div className="flex flex-wrap items-center gap-2 text-2xs text-gray-500 dark:text-gray-400">
                        <span className="font-mono tabular-nums">
                          {item.product?.sku || 'N/A'}
                        </span>
                        {item.location && (
                          <>
                            <span className="text-gray-300 dark:text-gray-600">
                              |
                            </span>
                            <span className="flex items-center gap-0.5">
                              <MapPin className="w-3 h-3" />
                              {item.location}
                            </span>
                          </>
                        )}
                        {item.supplier && (
                          <>
                            <span className="text-gray-300 dark:text-gray-600">
                              |
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Building className="w-3 h-3" />
                              {item.supplier}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-2xs text-gray-500 dark:text-gray-400">
                          Stock
                        </p>
                        <p
                          className={`text-sm font-bold tabular-nums ${
                            item.quantity === 0
                              ? 'text-danger-600 dark:text-danger-400'
                              : item.quantity <= (item.reorderPoint || 5)
                              ? 'text-warning-600 dark:text-warning-400'
                              : 'text-success-600 dark:text-success-400'
                          }`}
                        >
                          {item.quantity}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xs text-gray-500 dark:text-gray-400">
                          Reorder
                        </p>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">
                          {item.reorderPoint || 5}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xs text-gray-500 dark:text-gray-400">
                          Needed
                        </p>
                        <p className="text-sm font-medium text-brand-600 dark:text-brand-400 tabular-nums">
                          {needed}
                        </p>
                      </div>
                    </div>

                    <StatusBadge
                      quantity={item.quantity || 0}
                      reorderPoint={item.reorderPoint || 5}
                      isActive={item.isActive}
                    />

                    {showActions && !compact && (
                      <div className="flex gap-1">
                        {canCreatePO &&
                          item.quantity <= (item.reorderPoint || 5) && (
                            <button
                              onClick={() => handleReorderSingle(item.id)}
                              disabled={generatingPO}
                              className="px-2 py-0.5 bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300 rounded-lg hover:bg-warning-200 dark:hover:bg-warning-900/50 text-2xs font-medium disabled:opacity-50 transition-colors focus-ring"
                            >
                              Reorder
                            </button>
                          )}
                        <button
                          onClick={() => {
                            if (onItemSelect) {
                              onItemSelect(item);
                            } else {
                              router.push(
                                `/admin/inventory/${item.id}`
                              );
                            }
                          }}
                          className="p-1 hover:bg-orange-50 dark:hover:bg-gray-600 rounded-lg transition-colors focus-ring"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {!compact && (
                  <div className="mt-2">
                    <ProgressBar
                      value={item.quantity || 0}
                      max={Math.max((item.reorderPoint || 5) * 2, 10)}
                      color={
                        item.quantity === 0
                          ? 'red'
                          : item.quantity <= (item.reorderPoint || 5)
                          ? 'yellow'
                          : 'green'
                      }
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {filteredItems.length > 0 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex flex-wrap items-center justify-between gap-2 text-2xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-3">
            <span className="tabular-nums">
              Showing {filteredItems.length} of {items.length} items
            </span>
            {items.length > 10 &&
              filteredItems.length === 10 &&
              !showAll && (
                <button
                  onClick={() => setShowAll(true)}
                  className="text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium focus-ring rounded"
                >
                  View all ({items.length})
                </button>
              )}
          </div>
          <div className="flex items-center gap-3">
            {selectedItems.length > 0 && (
              <span className="text-brand-600 dark:text-brand-400 tabular-nums">
                {selectedItems.length} selected
              </span>
            )}
            <span className="tabular-nums">
              Updated: {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default LowStockAlert;
