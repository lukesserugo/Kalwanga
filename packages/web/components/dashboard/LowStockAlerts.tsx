// D:\Projects\Kalwanga\packages\web\components\dashboard\LowStockAlerts.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Package, ShoppingCart, X, Check, Loader2,
  RefreshCw, Bell, Clock, User, Building, Eye, ArrowRight,
  TrendingUp, TrendingDown, Mail, Phone, Truck
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
      const firstItem = items.find(item => item.id === selectedItems[0]);
      const supplierId = firstItem?.supplier || 'default';

      await purchaseOrderService.createPurchaseOrder({
        supplierId: supplierId,
        businessUnitId: businessUnitId,
        items: selectedItems.map(id => {
          const item = items.find(i => i.id === id);
          return {
            productId: item?.productId || '',
            quantity: item?.reorderQuantity || 10,
            unitPrice: item?.product?.costPrice || item?.product?.unitPrice || 0,
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
      setSelectedItems(filteredItems.map(item => item.id));
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
      filtered = filtered.filter(item => item.quantity > 0 && item.quantity <= item.reorderPoint);
    } else if (filter === 'out') {
      filtered = filtered.filter(item => item.quantity === 0);
    }
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.product?.sku?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  };

  const getStatusBadge = (item: LowStockItem) => {
    if (item.quantity === 0) {
      return { label: 'Out of Stock', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' };
    }
    if (item.quantity <= item.reorderPoint) {
      return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' };
    }
    return { label: 'In Stock', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' };
  };

  const filteredItems = getFilteredItems();
  const urgentCount = items.filter(i => i.quantity === 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-red-700 dark:text-red-300">Low Stock Alerts</h3>
              <p className="text-sm text-red-600 dark:text-red-400">
                {items.filter(i => i.quantity <= i.reorderPoint).length} items need attention
                {urgentCount > 0 && ` • ${urgentCount} out of stock`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            {canManageInventory && (
              <>
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors"
                >
                  {selectedItems.length === filteredItems.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  onClick={handleGeneratePO}
                  disabled={selectedItems.length === 0 || generatingPO}
                  className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
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
              className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-lg transition-colors"
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
                  <label className="text-sm text-gray-600 dark:text-gray-400">Alert Threshold:</label>
                  <input
                    type="number"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(parseInt(e.target.value) || 20)}
                    className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
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
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  Auto-Reorder
                </label>
                <button
                  onClick={() => {
                    toast.success('Alert settings saved');
                    setShowSettings(false);
                  }}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                filter === 'all' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'hover:bg-white/50'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setFilter('low')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                filter === 'low' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' : 'hover:bg-white/50'
              }`}
            >
              Low ({items.filter(i => i.quantity > 0 && i.quantity <= i.reorderPoint).length})
            </button>
            <button
              onClick={() => setFilter('out')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                filter === 'out' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'hover:bg-white/50'
              }`}
            >
              Out ({items.filter(i => i.quantity === 0).length})
            </button>
          </div>
          <div className="flex-1 min-w-[150px]">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white/80 dark:bg-gray-700/50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="p-8 text-center">
          <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">All Stock Levels Are Healthy</h4>
          <p className="text-gray-500 dark:text-gray-400 text-sm">No items are currently below their reorder point</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[500px] overflow-y-auto">
          {filteredItems.map((item) => {
            const status = getStatusBadge(item);
            const isSelected = selectedItems.includes(item.id);
            const needed = Math.max(0, item.reorderPoint - item.quantity + (item.reorderQuantity || 10));

            return (
              <div key={item.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedItems([...selectedItems, item.id]);
                        } else {
                          setSelectedItems(selectedItems.filter(id => id !== item.id));
                        }
                      }}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      {item.product?.images?.[0] ? (
                        <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Package className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{item.product?.name}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>SKU: {item.product?.sku}</span>
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3" />
                          {item.location || 'Warehouse'}
                        </span>
                        {item.product?.category && (
                          <>
                            <span className="text-gray-300 dark:text-gray-600">|</span>
                            <span>{item.product.category.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Stock</p>
                      <p className={`text-lg font-bold ${
                        item.quantity === 0 ? 'text-red-600 dark:text-red-400' :
                        item.quantity <= item.reorderPoint ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-green-600 dark:text-green-400'
                      }`}>
                        {item.quantity}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Reorder Point</p>
                      <p className="text-lg font-medium">{item.reorderPoint}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Needed</p>
                      <p className="text-lg font-medium text-blue-600 dark:text-blue-400">{needed}</p>
                    </div>
                    <div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
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
                              unitPrice: item.product?.costPrice || item.product?.unitPrice || 0,
                              purchaseDate: '',
                            });
                            setShowRestockModal(true);
                          }}
                          className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-lg text-xs font-medium hover:bg-yellow-200 transition-colors"
                        >
                          Restock
                        </button>
                        <button
                          onClick={() => window.location.href = `/inventory/${item.id}`}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
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
                      item.quantity === 0 ? 'bg-red-500' :
                      item.quantity <= item.reorderPoint ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min((item.quantity / (item.reorderPoint * 2)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {filteredItems.length > 0 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Showing {filteredItems.length} of {items.length} items</span>
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      )}

      {/* Restock Modal */}
      {showRestockModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowRestockModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <button
              onClick={() => setShowRestockModal(false)}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Restock Item</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Current stock: <span className="font-medium">{selectedItem.quantity}</span>
              <br />
              Reorder point: <span className="font-medium">{selectedItem.reorderPoint}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  value={restockData.quantity}
                  onChange={(e) => setRestockData({ ...restockData, quantity: parseInt(e.target.value) || 1 })}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Supplier
                </label>
                <input
                  type="text"
                  value={restockData.supplier}
                  onChange={(e) => setRestockData({ ...restockData, supplier: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
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
                  onChange={(e) => setRestockData({ ...restockData, unitPrice: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
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
                  onChange={(e) => setRestockData({ ...restockData, purchaseDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowRestockModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleRestock}
                disabled={submitting || restockData.quantity <= 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
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
