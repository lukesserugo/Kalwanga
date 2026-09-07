// D:\Projects\Kalwanga\packages\web\components\inventory\InventoryReports.tsx

'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Package, DollarSign,
  Calendar, Download, RefreshCw, Filter, FileText,
  PieChart, ArrowUp, ArrowDown, AlertTriangle, CheckCircle
} from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { toast } from '../../utils/toast-manager';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';

// ============================================
// TYPES - FIXED: Use consistent property names
// ============================================

interface ReportData {
  summary: {
    totalItems: number;
    totalValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    // FIX: Use 'name' instead of 'category' to match the interface
    categories: Array<{ name: string; count: number; value: number }>;
  };
  movements: Array<{
    date: string;
    in: number;
    out: number;
    net: number;
  }>;
  topProducts: Array<{
    name: string;
    sku: string;
    quantity: number;
    value: number;
  }>;
  lowStockItems: Array<{
    name: string;
    sku: string;
    quantity: number;
    reorderPoint: number;
  }>;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function InventoryReports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [reportType, setReportType] = useState<'summary' | 'movements' | 'products'>('summary');
  const [exporting, setExporting] = useState(false);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || '';

  useEffect(() => {
    loadReport();
  }, [businessUnitId, dateRange]);

  const loadReport = async () => {
    if (!businessUnitId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await inventoryService.getInventorySummary(businessUnitId);
      
      // FIX: Map 'category' to 'name' to match the interface
      const categories = (data.categories || []).map((cat: any) => ({
        name: cat.category || cat.name || 'Uncategorized',
        count: cat.count || 0,
        value: cat.value || 0,
      }));
      
      setReportData({
        summary: {
          totalItems: data.totalItems || 0,
          totalValue: data.totalValue || 0,
          lowStockCount: data.lowStockItems || 0,
          outOfStockCount: data.outOfStockItems || 0,
          categories: categories,
        },
        movements: [],
        topProducts: [],
        lowStockItems: [],
      });
    } catch (error) {
      console.error('Failed to load report:', error);
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'csv' | 'excel' = 'csv') => {
    setExporting(true);
    try {
      const blob = await inventoryService.exportInventory(businessUnitId, format === 'csv' ? 'csv' : 'excel');
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inventory_report_${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : format === 'csv' ? 'csv' : 'xlsx'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Report exported successfully');
    } catch (error) {
      toast.error('Failed to export report');
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

  if (!reportData) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-600">No data available</h2>
        <p className="text-gray-400 mt-2">Inventory data will appear here</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-500" />
            Inventory Reports
          </h1>
          <p className="text-gray-600 mt-1">Track and analyze your inventory performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => loadReport()}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">{reportData.summary.totalItems}</p>
            </div>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Value</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(reportData.summary.totalValue)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Low Stock</p>
              <p className="text-2xl font-bold text-yellow-600">{reportData.summary.lowStockCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600">{reportData.summary.outOfStockCount}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-blue-500" />
            Category Breakdown
          </h3>
        </div>
        <div className="p-6">
          {reportData.summary.categories.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No categories found</p>
          ) : (
            <div className="space-y-3">
              {reportData.summary.categories.map((category, index) => (
                <div key={index}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{category.name}</span>
                    <span className="text-gray-600">
                      {category.count} items - {formatCurrency(category.value)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 rounded-full h-2 transition-all"
                      style={{
                        width: `${(category.value / reportData.summary.totalValue) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setReportType('summary')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            reportType === 'summary'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Summary
        </button>
        <button
          onClick={() => setReportType('movements')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            reportType === 'movements'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Movements
        </button>
        <button
          onClick={() => setReportType('products')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            reportType === 'products'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Top Products
        </button>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-6 min-h-[200px]">
          {reportType === 'summary' && (
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Inventory Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Total SKUs</p>
                  <p className="text-2xl font-bold text-gray-900">{reportData.summary.totalItems}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Average Value per Item</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {reportData.summary.totalItems > 0
                      ? formatCurrency(reportData.summary.totalValue / reportData.summary.totalItems)
                      : formatCurrency(0)}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Stock Health</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {reportData.summary.totalItems > 0
                      ? `${Math.round(((reportData.summary.totalItems - reportData.summary.lowStockCount - reportData.summary.outOfStockCount) / reportData.summary.totalItems) * 100)}%`
                      : '0%'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {reportType === 'movements' && (
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Stock Movements</h4>
              <p className="text-gray-500 text-sm">Movement data will appear here</p>
            </div>
          )}

          {reportType === 'products' && (
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Top Products</h4>
              <p className="text-gray-500 text-sm">Product data will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
