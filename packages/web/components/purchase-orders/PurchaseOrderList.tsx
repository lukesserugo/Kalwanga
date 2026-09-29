// packages/web/components/purchase-orders/PurchaseOrderList.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  RefreshCw,
  Loader2,
} from 'lucide-react';

import { purchaseOrderService } from '../../services/purchaseOrderService';
import { Table } from '../common/Table';
import { Pagination } from '../common/Pagination';
import { Modal } from '../common/Modal';
import { toast } from '../../utils/toast-manager';

// ============================================
// TYPES
// ============================================

interface PurchaseOrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  total: number;
  receivedQuantity: number;
  product?: {
    id: string;
    name: string;
    sku: string;
  };
}

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplier?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  status: string;
  total: number;
  notes?: string;
  expectedDelivery?: string;
  receivedAt?: string;
  receivedBy?: string;
  receiver?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  businessUnitId: string;
  userId: string;
  items?: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

type FilterStatus =
  | ''
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'ORDERED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

// ============================================
// STATIC CLASS MAPS (Tailwind can't see dynamic classes)
// ============================================
//
// Template literals like `bg-${color}-100` are invisible to
// Tailwind's source scanner — the classes never make it into the
// compiled stylesheet, and every badge renders unstyled. These maps
// keep each combination as a literal string.

const STATUS_BADGE_CLASSES: Record<string, string> = {
  RECEIVED:
    'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
  PARTIALLY_RECEIVED:
    'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
  PENDING:
    'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
  APPROVED:
    'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300',
  ORDERED:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  DRAFT:
    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  CANCELLED:
    'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
};

const DEFAULT_BADGE_CLASSES =
  'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

// ============================================
// HELPERS
// ============================================

function extractErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  const anyErr = error as any;
  const data = anyErr?.response?.data;

  if (data) {
    if (typeof data.error === 'string') return data.error;
    if (data.error?.message) return String(data.error.message);
    if (data.message) return String(data.message);
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors
        .map((e: any) => `${e.field ?? 'field'}: ${e.message ?? 'invalid'}`)
        .join(', ');
    }
  }

  if (anyErr?.message) return String(anyErr.message);
  return fallback;
}

/**
 * Normalize the response from `getAllPurchaseOrders` into a
 * consistent shape. Handles:
 *
 *   1. `{ data, total, page, totalPages, limit }`
 *   2. `{ data, pagination: { … } }`
 *   3. A bare array
 *   4. A wrapped axios response `{ data: { … } }`
 */
function normalizeListResponse(
  raw: unknown,
  fallbackLimit: number,
): PaginatedResponse<PurchaseOrder> {
  const unwrap = (v: unknown): any => {
    if (v && typeof v === 'object' && 'data' in (v as any)) {
      const inner = (v as any).data;
      // Only unwrap one level — a real list payload won't have
      // `data.data` unless it's double-wrapped.
      if (
        inner &&
        typeof inner === 'object' &&
        !Array.isArray(inner) &&
        'data' in inner
      ) {
        return inner;
      }
      return inner;
    }
    return v;
  };

  const body = unwrap(raw) as any;

  const items: PurchaseOrder[] = Array.isArray(body)
    ? body
    : Array.isArray(body?.data)
    ? body.data
    : Array.isArray(body?.orders)
    ? body.orders
    : [];

  const pagination = body?.pagination ?? body?.meta ?? body ?? {};

  const total =
    typeof pagination.total === 'number' ? pagination.total : items.length;
  const limit =
    typeof pagination.limit === 'number'
      ? pagination.limit
      : fallbackLimit;
  const page =
    typeof pagination.page === 'number' ? pagination.page : 1;
  const totalPages =
    typeof pagination.totalPages === 'number'
      ? pagination.totalPages
      : Math.max(1, Math.ceil(total / (limit || 1)));

  return { data: items, total, page, totalPages, limit };
}

// ============================================
// PURE PRESENTATION HELPERS (module scope — stable identity)
// ============================================

function getStatusIcon(status: string) {
  switch (status) {
    case 'RECEIVED':
      return CheckCircle;
    case 'PARTIALLY_RECEIVED':
      return Clock;
    case 'PENDING':
      return Clock;
    case 'APPROVED':
      return CheckCircle;
    case 'ORDERED':
      return Truck;
    case 'DRAFT':
      return Package;
    case 'CANCELLED':
      return XCircle;
    default:
      return Package;
  }
}

function getStatusBadgeClasses(status: string): string {
  return STATUS_BADGE_CLASSES[status] ?? DEFAULT_BADGE_CLASSES;
}

function isOverdue(order: PurchaseOrder): boolean {
  if (!order.expectedDelivery) return false;
  if (order.status === 'RECEIVED' || order.status === 'CANCELLED') {
    return false;
  }
  return new Date(order.expectedDelivery).getTime() < Date.now();
}

// ============================================
// COMPONENT
// ============================================

export function PurchaseOrderList() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<{
    search: string;
    status: FilterStatus;
    supplierId: string;
    startDate: string;
    endDate: string;
  }>({
    search: '',
    status: '',
    supplierId: '',
    startDate: '',
    endDate: '',
  });

  /**
   * The search input is debounced — `debouncedSearch` lags
   * `filters.search` by 500ms so typing doesn't fire a request per
   * keystroke.
   */
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 20,
  });

  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [receivedItems, setReceivedItems] = useState<Record<string, number>>({});
  const [receiving, setReceiving] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const mountedRef = useRef(true);
  const fetchRequestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Debounce the search ───────────────────────────────────
  //
  // Without this, the search effect fires one fetch per keystroke.
  // On a fast typist, that's dozens of concurrent requests, all
  // racing — and the wrong one often wins.

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 500);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // Reset to page 1 whenever the effective filter set changes.
  useEffect(() => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [
    debouncedSearch,
    filters.status,
    filters.supplierId,
    filters.startDate,
    filters.endDate,
  ]);

  // ── Load ──────────────────────────────────────────────────

  const loadOrders = useCallback(async () => {
    const requestId = ++fetchRequestIdRef.current;

    try {
      setLoading(true);

      const result = await purchaseOrderService.getAllPurchaseOrders({
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch || undefined,
        status: filters.status || undefined,
        supplierId: filters.supplierId || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });

      if (requestId !== fetchRequestIdRef.current) return;
      if (!mountedRef.current) return;

      const normalized = normalizeListResponse(result, pagination.limit);
      setOrders(normalized.data);
      setPagination((prev) => ({
        ...prev,
        total: normalized.total,
        totalPages: normalized.totalPages,
      }));
    } catch (error) {
      if (requestId !== fetchRequestIdRef.current) return;
      if (!mountedRef.current) return;

      const message = extractErrorMessage(
        error,
        'Failed to load purchase orders',
      );
      console.error('[PurchaseOrderList] load failed:', message);
      toast.error(message);
      setOrders([]);
    } finally {
      if (requestId === fetchRequestIdRef.current && mountedRef.current) {
        setLoading(false);
      }
    }
  }, [
    pagination.page,
    pagination.limit,
    debouncedSearch,
    filters.status,
    filters.supplierId,
    filters.startDate,
    filters.endDate,
  ]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  // ── Receive ───────────────────────────────────────────────

  const openReceiveModal = useCallback((order: PurchaseOrder) => {
    const initial: Record<string, number> = {};
    for (const item of order.items ?? []) {
      const remaining = Math.max(
        0,
        (item.quantity ?? 0) - (item.receivedQuantity ?? 0),
      );
      initial[item.id] = remaining;
    }
    setReceivedItems(initial);
    setSelectedOrder(order);
    setShowReceiveModal(true);
  }, []);

  const handleReceive = useCallback(async () => {
    if (!selectedOrder) return;

    const items = (selectedOrder.items ?? [])
      .map((item) => ({
        itemId: item.id,
        quantity: receivedItems[item.id] ?? 0,
      }))
      .filter((item) => item.quantity > 0);

    if (items.length === 0) {
      toast.warning('Please enter quantities for at least one item');
      return;
    }

    setReceiving(true);
    try {
      await purchaseOrderService.receivePurchaseOrder(
        selectedOrder.id,
        items,
      );
      if (!mountedRef.current) return;

      toast.success('Purchase order received successfully');
      setShowReceiveModal(false);
      setSelectedOrder(null);
      setReceivedItems({});
      void loadOrders();
    } catch (error) {
      if (!mountedRef.current) return;
      const message = extractErrorMessage(
        error,
        'Failed to receive purchase order',
      );
      console.error('[PurchaseOrderList] receive failed:', message);
      toast.error(message);
    } finally {
      if (mountedRef.current) setReceiving(false);
    }
  }, [selectedOrder, receivedItems, loadOrders]);

  // ── Cancel ────────────────────────────────────────────────

  const openCancelModal = useCallback((order: PurchaseOrder) => {
    // Reset the reason so a previous cancellation's text doesn't
    // leak into this one.
    setCancelReason('');
    setSelectedOrder(order);
    setShowCancelModal(true);
  }, []);

  const handleCancel = useCallback(async () => {
    if (!selectedOrder) return;

    setCancelling(true);
    try {
      await purchaseOrderService.cancelPurchaseOrder(
        selectedOrder.id,
        cancelReason.trim(),
      );
      if (!mountedRef.current) return;

      toast.success('Purchase order cancelled');
      setShowCancelModal(false);
      setSelectedOrder(null);
      setCancelReason('');
      void loadOrders();
    } catch (error) {
      if (!mountedRef.current) return;
      const message = extractErrorMessage(
        error,
        'Failed to cancel purchase order',
      );
      console.error('[PurchaseOrderList] cancel failed:', message);
      toast.error(message);
    } finally {
      if (mountedRef.current) setCancelling(false);
    }
  }, [selectedOrder, cancelReason, loadOrders]);

  // ── Table columns ─────────────────────────────────────────

  const columns = useMemo(
    () => [
      {
        key: 'order',
        header: 'PO Number',
        render: (order: PurchaseOrder) => (
          <div>
            <p className="font-medium tabular-nums text-gray-900 dark:text-white">
              {order.orderNumber}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
        ),
      },
      {
        key: 'supplier',
        header: 'Supplier',
        render: (order: PurchaseOrder) => (
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {order.supplier?.name ?? '—'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {order.supplier?.email ?? ''}
            </p>
          </div>
        ),
      },
      {
        key: 'items',
        header: 'Items',
        render: (order: PurchaseOrder) => (
          <span className="tabular-nums text-gray-700 dark:text-gray-300">
            {order.items?.length ?? 0} items
          </span>
        ),
      },
      {
        key: 'total',
        header: 'Total',
        render: (order: PurchaseOrder) => (
          <span className="font-bold tabular-nums text-gray-900 dark:text-white">
            ${(order.total ?? 0).toFixed(2)}
          </span>
        ),
      },
      {
        key: 'delivery',
        header: 'Expected Delivery',
        render: (order: PurchaseOrder) => {
          if (!order.expectedDelivery) {
            return <span className="text-gray-400">N/A</span>;
          }
          const overdue = isOverdue(order);
          return (
            <div className="text-sm">
              <p className="tabular-nums text-gray-900 dark:text-white">
                {new Date(order.expectedDelivery).toLocaleDateString()}
              </p>
              <span
                className={`text-2xs ${
                  overdue
                    ? 'text-danger-600 dark:text-danger-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {overdue ? 'Overdue' : 'Pending'}
              </span>
            </div>
          );
        },
      },
      {
        key: 'status',
        header: 'Status',
        render: (order: PurchaseOrder) => {
          const StatusIcon = getStatusIcon(order.status);
          return (
            <span
              className={`px-2 py-1 rounded-full text-2xs font-medium inline-flex items-center gap-1 ${getStatusBadgeClasses(
                order.status,
              )}`}
            >
              <StatusIcon className="w-3 h-3" aria-hidden="true" />
              {order.status}
            </span>
          );
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (order: PurchaseOrder) => {
          const canReceive =
            order.status === 'PENDING' ||
            order.status === 'APPROVED' ||
            order.status === 'ORDERED' ||
            order.status === 'PARTIALLY_RECEIVED';

          return (
            <div className="flex items-center gap-2">
              <Link
                href={`/purchase-orders/${order.id}`}
                className="p-1 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded transition duration-250 focus-ring"
                aria-label={`View ${order.orderNumber}`}
              >
                <Eye
                  className="w-4 h-4 text-brand-600 dark:text-brand-400"
                  aria-hidden="true"
                />
              </Link>

              {canReceive && (
                <>
                  <button
                    type="button"
                    onClick={() => openReceiveModal(order)}
                    className="p-1 hover:bg-success-100 dark:hover:bg-success-900/30 rounded transition duration-250 focus-ring"
                    title="Receive PO"
                    aria-label={`Receive ${order.orderNumber}`}
                  >
                    <Truck
                      className="w-4 h-4 text-success-600 dark:text-success-400"
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => openCancelModal(order)}
                    className="p-1 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded transition duration-250 focus-ring"
                    title="Cancel PO"
                    aria-label={`Cancel ${order.orderNumber}`}
                  >
                    <XCircle
                      className="w-4 h-4 text-danger-600 dark:text-danger-400"
                      aria-hidden="true"
                    />
                  </button>
                </>
              )}

              {order.status === 'DRAFT' && (
                <Link
                  href={`/purchase-orders/${order.id}/edit`}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition duration-250 focus-ring"
                  aria-label={`Edit ${order.orderNumber}`}
                >
                  <Edit
                    className="w-4 h-4 text-gray-600 dark:text-gray-400"
                    aria-hidden="true"
                  />
                </Link>
              )}
            </div>
          );
        },
      },
    ],
    [openReceiveModal, openCancelModal],
  );

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Purchase Orders
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage all purchase orders
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadOrders()}
            disabled={loading}
            className="btn-secondary disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Refresh
          </button>
          <Link href="/purchase-orders/new" className="btn-brand">
            <Plus className="w-4 h-4" aria-hidden="true" />
            Create PO
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card-brand shadow-soft mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Search by PO number…"
                aria-label="Search purchase orders"
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
              />
            </div>
          </div>

          <select
            value={filters.status}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                status: e.target.value as FilterStatus,
              }))
            }
            aria-label="Filter by status"
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
          >
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="ORDERED">Ordered</option>
            <option value="PARTIALLY_RECEIVED">Partially Received</option>
            <option value="RECEIVED">Received</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <input
            type="date"
            value={filters.startDate}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, startDate: e.target.value }))
            }
            aria-label="Start date"
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
          />
          <span className="text-gray-500 dark:text-gray-400">to</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, endDate: e.target.value }))
            }
            aria-label="End date"
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card-brand shadow-soft p-0 overflow-hidden">
        <Table columns={columns} data={orders} loading={loading} />
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(page) =>
              setPagination((prev) => ({ ...prev, page }))
            }
          />
        </div>
      </div>

      {/* Receive Modal */}
      <Modal
        isOpen={showReceiveModal}
        onClose={() => {
          if (receiving) return;
          setShowReceiveModal(false);
          setSelectedOrder(null);
        }}
        title="Receive Purchase Order"
      >
        <div className="p-6">
          {selectedOrder && (
            <div className="mb-4">
              <p className="font-medium tabular-nums text-gray-900 dark:text-white">
                PO: {selectedOrder.orderNumber}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Supplier: {selectedOrder.supplier?.name ?? '—'}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {selectedOrder?.items?.map((item) => {
              const remaining = Math.max(
                0,
                (item.quantity ?? 0) - (item.receivedQuantity ?? 0),
              );
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-xl"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {item.product?.name ?? 'Unknown product'}
                    </p>
                    <p className="text-sm tabular-nums text-gray-500 dark:text-gray-400">
                      Ordered: {item.quantity} | Received:{' '}
                      {item.receivedQuantity ?? 0}
                    </p>
                  </div>
                  <div>
                    <label
                      htmlFor={`receive-${item.id}`}
                      className="block text-sm text-gray-600 dark:text-gray-400 mb-1"
                    >
                      Receive
                    </label>
                    <input
                      id={`receive-${item.id}`}
                      type="number"
                      value={receivedItems[item.id] ?? 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        const clamped = Number.isFinite(val)
                          ? Math.max(0, Math.min(val, remaining))
                          : 0;
                        setReceivedItems((prev) => ({
                          ...prev,
                          [item.id]: clamped,
                        }));
                      }}
                      min="0"
                      max={remaining}
                      disabled={receiving}
                      className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 disabled:opacity-50"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => {
                setShowReceiveModal(false);
                setSelectedOrder(null);
              }}
              disabled={receiving}
              className="btn-secondary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleReceive()}
              disabled={receiving}
              className="btn-success disabled:opacity-50 flex items-center gap-2"
            >
              {receiving ? (
                <>
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    aria-hidden="true"
                  />
                  Receiving…
                </>
              ) : (
                'Receive Items'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => {
          if (cancelling) return;
          setShowCancelModal(false);
          setSelectedOrder(null);
        }}
        title="Cancel Purchase Order"
      >
        <div className="p-6">
          {selectedOrder && (
            <div className="mb-4">
              <p className="font-medium tabular-nums text-gray-900 dark:text-white">
                PO: {selectedOrder.orderNumber}
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="cancel-reason"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Reason for Cancellation
            </label>
            <textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              disabled={cancelling}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 resize-none disabled:opacity-50"
              placeholder="Reason for cancellation…"
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => {
                setShowCancelModal(false);
                setSelectedOrder(null);
              }}
              disabled={cancelling}
              className="btn-secondary disabled:opacity-50"
            >
              Keep Order
            </button>
            <button
              type="button"
              onClick={() => void handleCancel()}
              disabled={cancelling}
              className="px-4 py-2 bg-gradient-to-r from-danger-600 to-brand-accent-500 hover:from-danger-700 hover:to-brand-accent-600 text-white rounded-xl transition duration-250 flex items-center gap-2 focus-ring shadow-brand disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelling ? (
                <>
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    aria-hidden="true"
                  />
                  Cancelling…
                </>
              ) : (
                'Cancel PO'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default PurchaseOrderList;
