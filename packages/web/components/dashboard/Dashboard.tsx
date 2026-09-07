// src/components/dashboard/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { StatsCard } from './StatsCard';
import { SalesChart } from './SalesChart';
import { RecentActivity } from './RecentActivity';
import { 
  TrendingUp, TrendingDown, DollarSign, Users, Package, 
  AlertTriangle, ShoppingCart, Clock, Star, Calendar 
} from 'lucide-react';
import { dashboardService } from '../../services/dashboardService';
import { useAuth } from '../../hooks/useAuth';

export function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [recentData, setRecentData] = useState<any>(null);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome back, {user?.firstName}! Here's what's happening with your business today.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTimeRange('today')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === 'today' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeRange('week')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === 'week' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setTimeRange('month')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === 'month' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-100'
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
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Sales Overview</h3>
            <div className="flex gap-2">
              <button className="text-sm text-gray-500 hover:text-gray-700">Revenue</button>
              <button className="text-sm text-gray-500 hover:text-gray-700">Orders</button>
            </div>
          </div>
          <SalesChart data={recentData?.sales || []} />
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Top Products</h3>
          <div className="space-y-4">
            {recentData?.topProducts?.slice(0, 5).map((product: any, index: number) => (
              <div key={product.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-semibold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  <p className="text-xs text-gray-500">{product.sales} sold</p>
                </div>
                <span className="text-sm font-semibold">${product.revenue.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivity notifications={recentData?.notifications || []} />
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Low Stock Alert</h3>
            <button className="text-sm text-blue-600 hover:text-blue-700">View All</button>
          </div>
          <div className="space-y-3">
            {recentData?.lowStockInventory?.slice(0, 5).map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{item.product?.name}</p>
                  <p className="text-sm text-gray-500">SKU: {item.product?.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-red-600 font-semibold">{item.quantity} in stock</p>
                  <p className="text-xs text-gray-500">Reorder at: {item.reorderPoint}</p>
                </div>
              </div>
            ))}
            {(!recentData?.lowStockInventory || recentData.lowStockInventory.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
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
