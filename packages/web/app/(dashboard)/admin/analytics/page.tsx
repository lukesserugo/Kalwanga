// src/app/(dashboard)/analytics/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../services/api';
import { toast } from '../../../../utils/toast-manager';
import { formatCurrency } from '../../../../utils/formatters';

interface SalesTrend {
  date: string;
  total: number;
}

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

interface CustomerInsight {
  totalCustomers: number;
  totalRevenue: number;
  avgSpend: number;
  segments: { highValue: number; mediumValue: number; lowValue: number };
  topCustomers: Array<{ name: string; email: string; totalSpent: number }>;
}

interface InventoryAnalytics {
  totalValue: number;
  totalItems: number;
  lowStock: number;
  outOfStock: number;
  turnoverRate: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export default function AnalyticsPage() {
  const [salesTrends, setSalesTrends] = useState<SalesTrend[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [customerInsights, setCustomerInsights] = useState<CustomerInsight | null>(null);
  const [inventoryAnalytics, setInventoryAnalytics] = useState<InventoryAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      
      // Make API calls with proper typing
      const [trendsRes, productsRes, customersRes, inventoryRes] = await Promise.all([
        api.get<ApiResponse<SalesTrend[]>>('/analytics/sales-trends', { params: { days } }),
        api.get<ApiResponse<TopProduct[]>>('/analytics/top-products', { params: { limit: 10, days } }),
        api.get<ApiResponse<CustomerInsight>>('/analytics/customer-insights'),
        api.get<ApiResponse<InventoryAnalytics>>('/analytics/inventory-analytics'),
      ]);

      setSalesTrends(trendsRes?.data || []);
      setTopProducts(productsRes?.data || []);
      setCustomerInsights(customersRes?.data || null);
      setInventoryAnalytics(inventoryRes?.data || null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full"></div>
      </div>
    );
  }

  const maxSales = Math.max(...salesTrends.map(s => s.total), 1);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 text-sm">View your business performance metrics</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
          <option value={90}>Last 90 Days</option>
          <option value={365}>Last Year</option>
        </select>
      </div>

      {/* Sales Trend Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Sales Trend</h2>
          <span className="text-sm text-gray-500">
            {salesTrends.length} days
          </span>
        </div>
        {salesTrends.length > 0 ? (
          <div className="flex items-end gap-1 h-64">
            {salesTrends.map((trend) => (
              <div key={trend.date} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                  style={{ height: `${(trend.total / maxSales) * 100}%`, minHeight: '4px' }}
                  title={`${trend.date}: ${formatCurrency(trend.total)}`}
                />
                <span className="text-xs text-gray-400 rotate-45 origin-left">{trend.date.slice(5)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>No sales data available for the selected period</p>
          </div>
        )}
        <div className="flex justify-between mt-4 text-sm text-gray-500">
          <span>Total: {formatCurrency(salesTrends.reduce((sum, s) => sum + s.total, 0))}</span>
          <span>Avg: {formatCurrency(salesTrends.reduce((sum, s) => sum + s.total, 0) / (salesTrends.length || 1))}</span>
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Products</h2>
        {topProducts.length > 0 ? (
          <div className="space-y-3">
            {topProducts.map((product, index) => (
              <div key={product.name} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  index === 0 ? 'bg-yellow-100 text-yellow-700' :
                  index === 1 ? 'bg-gray-100 text-gray-700' :
                  index === 2 ? 'bg-orange-100 text-orange-700' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{product.name}</p>
                  <p className="text-sm text-gray-500">{product.quantity} units sold</p>
                </div>
                <p className="font-bold text-gray-900">{formatCurrency(product.revenue)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No product sales data available</p>
          </div>
        )}
      </div>

      {/* Customer Insights */}
      {customerInsights && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Insights</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">{customerInsights.totalCustomers}</p>
              <p className="text-sm text-gray-500">Total Customers</p>
            </div>
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(customerInsights.totalRevenue)}</p>
              <p className="text-sm text-gray-500">Total Revenue</p>
            </div>
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(customerInsights.avgSpend)}</p>
              <p className="text-sm text-gray-500">Avg Spend</p>
            </div>
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-green-600">{customerInsights.segments.highValue}</p>
              <p className="text-sm text-gray-500">High Value</p>
            </div>
          </div>
          {customerInsights.topCustomers && customerInsights.topCustomers.length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Top Customers</h3>
              <div className="space-y-2">
                {customerInsights.topCustomers.slice(0, 5).map((customer, index) => (
                  <div key={customer.email} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-900">{customer.name}</span>
                      <span className="text-gray-500 ml-2">{customer.email}</span>
                    </div>
                    <span className="font-medium text-gray-900">{formatCurrency(customer.totalSpent)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inventory Analytics */}
      {inventoryAnalytics && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Inventory Analytics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(inventoryAnalytics.totalValue)}</p>
              <p className="text-sm text-gray-500">Total Value</p>
            </div>
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">{inventoryAnalytics.totalItems}</p>
              <p className="text-sm text-gray-500">Total Items</p>
            </div>
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-yellow-600">{inventoryAnalytics.lowStock}</p>
              <p className="text-sm text-gray-500">Low Stock</p>
            </div>
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-red-600">{inventoryAnalytics.outOfStock}</p>
              <p className="text-sm text-gray-500">Out of Stock</p>
            </div>
          </div>
          {inventoryAnalytics.turnoverRate > 0 && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Inventory Turnover Rate</span>
                <span className="font-bold text-gray-900">{inventoryAnalytics.turnoverRate.toFixed(2)}x</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(inventoryAnalytics.turnoverRate / 10 * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
