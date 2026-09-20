// src/components/dashboard/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { StatsCard } from './StatsCard';
import { SalesChart } from './SalesChart';
import { RecentActivity } from './RecentActivity';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Package,
  AlertTriangle,
  ShoppingCart,
  Clock,
  Star,
  Calendar,
} from 'lucide-react';
import { dashboardService } from '../../services/dashboardService';
import { useAuth } from '../../hooks/useAuth';

export function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [recentData, setRecentData] = useState<any>(null);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>(
    'today',
  );

  useEffect(() => {
    loadDashboardData();
  }, [timeRange]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, recentData] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getRealtimeData(),
      ]);
      setStats(statsData);
      setRecentData(recentData);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700 border-t-brand-500" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Welcome back, {user?.firstName}! Here's what's happening with your
              business today.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTimeRange('today')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-ring ${
                timeRange === 'today'
                  ? 'bg-brand-gradient text-white shadow-brand'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeRange('week')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-ring ${
                timeRange === 'week'
                  ? 'bg-brand-gradient text-white shadow-brand'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setTimeRange('month')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-ring ${
                timeRange === 'month'
                  ? 'bg-brand-gradient text-white shadow-brand'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700'
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatsCard
          title="Today's Sales"
          value={`$${stats?.sales?.today?.total?.toFixed(2) || '0.00'}`}
          subtitle={`${stats?.sales?.today?.count || 0} transactions`}
          icon={<DollarSign className="w-6 h-6" />}
          trend={stats?.sales?.today?.trend}
          color="blue"
        />
        <StatsCard
          title="Weekly Sales"
          value={`$${stats?.sales?.week?.total?.toFixed(2) || '0.00'}`}
          subtitle={`${stats?.sales?.week?.count || 0} transactions`}
          icon={<TrendingUp className="w-6 h-6" />}
          trend={stats?.sales?.week?.trend}
          color="green"
        />
        <StatsCard
          title="Monthly Sales"
          value={`$${stats?.sales?.month?.total?.toFixed(2) || '0.00'}`}
          subtitle={`${stats?.sales?.month?.count || 0} transactions`}
          icon={<Calendar className="w-6 h-6" />}
          trend={stats?.sales?.month?.trend}
          color="purple"
        />
        <StatsCard
          title="Total Customers"
          value={stats?.customers?.total || 0}
          subtitle={`${stats?.customers?.new || 0} new this month`}
          icon={<Users className="w-6 h-6" />}
          trend={stats?.customers?.trend}
          color="indigo"
        />
        <StatsCard
          title="Inventory Value"
          value={`$${stats?.inventory?.totalValue?.toFixed(2) || '0.00'}`}
          subtitle={`${stats?.inventory?.totalItems || 0} items`}
          icon={<Package className="w-6 h-6" />}
          color="orange"
        />
        <StatsCard
          title="Low Stock Items"
          value={stats?.inventory?.lowStock || 0}
          subtitle={`${stats?.inventory?.outOfStock || 0} out of stock`}
          icon={<AlertTriangle className="w-6 h-6" />}
          trend={stats?.inventory?.lowStock > 0 ? 'down' : 'up'}
          color="red"
        />
        <StatsCard
          title="Open Registers"
          value={stats?.registers?.open || 0}
          subtitle="Cash registers"
          icon={<Clock className="w-6 h-6" />}
          color="yellow"
        />
        <StatsCard
          title="Pending Orders"
          value={stats?.orders?.pending || 0}
          subtitle="Awaiting processing"
          icon={<ShoppingCart className="w-6 h-6" />}
          trend="up"
          color="pink"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 card-brand">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Sales Overview
            </h3>
            <div className="flex gap-2">
              <button className="text-sm text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors focus-ring rounded">
                Revenue
              </button>
              <button className="text-sm text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors focus-ring rounded">
                Orders
              </button>
            </div>
          </div>
          <SalesChart data={recentData?.sales || []} />
        </div>
        <div className="card-brand">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Top Products
          </h3>
          <div className="space-y-4">
            {recentData?.topProducts
              ?.slice(0, 5)
              .map((product: any, index: number) => (
                <div key={product.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-semibold text-sm tabular-nums">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-gray-900 dark:text-white">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      {product.sales} sold
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                    ${product.revenue.toFixed(2)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivity notifications={recentData?.notifications || []} />
        <div className="card-brand">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Low Stock Alert
            </h3>
            <button className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors focus-ring rounded">
              View All
            </button>
          </div>
          <div className="space-y-3">
            {recentData?.lowStockInventory?.slice(0, 5).map((item: any) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg border border-danger-100 dark:border-danger-800/30"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {item.product?.name}
                  </p>
                  <p className="text-2xs text-gray-500 dark:text-gray-400 font-mono">
                    SKU: {item.product?.sku}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-danger-600 dark:text-danger-400 font-semibold tabular-nums">
                    {item.quantity} in stock
                  </p>
                  <p className="text-2xs text-gray-500 dark:text-gray-400">
                    Reorder at: {item.reorderPoint}
                  </p>
                </div>
              </div>
            ))}
            {(!recentData?.lowStockInventory ||
              recentData.lowStockInventory.length === 0) && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p>No low stock items</p>
                <p className="text-sm">All inventory levels are healthy</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
