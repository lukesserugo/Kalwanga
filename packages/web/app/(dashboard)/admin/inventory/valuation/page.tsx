// D:\Projects\Kalwanga\packages\web\app\(dashboard)\inventory\valuation\page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, TrendingDown, Package,
  RefreshCw, Download, Lock, AlertCircle,
  Calendar, BarChart3, PieChart, FileText
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { inventoryService } from '../../../../../services/inventoryService';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency, formatDate } from '../../../../../utils/formatters';

export default function ValuationPage() {
  const router = useRouter();
  const { user, canViewReports } = useAuth();
  const [loading, setLoading] = useState(true);
  const [valuation, setValuation] = useState<any>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [exporting, setExporting] = useState(false);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || '';

  // Check permission
  if (!canViewReports) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to view valuation reports.</p>
      </div>
    );
  }

  useEffect(() => {
    loadValuation();
  }, [businessUnitId, dateRange]);

  const loadValuation = async () => {
    try {
      setLoading(true);
      const summary = await inventoryService.getInventorySummary(businessUnitId);
      setValuation({
        totalValue: summary.totalValue || 0,
        totalItems: summary.totalItems || 0,
        averageValue: summary.totalItems > 0 ? summary.totalValue / summary.totalItems : 0,
        categories: summary.categories || [],
        lowStock: summary.lowStockItems || 0,
        outOfStock: summary.outOfStockItems || 0,
      });
    } catch (error) {
      console.error('Failed to load valuation:', error);
      toast.error('Failed to load valuation');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await inventoryService.exportInventory(businessUnitId, 'csv');
      toast.success('Valuation report exported successfully');
    } catch (error) {
      toast.error('Failed to export valuation');
    } finally {
      setExporting(false);
    }
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
            <DollarSign className="w-8 h-8 text-green-500" />
            Inventory Valuation
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track the value of your inventory</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadValuation}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>

      {/* Date Range */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Date Range:</span>
          </div>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <span className="text-sm text-gray-500">to</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <button
            onClick={loadValuation}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Value</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(valuation?.totalValue || 0)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Items</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{valuation?.totalItems || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Average Value/Item</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(valuation?.averageValue || 0)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Health Score</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {valuation?.totalItems > 0 
              ? Math.round(((valuation.totalItems - valuation.lowStock - valuation.outOfStock) / valuation.totalItems) * 100)
              : 0}%
          </p>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <PieChart className="w-5 h-5 text-blue-500" />
          Category Breakdown
        </h3>
        {valuation?.categories?.length === 0 ? (
          <p className="text-center text-gray-500 py-4">No categories found</p>
        ) : (
          <div className="space-y-3">
            {valuation?.categories?.map((category: any, index: number) => (
              <div key={index}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700 dark:text-gray-300">{category.name}</span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {category.count} items - {formatCurrency(category.value)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(category.value / (valuation?.totalValue || 1)) * 100}%` }}
                    transition={{ duration: 0.8 }}
                    className="bg-gradient-to-r from-blue-500 to-green-500 rounded-full h-2"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
