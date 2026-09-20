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
          <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          <div>
            <div className="font-medium text-gray-900 dark:text-white">
              {r.locationName}
            </div>
            <div className="text-2xs text-gray-500 dark:text-gray-400">
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
        <span className="tabular-nums text-gray-600 dark:text-gray-400">
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
        <span className="tabular-nums text-gray-600 dark:text-gray-400">
          {formatNumber(r.totalQuantity)}
        </span>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      align: 'right',
      render: (r) => (
        <span className="font-medium tabular-nums text-success-600 dark:text-success-400">
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
          <span className="inline-flex px-2 py-0.5 rounded-full text-2xs tabular-nums bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300">
            {r.lowStockCount}
          </span>
        ) : (
          <span className="text-gray-300 dark:text-gray-600">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <LocationBUSelector value={businessUnitId} onChange={setBusinessUnitId} />
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition duration-250 disabled:opacity-50 focus-ring"
          title="Refresh"
          aria-label="Refresh reports"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-brand-50 dark:bg-brand-900/20 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Locations</p>
              <p className="text-2xl font-bold tabular-nums text-brand-600 dark:text-brand-400 mt-1">
                {totals.locations}
              </p>
            </div>
            <Building2 className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          </div>
        </div>
        <div className="bg-secondary-50 dark:bg-secondary-900/20 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Items</p>
              <p className="text-2xl font-bold tabular-nums text-secondary-600 dark:text-secondary-400 mt-1">
                {formatNumber(totals.items)}
              </p>
            </div>
            <Package className="w-5 h-5 text-secondary-600 dark:text-secondary-400" />
          </div>
        </div>
        <div className="bg-success-50 dark:bg-success-900/20 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Value</p>
              <p className="text-2xl font-bold tabular-nums text-success-600 dark:text-success-400 mt-1">
                {formatCurrency(totals.value)}
              </p>
            </div>
            <TrendingUp className="w-5 h-5 text-success-600 dark:text-success-400" />
          </div>
        </div>
        <div className="bg-warning-50 dark:bg-warning-900/20 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Low Stock</p>
              <p className="text-2xl font-bold tabular-nums text-warning-600 dark:text-warning-400 mt-1">
                {totals.lowStock}
              </p>
            </div>
            <Layers className="w-5 h-5 text-warning-600 dark:text-warning-400" />
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
