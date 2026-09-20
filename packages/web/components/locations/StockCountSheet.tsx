'use client';

// packages/web/components/locations/StockCountSheet.tsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Save,
  Search,
} from 'lucide-react';
import { api } from '../../services/api';
import { locationService, type Location } from '../../services/locationService';
import { toast } from '../../utils/toast-manager';
import LocationBUSelector from './LocationBUSelector';

interface StockRow {
  inventoryId: string;
  productId: string;
  variantId: string | null;
  name: string;
  sku: string;
  systemQty: number;
  countedQty: number | '';
  notes: string;
}

interface StockCountSheetProps {
  initialBusinessUnitId?: string;
}

export function StockCountSheet({ initialBusinessUnitId }: StockCountSheetProps) {
  const [businessUnitId, setBusinessUnitId] = useState(initialBusinessUnitId ?? '');
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState('');
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Load locations for the selected BU.
  useEffect(() => {
    if (!businessUnitId) {
      setLocations([]);
      setLocationId('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await locationService.list(businessUnitId);
        if (!cancelled) {
          setLocations(list.filter((l) => l.isActive && !l.deletedAt));
        }
      } catch (err) {
        console.warn('StockCount: failed to load locations', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessUnitId]);

  // Load inventory rows for the selected location.
  const loadRows = useCallback(async () => {
    if (!locationId) {
      setRows([]);
      return;
    }
    try {
      setLoading(true);
      const raw = await api.get<any>('/inventory', {
        params: { locationId, limit: 500 },
      });
      const list = raw?.data?.items ?? raw?.data ?? raw?.items ?? [];
      const mapped: StockRow[] = (Array.isArray(list) ? list : []).map(
        (row: any) => ({
          inventoryId: row.id,
          productId: row.productId,
          variantId: row.variantId ?? null,
          name: row.product?.name ?? row.name ?? 'Unknown product',
          sku: row.variant?.sku ?? row.product?.sku ?? '—',
          systemQty: row.quantity ?? 0,
          countedQty: '',
          notes: '',
        })
      );
      setRows(mapped);
    } catch (err: any) {
      console.error('StockCount: failed to load inventory', err);
      toast.error(err?.message || 'Failed to load inventory');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const setCount = (inventoryId: string, value: string) => {
    const parsed = value === '' ? '' : parseInt(value, 10);
    setRows((prev) =>
      prev.map((r) =>
        r.inventoryId === inventoryId
          ? { ...r, countedQty: Number.isFinite(parsed) ? (parsed as number) : '' }
          : r
      )
    );
  };

  const setNotes = (inventoryId: string, value: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.inventoryId === inventoryId ? { ...r, notes: value } : r
      )
    );
  };

  const stats = useMemo(() => {
    let counted = 0;
    let discrepancies = 0;
    for (const r of rows) {
      if (r.countedQty !== '') {
        counted++;
        if (r.countedQty !== r.systemQty) discrepancies++;
      }
    }
    return { counted, discrepancies, total: rows.length };
  }, [rows]);

  const handleSubmit = async () => {
    if (!locationId) {
      toast.error('Select a location first');
      return;
    }

    const counted = rows.filter((r) => r.countedQty !== '');
    if (counted.length === 0) {
      toast.error('Enter at least one count before submitting');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        businessUnitId,
        locationId,
        items: counted.map((r) => ({
          inventoryId: r.inventoryId,
          productId: r.productId,
          variantId: r.variantId,
          countedQuantity: r.countedQty,
          systemQuantity: r.systemQty,
          notes: r.notes.trim() || undefined,
        })),
      };
      // TODO: swap for your real endpoint. If you don't have one yet, use
      // POST /inventory/adjustment with reason "Stock count".
      await api.post('/inventory/stock-count', payload);
      toast.success(
        `Stock count saved: ${counted.length} item(s), ${stats.discrepancies} discrepancy(ies)`
      );
      await loadRows();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to save stock count'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <LocationBUSelector value={businessUnitId} onChange={setBusinessUnitId} />

        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          disabled={!businessUnitId || locations.length === 0}
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 disabled:opacity-50 min-w-[200px]"
        >
          <option value="">Select location…</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>

        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || stats.counted === 0}
          className="btn-brand disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save count
            </>
          )}
        </button>
      </div>

      {/* Stats */}
      {rows.length > 0 && (
        <div className="grid grid-cols-3 gap-3 animate-slide-down">
          <div className="card-brand shadow-soft p-3">
            <p className="text-2xs text-gray-500 dark:text-gray-400">Total items</p>
            <p className="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
              {stats.total}
            </p>
          </div>
          <div className="card-brand shadow-soft p-3">
            <p className="text-2xs text-gray-500 dark:text-gray-400">Counted</p>
            <p className="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
              {stats.counted}
            </p>
          </div>
          <div
            className={`rounded-2xl border p-3 transition duration-250 ${
              stats.discrepancies > 0
                ? 'bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-800'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-soft'
            }`}
          >
            <p className="text-2xs text-gray-500 dark:text-gray-400">Discrepancies</p>
            <p
              className={`text-lg font-semibold tabular-nums ${
                stats.discrepancies > 0
                  ? 'text-danger-600 dark:text-danger-400'
                  : 'text-gray-900 dark:text-white'
              }`}
            >
              {stats.discrepancies}
            </p>
          </div>
        </div>
      )}

      {/* Sheet */}
      {!locationId ? (
        <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-2xl p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-warning-500 mx-auto mb-2" />
          <p className="text-sm text-warning-700 dark:text-warning-300">
            Select a location to begin a stock count.
          </p>
        </div>
      ) : loading ? (
        <div className="card-brand shadow-soft p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600 dark:text-brand-400 mx-auto" />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading inventory…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-brand shadow-soft p-12 text-center">
          <ClipboardList className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No inventory rows at this location.
          </p>
        </div>
      ) : (
        <div className="card-brand shadow-soft overflow-hidden p-0">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow hidden md:table-cell">
                    SKU
                  </th>
                  <th className="px-4 py-3 text-right text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow">
                    System
                  </th>
                  <th className="px-4 py-3 text-right text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow">
                    Counted
                  </th>
                  <th className="px-4 py-3 text-right text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow">
                    Diff
                  </th>
                  <th className="px-4 py-3 text-left text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow hidden lg:table-cell">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filtered.map((r) => {
                  const diff =
                    r.countedQty === '' ? null : r.countedQty - r.systemQty;
                  const rowCls =
                    diff === null
                      ? ''
                      : diff === 0
                      ? 'bg-success-50/40 dark:bg-success-900/10'
                      : 'bg-danger-50/40 dark:bg-danger-900/10';
                  return (
                    <tr key={r.inventoryId} className={`transition duration-250 ${rowCls}`}>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                        {r.name}
                      </td>
                      <td className="px-4 py-2 text-sm font-mono tabular-nums text-gray-500 dark:text-gray-400 hidden md:table-cell">
                        {r.sku}
                      </td>
                      <td className="px-4 py-2 text-sm text-right tabular-nums text-gray-600 dark:text-gray-400">
                        {r.systemQty}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          value={r.countedQty}
                          onChange={(e) => setCount(r.inventoryId, e.target.value)}
                          className="w-20 px-2 py-1 text-right text-sm tabular-nums rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        {diff === null ? (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        ) : diff === 0 ? (
                          <span className="inline-flex items-center gap-1 tabular-nums text-success-600 dark:text-success-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />0
                          </span>
                        ) : (
                          <span className="text-danger-600 dark:text-danger-400 font-medium tabular-nums">
                            {diff > 0 ? '+' : ''}
                            {diff}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 hidden lg:table-cell">
                        <input
                          type="text"
                          value={r.notes}
                          onChange={(e) => setNotes(r.inventoryId, e.target.value)}
                          placeholder="Optional"
                          className="w-full px-2 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default StockCountSheet;
