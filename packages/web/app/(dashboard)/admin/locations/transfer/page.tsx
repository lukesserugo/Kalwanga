'use client';

// packages/web/app/(dashboard)/admin/locations/transfer/page.tsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
  Truck,
  Warehouse,
} from 'lucide-react';

// ✅ Relative paths — six levels up to packages/web/, then into each folder.
import { api } from '../../../../../services/api';
import { locationService } from '../../../../../services/locationService';
import { useToast } from '../../../../../hooks/useToast';
import type {
  Location,
  LocationType,
} from '../../../../../types/location';

// ============================================
// TYPES
// ============================================

interface InventoryRow {
  id: string;
  productId: string;
  variantId: string | null;
  locationId: string | null;
  location: string | null;
  quantity: number;
  reserved: number;
  available: number;
  product?: {
    id: string;
    name: string;
    sku: string;
    unitPrice: number;
    images?: { url: string }[];
  };
  variant?: {
    id: string;
    name: string;
    sku: string;
  } | null;
}

interface TransferLine {
  key: string;
  inventoryId: string;
  productId: string;
  variantId: string | null;
  productName: string;
  sku: string;
  available: number;
  quantity: number;
}

interface TransferFormState {
  fromLocationId: string;
  toLocationId: string;
  reference: string;
  notes: string;
  carrier: string;
  expectedArrival: string;
}

const EMPTY_FORM: TransferFormState = {
  fromLocationId: '',
  toLocationId: '',
  reference: '',
  notes: '',
  carrier: '',
  expectedArrival: '',
};

const LOCATION_ICONS: Record<LocationType, React.ReactNode> = {
  WAREHOUSE: <Warehouse className="h-4 w-4" />,
  STORE: <Warehouse className="h-4 w-4" />,
  BACKROOM: <Warehouse className="h-4 w-4" />,
  DISTRIBUTION_CENTER: <Truck className="h-4 w-4" />,
  STORE_FRONT: <Warehouse className="h-4 w-4" />,
  IN_TRANSIT: <Truck className="h-4 w-4" />,
  SUPPLIER: <Package className="h-4 w-4" />,
  OTHER: <Package className="h-4 w-4" />,
};

// ============================================
// PAGE
// ============================================

export default function LocationTransferPage() {
  const router = useRouter();
  const { toast } = useToast();

  // ---- locations ----
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);

  // ---- form ----
  const [form, setForm] = useState<TransferFormState>(EMPTY_FORM);
  const [lines, setLines] = useState<TransferLine[]>([]);

  // ---- product picker ----
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  // ---- submission ----
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ============================================
  // LOAD LOCATIONS
  // ============================================

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLocationsLoading(true);
        const rows = await locationService.list();
        if (!cancelled) {
          // ✅ `l` is now typed because `Location` resolves
          setLocations(rows.filter((l: Location) => l.isActive && !l.deletedAt));
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Failed to load locations',
            description: 'Please refresh and try again.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setLocationsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  // ============================================
  // LOAD INVENTORY WHEN SOURCE LOCATION CHANGES
  // ============================================

  const loadInventory = useCallback(
    async (locationId: string) => {
      if (!locationId) {
        setInventory([]);
        return;
      }
      try {
        setInventoryLoading(true);
        const raw = await api.get<any>('/inventory', {
          params: { locationId, limit: 500 },
        });
        const rows: InventoryRow[] =
          raw?.data?.items ?? raw?.data ?? raw?.items ?? [];
        setInventory(Array.isArray(rows) ? rows : []);
      } catch (err) {
        console.warn('❌ Failed to load inventory for location:', err);
        setInventory([]);
        toast({
          title: 'Failed to load inventory',
          description: 'Stock for the selected source could not be loaded.',
          variant: 'destructive',
        });
      } finally {
        setInventoryLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (form.fromLocationId) {
      loadInventory(form.fromLocationId);
    } else {
      setInventory([]);
    }
    // Drop lines when source changes — availability is source-specific
    setLines([]);
  }, [form.fromLocationId, loadInventory]);

  // ============================================
  // DERIVED
  // ============================================

  const fromLocation = useMemo(
    () => locations.find((l) => l.id === form.fromLocationId) ?? null,
    [locations, form.fromLocationId]
  );

  const toLocation = useMemo(
    () => locations.find((l) => l.id === form.toLocationId) ?? null,
    [locations, form.toLocationId]
  );

  const filteredInventory = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter((row) => {
      const name = row.product?.name?.toLowerCase() ?? '';
      const sku = row.product?.sku?.toLowerCase() ?? '';
      const vName = row.variant?.name?.toLowerCase() ?? '';
      const vSku = row.variant?.sku?.toLowerCase() ?? '';
      return (
        name.includes(q) ||
        sku.includes(q) ||
        vName.includes(q) ||
        vSku.includes(q)
      );
    });
  }, [inventory, search]);

  const totalUnits = useMemo(
    () => lines.reduce((sum, l) => sum + (l.quantity || 0), 0),
    [lines]
  );

  const hasStockWarning = useMemo(
    () => lines.some((l) => l.quantity > l.available),
    [lines]
  );

  // ============================================
  // HANDLERS
  // ============================================

  const setField = <K extends keyof TransferFormState>(
    key: K,
    value: TransferFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  const addLine = (row: InventoryRow) => {
    // ✅ Guard: narrow `row.product` once, then use the local const.
    const product = row.product;
    if (!product) return;

    const key = `${row.productId}:${row.variantId ?? 'base'}`;
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) =>
          l.key === key
            ? { ...l, quantity: Math.min(l.quantity + 1, l.available) }
            : l
        );
      }
      return [
        ...prev,
        {
          key,
          inventoryId: row.id,
          productId: row.productId,
          variantId: row.variantId,
          productName: product.name,
          sku: row.variant?.sku ?? product.sku,
          available: row.available,
          quantity: 1,
        },
      ];
    });
    setPickerOpen(false);
    setSearch('');
  };

  const updateLineQty = (key: string, qty: number) => {
    setLines((prev) =>
      prev.map((l) =>
        l.key === key
          ? {
              ...l,
              quantity: Number.isFinite(qty) ? Math.max(1, qty) : 1,
            }
          : l
      )
    );
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};

    if (!form.fromLocationId) next.fromLocationId = 'Source location is required';
    if (!form.toLocationId) next.toLocationId = 'Destination location is required';
    if (
      form.fromLocationId &&
      form.toLocationId &&
      form.fromLocationId === form.toLocationId
    ) {
      next.toLocationId = 'Source and destination must be different';
    }
    if (lines.length === 0) next.lines = 'Add at least one product to transfer';

    for (const line of lines) {
      if (line.quantity > line.available) {
        next.lines = `"${line.productName}" exceeds available stock (${line.available})`;
        break;
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast({
        title: 'Please fix the highlighted fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      await api.post('/inventory/transfer', {
        fromLocationId: form.fromLocationId,
        toLocationId: form.toLocationId,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
        carrier: form.carrier || undefined,
        expectedArrival: form.expectedArrival
          ? new Date(form.expectedArrival).toISOString()
          : undefined,
        items: lines.map((l) => ({
          inventoryId: l.inventoryId,
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
        })),
      });

      toast({
        title: 'Transfer initiated',
        description: `${totalUnits} unit(s) moving from ${
          fromLocation?.name ?? 'source'
        } to ${toLocation?.name ?? 'destination'}.`,
      });

      router.push('/admin/locations');
      router.refresh();
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Transfer could not be completed.';
      toast({
        title: 'Transfer failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Transfer Stock
            </h1>
            <p className="text-sm text-gray-500">
              Move inventory between locations within this business unit.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ------------------------------- */}
        {/* LEFT / MAIN FORM                */}
        {/* ------------------------------- */}
        <div className="space-y-6 lg:col-span-2">
          {/* Locations */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">
              Route
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* FROM */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  From location
                </label>
                <select
                  value={form.fromLocationId}
                  onChange={(e) =>
                    setField('fromLocationId', e.target.value)
                  }
                  disabled={locationsLoading}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.fromLocationId
                      ? 'border-red-400'
                      : 'border-gray-300'
                  }`}
                >
                  <option value="">
                    {locationsLoading ? 'Loading…' : 'Select source'}
                  </option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                      {loc.type ? ` · ${loc.type}` : ''}
                    </option>
                  ))}
                </select>
                {errors.fromLocationId && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.fromLocationId}
                  </p>
                )}
              </div>

              {/* TO */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  To location
                </label>
                <select
                  value={form.toLocationId}
                  onChange={(e) => setField('toLocationId', e.target.value)}
                  disabled={locationsLoading}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.toLocationId ? 'border-red-400' : 'border-gray-300'
                  }`}
                >
                  <option value="">
                    {locationsLoading ? 'Loading…' : 'Select destination'}
                  </option>
                  {locations
                    .filter((l) => l.id !== form.fromLocationId)
                    .map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                        {loc.type ? ` · ${loc.type}` : ''}
                      </option>
                    ))}
                </select>
                {errors.toLocationId && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.toLocationId}
                  </p>
                )}
              </div>
            </div>

            {/* Visual route */}
            {fromLocation && toLocation && (
              <div className="mt-4 flex items-center gap-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
                <span className="flex items-center gap-1 font-medium">
                  {LOCATION_ICONS[fromLocation.type] ?? (
                    <Warehouse className="h-4 w-4" />
                  )}
                  {fromLocation.name}
                </span>
                <ArrowRight className="h-4 w-4" />
                <span className="flex items-center gap-1 font-medium">
                  {LOCATION_ICONS[toLocation.type] ?? (
                    <Warehouse className="h-4 w-4" />
                  )}
                  {toLocation.name}
                </span>
              </div>
            )}
          </section>

          {/* Items */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                Items to transfer
              </h2>
              <button
                type="button"
                disabled={!form.fromLocationId}
                onClick={() => setPickerOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Plus className="h-3.5 w-3.5" />
                Add product
              </button>
            </div>

            {!form.fromLocationId && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Select a source location first to load available stock.
              </p>
            )}

            {/* Picker */}
            {pickerOpen && form.fromLocationId && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by product name or SKU…"
                    className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                  {inventoryLoading ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading stock…
                    </div>
                  ) : filteredInventory.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500">
                      No inventory found for this location.
                    </p>
                  ) : (
                    filteredInventory.map((row) => {
                      // ✅ Narrow once so both usages below see a defined product.
                      const product = row.product;
                      const name = product?.name ?? 'Unknown product';
                      const sku = row.variant?.sku ?? product?.sku ?? '—';
                      const variant = row.variant?.name;
                      const out = row.available <= 0;
                      return (
                        <button
                          key={row.id}
                          type="button"
                          disabled={out || !product}
                          onClick={() => addLine(row)}
                          className="flex w-full items-center justify-between border-b border-gray-100 px-3 py-2 text-left last:border-b-0 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {name}
                              {variant ? (
                                <span className="ml-1 text-gray-500">
                                  · {variant}
                                </span>
                              ) : null}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                              SKU: {sku}
                            </p>
                          </div>
                          <span
                            className={`ml-3 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                              out
                                ? 'bg-red-100 text-red-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {row.available} available
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Lines table */}
            {lines.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">
                No items added yet.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">
                        Product
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        SKU
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Available
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Qty
                      </th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => {
                      const over = line.quantity > line.available;
                      return (
                        <tr
                          key={line.key}
                          className="border-t border-gray-100"
                        >
                          <td className="px-3 py-2 text-gray-900">
                            {line.productName}
                          </td>
                          <td className="px-3 py-2 text-gray-500">
                            {line.sku}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-500">
                            {line.available}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={1}
                              max={line.available}
                              value={line.quantity}
                              onChange={(e) =>
                                updateLineQty(
                                  line.key,
                                  parseInt(e.target.value, 10)
                                )
                              }
                              className={`w-20 rounded-md border px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                over ? 'border-red-400' : 'border-gray-300'
                              }`}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeLine(line.key)}
                              className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              aria-label={`Remove ${line.productName}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {errors.lines && (
              <p className="mt-2 flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                {errors.lines}
              </p>
            )}
          </section>

          {/* Metadata */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">
              Transfer details
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Reference
                </label>
                <input
                  value={form.reference}
                  onChange={(e) => setField('reference', e.target.value)}
                  placeholder="e.g. TRF-2024-001"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Carrier / handler
                </label>
                <input
                  value={form.carrier}
                  onChange={(e) => setField('carrier', e.target.value)}
                  placeholder="e.g. Internal van, DHL"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Expected arrival
                </label>
                <input
                  type="date"
                  value={form.expectedArrival}
                  onChange={(e) =>
                    setField('expectedArrival', e.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  placeholder="Optional notes for this transfer…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </section>
        </div>

        {/* ------------------------------- */}
        {/* RIGHT / SUMMARY                 */}
        {/* ------------------------------- */}
        <aside className="space-y-4 lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">
                Summary
              </h2>

              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">From</dt>
                  <dd className="font-medium text-gray-900">
                    {fromLocation?.name ?? '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">To</dt>
                  <dd className="font-medium text-gray-900">
                    {toLocation?.name ?? '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">Line items</dt>
                  <dd className="font-medium text-gray-900">
                    {lines.length}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                  <dt className="text-gray-500">Total units</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {totalUnits}
                  </dd>
                </div>
              </dl>

              {hasStockWarning && (
                <p className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  One or more lines exceed the available stock at the source
                  location.
                </p>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || hasStockWarning || lines.length === 0}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm transfer
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => router.back()}
                disabled={submitting}
                className="mt-2 w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            {/* Help note */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
              <p className="mb-1 font-medium text-gray-700">How transfers work</p>
              <p>
                Stock is deducted from the source and added to the
                destination in a single atomic operation. Both locations
                must belong to the same business unit.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
