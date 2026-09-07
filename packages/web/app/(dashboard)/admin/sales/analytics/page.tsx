'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Calendar, Filter,
  Download, RefreshCw, BarChart3, PieChart,
  LineChart, Activity, Target, Award, Users
} from 'lucide-react';
import { saleService } from '../../../../../services/saleService';
import { formatCurrency, formatDate } from '../../../../../utils/formatters';
import { toast } from '../../../../../utils/toast-manager';

export default function SalesAnalytics() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [view, setView] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  useEffect(() => {
    loadAnalytics();
  }, [dateRange, view]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const data = await saleService.getSalesAnalytics({
        startDate: dateRange.start,
        endDate: dateRange.end,
        view,
      });
      setAnalytics(data);
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Sales Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Advanced sales insights and performance metrics
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex bg-white dark:bg-gray-800 rounded-lg shadow-sm p-1">
              {['daily', 'weekly', 'monthly'].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    view === v
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={loadAnalytics}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Date Range:</span>
            </div>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <span className="text-gray-500 dark:text-gray-400">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button
              onClick={loadAnalytics}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply Filter
            </button>
          </div>
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Trend */}
          <AnalyticsCard title="Revenue Trend" icon={LineChart}>
            <RevenueTrend data={analytics?.revenueTrend || []} />
          </AnalyticsCard>

          {/* Sales Distribution */}
          <AnalyticsCard title="Sales Distribution" icon={PieChart}>
            <SalesDistribution data={analytics?.distribution || []} />
          </AnalyticsCard>

          {/* Peak Hours */}
          <AnalyticsCard title="Peak Hours" icon={Activity}>
            <PeakHours data={analytics?.peakHours || []} />
          </AnalyticsCard>

          {/* Customer Insights */}
          <AnalyticsCard title="Customer Insights" icon={Target}>
            <CustomerInsights data={analytics?.customerInsights || {}} />
          </AnalyticsCard>
        </div>

        {/* Performance Metrics */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Best Selling Category"
            value={analytics?.bestCategory || 'N/A'}
            subtitle={`${analytics?.bestCategorySales || 0} units`}
            icon={Award}
            color="gold"
          />
          <MetricCard
            title="Average Order Value"
            value={formatCurrency(analytics?.averageOrderValue || 0)}
            subtitle={`${analytics?.averageItems || 0} items per order`}
            icon={TrendingUp}
            color="green"
          />
          <MetricCard
            title="Customer Retention"
            value={`${analytics?.retentionRate || 0}%`}
            subtitle={`${analytics?.returningCustomers || 0} returning customers`}
            icon={Users}
            color="blue"
          />
          <MetricCard
            title="Conversion Rate"
            value={`${analytics?.conversionRate || 0}%`}
            subtitle={`${analytics?.totalVisitors || 0} visitors`}
            icon={Target}
            color="purple"
          />
        </div>
      </div>
    </div>
  );
}

// Helper Components
function AnalyticsCard({ title, icon: Icon, children }: any) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon: Icon, color }: any) {
  const colors: Record<string, string> = {
    gold: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function RevenueTrend({ data }: any) {
  return (
    <div className="h-48 flex items-center justify-center text-gray-400">
      <div className="text-center">
        <LineChart className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Revenue trend chart</p>
        <p className="text-sm">(Install recharts for interactive charts)</p>
      </div>
    </div>
  );
}

function SalesDistribution({ data }: any) {
  return (
    <div className="h-48 flex items-center justify-center text-gray-400">
      <div className="text-center">
        <PieChart className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Sales distribution chart</p>
        <p className="text-sm">(Install recharts for interactive charts)</p>
      </div>
    </div>
  );
}

function PeakHours({ data }: any) {
  return (
    <div className="h-48 flex items-center justify-center text-gray-400">
      <div className="text-center">
        <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Peak hours chart</p>
        <p className="text-sm">(Install recharts for interactive charts)</p>
      </div>
    </div>
  );
}

function CustomerInsights({ data }: any) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <span className="text-gray-600 dark:text-gray-400">New Customers</span>
        <span className="font-semibold text-gray-900 dark:text-white">{data.newCustomers || 0}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600 dark:text-gray-400">Returning Customers</span>
        <span className="font-semibold text-gray-900 dark:text-white">{data.returningCustomers || 0}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600 dark:text-gray-400">Total Customers</span>
        <span className="font-semibold text-gray-900 dark:text-white">{data.totalCustomers || 0}</span>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-4"></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 h-64"></div>
        ))}
      </div>
    </div>
  );
}
