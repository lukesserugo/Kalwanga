// D:\Projects\Kalwanga\packages\web\components\inventory\LowStockAlert.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, Package, ShoppingCart, X, Check, Loader2,
  RefreshCw, Bell, Clock, User, Building, Eye, ArrowRight
} from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { purchaseOrderService } from '../../services/purchaseOrderService';
import { toast } from '../../utils/toast-manager';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface Inventory {
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
  shelfNumber?: string;
  supplier?: string;
  notes?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function LowStockAlert() {
  const { user } = useAuth();
  const [items, setItems] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [generatingPO, setGeneratingPO] = useState(false);
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || '';

  useEffect(() => {
    loadLowStockItems();
    const interval = setInterval(loadLowStockItems, 60000); // Refresh every minute
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

      const po = await purchaseOrderService.createPurchaseOrder({
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
      
      toast.success(`Purchase order ${po.orderNumber} created successfully`);
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

  const handleReorderSingle = async (itemId: string) => {
    setSelectedItems([itemId]);
    await handleGeneratePO();
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
        item.product?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.product?.sku.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  };

  const getStatusBadge = (item: Inventory) => {
    if (item.quantity === 0) {
      return { label: 'Out of Stock', color: 'bg-red-100 text-red-800', icon: '🔴' };
    }
    if (item.quantity <= item.reorderPoint) {
      return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800', icon: '🟡' };
    }
    return { label: 'In Stock', color: 'bg-green-100 text-green-800', icon: '🟢' };
  };

  const filteredItems = getFilteredItems();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-red-50 to-orange-50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-red-700">Low Stock Alert</h3>
              <p className="text-sm text-red-600">
                {items.filter(i => i.quantity <= i.reorderPoint).length} items need attention
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleSelectAll}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-white transition-colors"
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
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <div className="flex gap-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                filter === 'all' ? 'bg-white shadow-sm' : 'hover:bg-white/50'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setFilter('low')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                filter === 'low' ? 'bg-yellow-100 text-yellow-700' : 'hover:bg-white/50'
              }`}
            >
              Low Stock ({items.filter(i => i.quantity > 0 && i.quantity <= i.reorderPoint).length})
            </button>
            <button
              onClick={() => setFilter('out')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                filter === 'out' ? 'bg-red-100 text-red-700' : 'hover:bg-white/50'
              }`}
            >
              Out of Stock ({items.filter(i => i.quantity === 0).length})
            </button>
          </div>
          <div className="flex-1 min-w-[150px]">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white/80"
            />
          </div>
        </div>
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="p-8 text-center">
          <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h4 className="text-lg font-semibold text-gray-900">All Stock Levels Are Healthy</h4>
          <p className="text-gray-500 text-sm">No items are currently below their reorder point</p>
        </div>
      ) : (
        <div className="divide-y max-h-[500px] overflow-y-auto">
          {filteredItems.map((item) => {
            const status = getStatusBadge(item);
            const isSelected = selectedItems.includes(item.id);
            const needed = Math.max(0, item.reorderPoint - item.quantity + (item.reorderQuantity || 10));

            return (
              <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
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
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      {item.product?.images?.[0] ? (
                        <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Package className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{item.product?.name}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span>SKU: {item.product?.sku}</span>
                        <span className="text-gray-300">|</span>
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3" />
                          {item.location || 'Warehouse'}
                        </span>
                        {item.product?.category && (
                          <>
                            <span className="text-gray-300">|</span>
                            <span>{item.product.category.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Stock</p>
                      <p className={`text-lg font-bold ${
                        item.quantity === 0 ? 'text-red-600' :
                        item.quantity <= item.reorderPoint ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {item.quantity}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Reorder Point</p>
                      <p className="text-lg font-medium">{item.reorderPoint}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Needed</p>
                      <p className="text-lg font-medium text-blue-600">{needed}</p>
                    </div>
                    <div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.icon} {status.label}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleReorderSingle(item.id)}
                        disabled={generatingPO}
                        className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 text-xs font-medium disabled:opacity-50 transition-colors"
                      >
                        Reorder
                      </button>
                      <button
                        onClick={() => {
                          // Navigate to product detail
                          window.location.href = `/inventory/${item.id}`;
                        }}
                        className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </div>
                </div>
                {/* Progress Bar */}
                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
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
        <div className="p-3 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <span>Showing {filteredItems.length} of {items.length} items</span>
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
}
