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
  const [customerInsights, setCustomerInsights] =
    useState<CustomerInsight | null>(null);
  const [inventoryAnalytics, setInventoryAnalytics] =
    useState<InventoryAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);

      // Make API calls with proper typing
      const [trendsRes, productsRes, customersRes, inventoryRes] =
        await Promise.all([
          api.get<ApiResponse<SalesTrend[]>>('/analytics/sales-trends', {
            params: { days },
          }),
          api.get<ApiResponse<TopProduct[]>>('/analytics/top-products', {
            params: { limit: 10, days },
          }),
          api.get<ApiResponse<CustomerInsight>>('/analytics/customer-insights'),
          api.get<ApiResponse<InventoryAnalytics>>(
            '/analytics/inventory-analytics'
          ),
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
        <div className="animate-spin h-8 w-8 border-b-2 border-brand-500 rounded-full" />
      </div>
    );
  }

  const maxSales = Math.max(...salesTrends.map((s) => s.total), 1);

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Analytics
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            View your business performance metrics
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:outline-none transition-shadow focus-ring"
        >
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
          <option value={90}>Last 90 Days</option>
          <option value={365}>Last Year</option>
        </select>
      </div>

      {/* Sales Trend Chart */}
      <div className="card-brand mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Sales Trend
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            {salesTrends.length} days
          </span>
        </div>
        {salesTrends.length > 0 ? (
          <div className="flex items-end gap-1 h-64">
            {salesTrends.map((trend) => (
              <div
                key={trend.date}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div
                  className="w-full bg-brand-500 rounded-t hover:bg-brand-600 transition-colors"
                  style={{
                    height: `${(trend.total / maxSales) * 100}%`,
                    minHeight: '4px',
                  }}
                  title={`${trend.date}: ${formatCurrency(trend.total)}`}
                />
                <span className="text-2xs text-gray-400 dark:text-gray-500 rotate-45 origin-left tabular-nums">
                  {trend.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>No sales data available for the selected period</p>
          </div>
        )}
        <div className="flex justify-between mt-4 text-sm text-gray-500 dark:text-gray-400">
          <span className="tabular-nums">
            Total:{' '}
            {formatCurrency(salesTrends.reduce((sum, s) => sum + s.total, 0))}
          </span>
          <span className="tabular-nums">
            Avg:{' '}
            {formatCurrency(
              salesTrends.reduce((sum, s) => sum + s.total, 0) /
                (salesTrends.length || 1)
            )}
          </span>
        </div>
      </div>

      {/* Top Products */}
      <div className="card-brand mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Top Products
        </h2>
        {topProducts.length > 0 ? (
          <div className="space-y-3">
            {topProducts.map((product, index) => (
              <div
                key={product.name}
                className="flex items-center gap-3 p-2 hover:bg-orange-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm tabular-nums ${
                    index === 0
                      ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300'
                      : index === 1
                      ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      : index === 2
                      ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                      : 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400'
                  }`}
                >
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {product.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                    {product.quantity} units sold
                  </p>
                </div>
                <p className="font-bold text-gray-900 dark:text-white tabular-nums">
                  {formatCurrency(product.revenue)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No product sales data available</p>
          </div>
        )}
      </div>

      {/* Customer Insights */}
      {customerInsights && (
        <div className="card-brand mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Customer Insights
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                {customerInsights.totalCustomers}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Customers
              </p>
            </div>
            <div className="text-center bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(customerInsights.totalRevenue)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Revenue
              </p>
            </div>
            <div className="text-center bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(customerInsights.avgSpend)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Avg Spend
              </p>
            </div>
            <div className="text-center bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
              <p className="text-2xl font-bold text-success-600 dark:text-success-400 tabular-nums">
                {customerInsights.segments.highValue}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                High Value
              </p>
            </div>
          </div>
          {customerInsights.topCustomers &&
            customerInsights.topCustomers.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Top Customers
                </h3>
                <div className="space-y-2">
                  {customerInsights.topCustomers
                    .slice(0, 5)
                    .map((customer, index) => (
                      <div
                        key={customer.email}
                        className="flex items-center justify-between text-sm"
                      >
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {customer.name}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400 ml-2">
                            {customer.email}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                          {formatCurrency(customer.totalSpent)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
        </div>
      )}

      {/* Inventory Analytics */}
      {inventoryAnalytics && (
        <div className="card-brand">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Inventory Analytics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
              <p className="text-2xl font-bold text-brand-600 dark:text-brand-400 tabular-nums">
                {formatCurrency(inventoryAnalytics.totalValue)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Value
              </p>
            </div>
            <div className="text-center bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                {inventoryAnalytics.totalItems}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Items
              </p>
            </div>
            <div className="text-center bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
              <p className="text-2xl font-bold text-warning-600 dark:text-warning-400 tabular-nums">
                {inventoryAnalytics.lowStock}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Low Stock
              </p>
            </div>
            <div className="text-center bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
              <p className="text-2xl font-bold text-danger-600 dark:text-danger-400 tabular-nums">
                {inventoryAnalytics.outOfStock}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Out of Stock
              </p>
            </div>
          </div>
          {inventoryAnalytics.turnoverRate > 0 && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Inventory Turnover Rate
                </span>
                <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                  {inventoryAnalytics.turnoverRate.toFixed(2)}x
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                <div
                  className="bg-brand-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      (inventoryAnalytics.turnoverRate / 10) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
