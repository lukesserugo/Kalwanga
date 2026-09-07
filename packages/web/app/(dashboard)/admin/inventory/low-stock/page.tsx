// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\low-stock\page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Package, RefreshCw, ShoppingCart,
  Search, Filter, Download, Eye, Edit, Trash2,
  ChevronLeft, ChevronRight, X, Check, Loader2,
  Building, User, Calendar, ArrowRight, AlertCircle,
  Lock
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { inventoryService } from '../../../../../services/inventoryService';
import { purchaseOrderService } from '../../../../../services/purchaseOrderService';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency, formatDate } from '../../../../../utils/formatters';

export default function LowStockPage() {
  const router = useRouter();
  const { user, canViewInventory, canManageInventory } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [generatingPO, setGeneratingPO] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [restockData, setRestockData] = useState({
    quantity: 1,
    supplier: '',
    unitPrice: 0,
    purchaseDate: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || '';

  // Check permission
  if (!canViewInventory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view low stock items.
        </p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  useEffect(() => {
    loadLowStockItems();
  }, [businessUnitId]);

  const loadLowStockItems = async () => {
    try {
      setLoading(true);
      const data = await inventoryService.getLowStockItems(businessUnitId);
      setItems(data || []);
      setFilteredItems(data || []);
    } catch (error) {
      console.error('Failed to load low stock items:', error);
      toast.error('Failed to load low stock items');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLowStockItems();
    toast.success('Refreshed');
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const filtered = items.filter(item =>
      item.product?.name?.toLowerCase().includes(query.toLowerCase()) ||
      item.product?.sku?.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredItems(filtered);
  };

  const handleFilterChange = (type: 'all' | 'low' | 'out') => {
    setFilter(type);
    let filtered = items;
    if (type === 'low') {
      filtered = items.filter(item => item.quantity > 0 && item.quantity <= item.reorderPoint);
    } else if (type === 'out') {
      filtered = items.filter(item => item.quantity === 0);
    }
    setFilteredItems(filtered);
  };

  const handleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map(item => item.id));
    }
  };

  const handleSelectItem = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleGeneratePO = async () => {
    if (selectedItems.length === 0) {
      toast.warning('Please select items to reorder');
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

  const getStatusBadge = (item: any) => {
    if (item.quantity === 0) {
      return { label: 'Out of Stock', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' };
    }
    if (item.quantity <= item.reorderPoint) {
      return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' };
    }
    return { label: 'In Stock', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
            Low Stock Items
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {items.filter(i => i.quantity <= i.reorderPoint).length} items need attention
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleGeneratePO}
            disabled={selectedItems.length === 0 || generatingPO}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generatingPO ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShoppingCart className="w-4 h-4" />
            )}
            Generate PO ({selectedItems.length})
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Items</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{items.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Low Stock</p>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {items.filter(i => i.quantity > 0 && i.quantity <= i.reorderPoint).length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Out of Stock</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {items.filter(i => i.quantity === 0).length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            <button
              onClick={() => handleFilterChange('all')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => handleFilterChange('low')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'low'
                  ? 'bg-white dark:bg-gray-600 text-yellow-600 dark:text-yellow-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              }`}
            >
              Low ({items.filter(i => i.quantity > 0 && i.quantity <= i.reorderPoint).length})
            </button>
            <button
              onClick={() => handleFilterChange('out')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'out'
                  ? 'bg-white dark:bg-gray-600 text-red-600 dark:text-red-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              }`}
            >
              Out ({items.filter(i => i.quantity === 0).length})
            </button>
          </div>
        </div>
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
          <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">All Stock Levels Are Healthy</h3>
          <p className="text-gray-500 dark:text-gray-400">No items are currently below their reorder point</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Reorder Point
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Needed
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredItems.map((item) => {
                  const status = getStatusBadge(item);
                  const isSelected = selectedItems.includes(item.id);
                  const needed = Math.max(0, item.reorderPoint - item.quantity + (item.reorderQuantity || 10));

                  return (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                        isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectItem(item.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                            <Package className="w-4 h-4 text-gray-400" />
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {item.product?.name || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {item.product?.sku || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                        {item.reorderPoint}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-blue-600 dark:text-blue-400">
                        {needed}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
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
                            onClick={() => router.push(`/admin/inventory/${item.id}`)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                            aria-label="View item details"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {showRestockModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowRestockModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <button
              onClick={() => setShowRestockModal(false)}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowRestockModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRestock}
                disabled={submitting || restockData.quantity <= 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                ) : null}
                {submitting ? 'Restocking...' : 'Restock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
