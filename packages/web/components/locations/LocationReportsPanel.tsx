'use client';

// packages/web/components/locations/LocationReportsPanel.tsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Building2,
  Layers,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { api } from '../../services/api';
import { toast } from '../../utils/toast-manager';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import LocationBUSelector from './LocationBUSelector';
import LocationDataTable, { type Column } from './LocationDataTable';

interface ReportRow {
  locationId: string;
  locationName: string;
  type: string;
  code?: string | null;
  itemCount: number;
  totalQuantity: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}

interface LocationReportsPanelProps {
  initialBusinessUnitId?: string;
}

export function LocationReportsPanel({
  initialBusinessUnitId,
}: LocationReportsPanelProps) {
  const [businessUnitId, setBusinessUnitId] = useState(
    initialBusinessUnitId ?? ''
  );
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!businessUnitId) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const raw = await api.get<any>('/locations/reports', {
        params: { businessUnitId },
      });
      const list: ReportRow[] = raw?.data ?? raw?.items ?? [];
      setRows(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('Failed to load location reports:', err);
      toast.error(err?.message || 'Failed to load reports');
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessUnitId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        locations: acc.locations + 1,
        items: acc.items + r.itemCount,
        value: acc.value + r.totalValue,
        lowStock: acc.lowStock + r.lowStockCount,
      }),
      { locations: 0, items: 0, value: 0, lowStock: 0 }
    );
  }, [rows]);

  const columns: Column<ReportRow>[] = [
    {
      key: 'name',
      header: 'Location',
      render: (r) => (
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div>
            <div className="font-medium text-gray-900 dark:text-white">
              {r.locationName}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {r.type}
              {r.code ? ` • ${r.code}` : ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      align: 'right',
      render: (r) => (
        <span className="text-gray-600 dark:text-gray-400">
          {formatNumber(r.itemCount)}
        </span>
      ),
    },
    {
      key: 'qty',
      header: 'Total Qty',
      align: 'right',
      hideBelow: 'sm',
      render: (r) => (
        <span className="text-gray-600 dark:text-gray-400">
          {formatNumber(r.totalQuantity)}
        </span>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      align: 'right',
      render: (r) => (
        <span className="font-medium text-green-600 dark:text-green-400">
          {formatCurrency(r.totalValue)}
        </span>
      ),
    },
    {
      key: 'low',
      header: 'Low Stock',
      align: 'right',
      hideBelow: 'md',
      render: (r) =>
        r.lowStockCount > 0 ? (
          <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
            {r.lowStockCount}
          </span>
        ) : (
          <span className="text-gray-300 dark:text-gray-600">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <LocationBUSelector value={businessUnitId} onChange={setBusinessUnitId} />
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Locations</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {totals.locations}
              </p>
            </div>
            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Items</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                {formatNumber(totals.items)}
              </p>
            </div>
            <Package className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Value</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {formatCurrency(totals.value)}
              </p>
            </div>
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Low Stock</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                {totals.lowStock}
              </p>
            </div>
            <Layers className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          </div>
        </div>
      </div>

      {/* Table */}
      <LocationDataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.locationId}
        loading={loading}
        emptyMessage="No location data available yet."
      />
    </div>
  );
}

export default LocationReportsPanel;
