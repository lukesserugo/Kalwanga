// D:\Projects\Kalwanga\packages\web\components\inventory\InventoryWidgets.tsx

'use client';

import React, { useState, useEffect } from 'react';
import {
  Package, TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  DollarSign, Clock, ArrowUp, ArrowDown, RefreshCw,
  BarChart3, PieChart, ShoppingCart, Truck
} from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { toast } from '../../utils/toast-manager';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';

// ============================================
// TYPES - FIXED: Use consistent property names
// ============================================

interface WidgetData {
  totalItems: number;
  totalValue: number;
  lowStock: number;
  outOfStock: number;
  recentActivities: Array<{
    id: string;
    type: string;
    productName: string;
    quantity: number;
    timestamp: string;
  }>;
  // FIX: Use 'name' instead of 'category' to match the interface
  topCategories: Array<{ name: string; count: number; value: number }>;
  stockTrend: { direction: 'up' | 'down' | 'stable'; percentage: number };
}

// ============================================
// MAIN COMPONENT
// ============================================

export function InventoryWidgets() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WidgetData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || '';

  useEffect(() => {
    loadWidgetData();
    const interval = setInterval(loadWidgetData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [businessUnitId]);

  const loadWidgetData = async () => {
    if (!businessUnitId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const summary = await inventoryService.getInventorySummary(businessUnitId);
      const lowStockItems = await inventoryService.getLowStockItems(businessUnitId);
      
      // FIX: Map 'category' to 'name' to match the interface
      const topCategories = (summary.categories || []).map((cat: any) => ({
        name: cat.category || cat.name || 'Uncategorized',
        count: cat.count || 0,
        value: cat.value || 0,
      }));
      
      setData({
        totalItems: summary.totalItems || 0,
        totalValue: summary.totalValue || 0,
        lowStock: summary.lowStockItems || 0,
        outOfStock: summary.outOfStockItems || 0,
        recentActivities: [],
        topCategories: topCategories,
        stockTrend: { direction: 'stable', percentage: 0 },
      });
    } catch (error) {
      console.error('Failed to load widget data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadWidgetData();
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow border border-gray-200 p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No inventory data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">{data.totalItems}</p>
              <p className="text-xs text-gray-400 mt-1">Across all locations</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Package className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Value</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(data.totalValue)}</p>
              <p className="text-xs text-gray-400 mt-1">
                {data.stockTrend.direction === 'up' && <ArrowUp className="inline w-3 h-3 text-green-500" />}
                {data.stockTrend.direction === 'down' && <ArrowDown className="inline w-3 h-3 text-red-500" />}
                {data.stockTrend.direction === 'stable' && 'Stable'}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Low Stock</p>
              <p className="text-2xl font-bold text-yellow-600">{data.lowStock}</p>
              <p className="text-xs text-gray-400 mt-1">Need reordering</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600">{data.outOfStock}</p>
              <p className="text-xs text-gray-400 mt-1">Urgent attention needed</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-red-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Category Distribution</h3>
        {data.topCategories.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">No data available</p>
        ) : (
          <div className="space-y-3">
            {data.topCategories.map((category, index) => (
              <div key={index}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">{category.name}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{category.count} items</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${(category.count / Math.max(...data.topCategories.map(c => c.count), 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => window.location.href = '/admin/inventory/transfer'}
          className="bg-white rounded-lg shadow border border-gray-200 p-4 hover:shadow-md transition-shadow text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Truck className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Transfer Stock</p>
              <p className="text-sm text-gray-500">Move items between locations</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => window.location.href = '/admin/inventory/import'}
          className="bg-white rounded-lg shadow border border-gray-200 p-4 hover:shadow-md transition-shadow text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <Package className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Bulk Import</p>
              <p className="text-sm text-gray-500">Import items from CSV/Excel</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => window.location.href = '/admin/inventory/reports'}
          className="bg-white rounded-lg shadow border border-gray-200 p-4 hover:shadow-md transition-shadow text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <BarChart3 className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="font-medium text-gray-900">View Reports</p>
              <p className="text-sm text-gray-500">Analyze inventory performance</p>
            </div>
          </div>
        </button>
      </div>

      {/* Low Stock Preview */}
      {data.lowStock > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b bg-yellow-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span className="font-medium text-yellow-700">Low Stock Alert</span>
              <span className="text-sm text-yellow-600">{data.lowStock} items need attention</span>
            </div>
            <button
              onClick={() => window.location.href = '/admin/inventory/low-stock'}
              className="text-sm text-yellow-700 hover:text-yellow-900"
            >
              View All →
            </button>
          </div>
          <div className="p-4 text-center text-gray-500 text-sm">
            {data.lowStock > 0 ? `${data.lowStock} items are below reorder point` : 'All stock levels are healthy'}
          </div>
        </div>
      )}

      {/* Last Updated */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Last updated: {new Date().toLocaleTimeString()}</span>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 hover:text-gray-600 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}
