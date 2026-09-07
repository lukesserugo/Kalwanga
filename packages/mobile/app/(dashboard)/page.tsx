'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import DashboardStats from '../../components/DashboardStats';
import SalesChart from '../../components/SalesChart';
import RecentSales from '../../components/RecentSales';
import TopProducts from '../../components/TopProducts';
import { apiService } from '../../services/api';
import { useToast } from '../../hooks/useToast';

export default function DashboardPage() {
  const { user } = useUser();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSales: 0,
    revenue: 0,
    products: 0,
    customers: 0,
  });
  const [salesData, setSalesData] = useState<Array<{ date: string; sales: number; revenue: number }>>([]);
  const [recentSales, setRecentSales] = useState([]);
  const [topProducts, setTopProducts] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [statsRes, salesRes, recentRes, productsRes] = await Promise.all([
          apiService.get('/dashboard/stats'),
          apiService.get('/dashboard/sales-chart'),
          apiService.get('/sales?limit=5'),
          apiService.get('/dashboard/top-products'),
        ]);

        setStats(statsRes.data);
        setSalesData(salesRes.data);
        setRecentSales(recentRes.data);
        setTopProducts(productsRes.data);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        showToast('Failed to load dashboard data', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [showToast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user?.firstName || 'User'}!</p>
      </div>

      <DashboardStats stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2">
          <SalesChart data={salesData} />
        </div>
        <div>
          <TopProducts products={topProducts} />
        </div>
      </div>

      <div className="mt-6">
        <RecentSales sales={recentSales} />
      </div>
    </div>
  );
}
