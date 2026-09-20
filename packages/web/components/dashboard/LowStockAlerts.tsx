'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Package,
  ShoppingCart,
  X,
  Check,
  Loader2,
  RefreshCw,
  Bell,
  Clock,
  User,
  Building,
  Eye,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Mail,
  Phone,
  Truck,
} from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { productService } from '../../services/productService';
import { purchaseOrderService } from '../../services/purchaseOrderService';
import { toast } from '../../utils/toast-manager';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface LowStockItem {
  id: string;
  productId: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    images?: string[];
    unitPrice: number;
    costPrice?: number;
    category?: { name: string };
  };
  variantId?: string;
  businessUnitId: string;
  quantity: number;
  reserved: number;
  reorderPoint: number;
  reorderQuantity: number;
  location?: string;
  supplier?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function LowStockAlerts() {
  const { user, canManageInventory } = useAuth();
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [generatingPO, setGeneratingPO] = useState(false);
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LowStockItem | null>(null);
  const [restockData, setRestockData] = useState({
    quantity: 1,
    supplier: '',
    unitPrice: 0,
    purchaseDate: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState(20);
  const [autoReorder, setAutoReorder] = useState(false);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || '';

  useEffect(() => {
    loadLowStockItems();
    const interval = setInterval(loadLowStockItems, 60000);
    return () => clearInterval(interval);
  }, [businessUnitId]);

  const loadLowStockItems = async () => {
    if (!businessUnitId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await inventoryService.getLowStockItems(businessUnitId);
      setItems(data || []);
    } catch (error) {
      console.error('Failed to load low stock items:', error);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLowStockItems();
    toast.success('Inventory refreshed');
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

    setGeneratingPO(true);
    try {
      const firstItem = items.find((item) => item.id === selectedItems[0]);
      const supplierId = firstItem?.supplier || 'default';

      await purchaseOrderService.createPurchaseOrder({
        supplierId: supplierId,
        businessUnitId: businessUnitId,
        items: selectedItems.map((id) => {
          const item = items.find((i) => i.id === id);
          return {
            productId: item?.productId || '',
            quantity: item?.reorderQuantity || 10,
            unitPrice:
              item?.product?.costPrice || item?.product?.unitPrice || 0,
          };
        }),
        notes: 'Auto-generated from low stock alert',
      });

      toast.success('Purchase order created successfully');
      setSelectedItems([]);
      loadLowStockItems();
    } catch (error) {
      toast.error('Failed to generate purchase order');
    } finally {
      setGeneratingPO(false);
    }
  };

  const handleSelectAll = () => {
    const filteredItems = getFilteredItems();
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map((item) => item.id));
    }
  };

  const handleRestock = async () => {
    if (!selectedItem) return;
    setSubmitting(true);
    try {
      await inventoryService.restockItem(selectedItem.id, {
        quantity: restockData.quantity,
        supplier: restockData.supplier || undefined,
        unitPrice: restockData.unitPrice || undefined,
        purchaseDate: restockData.purchaseDate || undefined,
      });
      toast.success('Item restocked successfully');
      setShowRestockModal(false);
      setSelectedItem(null);
      loadLowStockItems();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to restock item');
    } finally {
      setSubmitting(false);
    }
  };

  const getFilteredItems = () => {
    let filtered = items;
    if (filter === 'low') {
      filtered = filtered.filter(
        (item) => item.quantity > 0 && item.quantity <= item.reorderPoint,
      );
    } else if (filter === 'out') {
      filtered = filtered.filter((item) => item.quantity === 0);
    }
    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.product?.name
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          item.product?.sku?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }
    return filtered;
  };

  const getStatusBadge = (item: LowStockItem) => {
    if (item.quantity === 0) {
      return {
        label: 'Out of Stock',
        color:
          'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-300',
      };
    }
    if (item.quantity <= item.reorderPoint) {
      return {
        label: 'Low Stock',
        color:
          'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300',
      };
    }
    return {
      label: 'In Stock',
      color:
        'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300',
    };
  };

  const filteredItems = getFilteredItems();
  const urgentCount = items.filter((i) => i.quantity === 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="card-brand !p-0 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-danger-50 to-brand-50 dark:from-danger-900/20 dark:to-brand-900/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-danger-100 dark:bg-danger-900/30 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-danger-600 dark:text-danger-400" />
            </div>
            <div>
              <h3 className="font-semibold text-danger-700 dark:text-danger-300">
                Low Stock Alerts
              </h3>
              <p className="text-sm text-danger-600 dark:text-danger-400 tabular-nums">
                {items.filter((i) => i.quantity <= i.reorderPoint).length} items
                need attention
                {urgentCount > 0 && ` • ${urgentCount} out of stock`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-lg transition-colors focus-ring disabled:opacity-50"
              aria-label="Refresh inventory"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>
            {canManageInventory && (
              <>
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors focus-ring"
                >
                  {selectedItems.length === filteredItems.length
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
                <button
                  onClick={handleGeneratePO}
                  disabled={selectedItems.length === 0 || generatingPO}
                  className="px-4 py-1.5 text-sm bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg disabled:opacity-50 flex items-center gap-2 transition-all focus-ring tabular-nums"
                >
                  {generatingPO ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="w-4 h-4" />
                  )}
                  Generate PO ({selectedItems.length})
                </button>
              </>
            )}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-lg transition-colors focus-ring"
              aria-label="Alert settings"
            >
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Settings */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"
            >
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">
                    Alert Threshold:
                  </label>
                  <input
                    type="number"
                    value={alertThreshold}
                    onChange={(e) =>
                      setAlertThreshold(parseInt(e.target.value) || 20)
                    }
                    className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums focus-ring"
                    min="0"
                    max="100"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={autoReorder}
                    onChange={(e) => setAutoReorder(e.target.checked)}
                    className="w-4 h-4 text-brand-600 rounded focus-ring"
                  />
                  Auto-Reorder
                </label>
                <button
                  onClick={() => {
                    toast.success('Alert settings saved');
                    setShowSettings(false);
                  }}
                  className="px-3 py-1 text-sm bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all focus-ring"
                >
                  Save Settings
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <div className="flex gap-1 bg-white/50 dark:bg-white/5 rounded-lg p-0.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors focus-ring tabular-nums ${
                filter === 'all'
                  ? 'bg-white dark:bg-gray-700 shadow-sm'
                  : 'hover:bg-white/50'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setFilter('low')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors focus-ring tabular-nums ${
                filter === 'low'
                  ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300'
                  : 'hover:bg-white/50'
              }`}
            >
              Low (
              {
                items.filter(
                  (i) => i.quantity > 0 && i.quantity <= i.reorderPoint,
                ).length
              }
              )
            </button>
            <button
              onClick={() => setFilter('out')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors focus-ring tabular-nums ${
                filter === 'out'
                  ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
                  : 'hover:bg-white/50'
              }`}
            >
              Out ({items.filter((i) => i.quantity === 0).length})
            </button>
          </div>
          <div className="flex-1 min-w-[150px]">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white/80 dark:bg-gray-700/50 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:outline-none transition-shadow"
            />
          </div>
        </div>
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="p-8 text-center">
          <Check className="w-12 h-12 text-success-500 mx-auto mb-3" />
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
            All Stock Levels Are Healthy
          </h4>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No items are currently below their reorder point
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[500px] overflow-y-auto custom-scrollbar">
          {filteredItems.map((item) => {
            const status = getStatusBadge(item);
            const isSelected = selectedItems.includes(item.id);
            const needed = Math.max(
              0,
              item.reorderPoint - item.quantity + (item.reorderQuantity || 10),
            );

            return (
              <div
                key={item.id}
                className="p-4 hover:bg-orange-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedItems([...selectedItems, item.id]);
                        } else {
                          setSelectedItems(
                            selectedItems.filter((id) => id !== item.id),
                          );
                        }
                      }}
                      className="w-4 h-4 text-brand-600 rounded focus-ring"
                    />
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      {item.product?.images?.[0] ? (
                        <img
                          src={item.product.images[0]}
                          alt={item.product.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <Package className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {item.product?.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-2xs text-gray-500 dark:text-gray-400">
                        <span className="font-mono">
                          SKU: {item.product?.sku}
                        </span>
                        <span className="text-gray-300 dark:text-gray-600">
                          |
                        </span>
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3" />
                          {item.location || 'Warehouse'}
                        </span>
                        {item.product?.category && (
                          <>
                            <span className="text-gray-300 dark:text-gray-600">
                              |
                            </span>
                            <span>{item.product.category.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="text-center">
                      <p className="text-2xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Stock
                      </p>
                      <p
                        className={`text-lg font-bold tabular-nums ${
                          item.quantity === 0
                            ? 'text-danger-600 dark:text-danger-400'
                            : item.quantity <= item.reorderPoint
                            ? 'text-warning-600 dark:text-warning-400'
                            : 'text-success-600 dark:text-success-400'
                        }`}
                      >
                        {item.quantity}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Reorder Point
                      </p>
                      <p className="text-lg font-medium tabular-nums text-gray-900 dark:text-white">
                        {item.reorderPoint}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Needed
                      </p>
                      <p className="text-lg font-medium text-brand-600 dark:text-brand-400 tabular-nums">
                        {needed}
                      </p>
                    </div>
                    <div>
                      <span
                        className={`px-2 py-1 rounded-full text-2xs font-medium ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    {canManageInventory && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setRestockData({
                              quantity: needed,
                              supplier: item.supplier || '',
                              unitPrice:
                                item.product?.costPrice ||
                                item.product?.unitPrice ||
                                0,
                              purchaseDate: '',
                            });
                            setShowRestockModal(true);
                          }}
                          className="px-3 py-1 bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300 rounded-lg text-xs font-medium hover:bg-warning-200 dark:hover:bg-warning-900/50 transition-colors focus-ring"
                        >
                          Restock
                        </button>
                        <button
                          onClick={() =>
                            (window.location.href = `/inventory/${item.id}`)
                          }
                          className="p-1 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {/* Progress Bar */}
                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      item.quantity === 0
                        ? 'bg-danger-500'
                        : item.quantity <= item.reorderPoint
                        ? 'bg-warning-500'
                        : 'bg-success-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        (item.quantity / (item.reorderPoint * 2)) * 100,
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {filteredItems.length > 0 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex items-center justify-between text-2xs text-gray-500 dark:text-gray-400">
          <span className="tabular-nums">
            Showing {filteredItems.length} of {items.length} items
          </span>
          <span className="tabular-nums">
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Restock Modal */}
      {showRestockModal && selectedItem && (
        <div className="fixed inset-0 z-modal flex items-center justify-center animate-fade-in">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowRestockModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-card-hover max-w-md w-full p-6 animate-slide-up">
            <button
              onClick={() => setShowRestockModal(false)}
              className="absolute top-4 right-4 p-1 hover:bg-orange-50 dark:hover:bg-gray-700 rounded focus-ring"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Restock Item
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Current stock:{' '}
              <span className="font-medium tabular-nums">
                {selectedItem.quantity}
              </span>
              <br />
              Reorder point:{' '}
              <span className="font-medium tabular-nums">
                {selectedItem.reorderPoint}
              </span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  value={restockData.quantity}
                  onChange={(e) =>
                    setRestockData({
                      ...restockData,
                      quantity: parseInt(e.target.value) || 1,
                    })
                  }
                  min="1"
                  className="input-brand tabular-nums"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Supplier
                </label>
                <input
                  type="text"
                  value={restockData.supplier}
                  onChange={(e) =>
                    setRestockData({
                      ...restockData,
                      supplier: e.target.value,
                    })
                  }
                  className="input-brand"
                  placeholder="Supplier name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Unit Price
                </label>
                <input
                  type="number"
                  value={restockData.unitPrice}
                  onChange={(e) =>
                    setRestockData({
                      ...restockData,
                      unitPrice: parseFloat(e.target.value) || 0,
                    })
                  }
                  min="0"
                  step="0.01"
                  className="input-brand tabular-nums"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Purchase Date
                </label>
                <input
                  type="date"
                  value={restockData.purchaseDate}
                  onChange={(e) =>
                    setRestockData({
                      ...restockData,
                      purchaseDate: e.target.value,
                    })
                  }
                  className="input-brand"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowRestockModal(false)}
                className="btn-secondary focus-ring"
              >
                Cancel
              </button>
              <button
                onClick={handleRestock}
                disabled={submitting || restockData.quantity <= 0}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium text-white shadow-soft transition-all duration-200 bg-success-600 hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
              >
                {submitting ? 'Restocking...' : 'Restock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LowStockAlerts;
