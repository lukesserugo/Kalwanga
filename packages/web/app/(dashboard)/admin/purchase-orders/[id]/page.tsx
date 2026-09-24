// src/app/(dashboard)/purchase-orders/[id]/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../services/api';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency } from '../../../../../utils/formatters';
import {
  ArrowLeftIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';

// ============================================
// TYPES
// ============================================
//
// Matches the `PurchaseOrder` model exposed by
// `GET /api/purchase-orders/:id` and the `PurchaseOrderStatus` enum:
//   DRAFT | PENDING | APPROVED | ORDERED |
//   PARTIALLY_RECEIVED | RECEIVED | CANCELLED | COMPLETED

type PurchaseOrderStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'ORDERED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED'
  | 'COMPLETED';

interface PurchaseOrderItem {
  id: string;
  quantity: number;
  receivedQuantity: number;
  unitPrice: number;
  total: number;
  product: {
    id: string;
    name: string;
    sku: string;
  } | null;
}

interface PurchaseOrderSupplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface PurchaseOrderDetail {
  id: string;
  orderNumber: string;
  supplier: PurchaseOrderSupplier | null;
  status: PurchaseOrderStatus;
  total: number;
  notes: string | null;
  expectedDelivery: string | null;
  receivedAt: string | null;
  createdAt: string;
  items: PurchaseOrderItem[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// ============================================
// HELPERS
// ============================================

const STATUS_COLORS: Record<string, string> = {
  DRAFT:
    'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
  PENDING:
    'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300',
  APPROVED:
    'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300',
  ORDERED:
    'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300',
  PARTIALLY_RECEIVED:
    'bg-brand-accent-100 text-brand-accent-800 dark:bg-brand-accent-900/30 dark:text-brand-accent-300',
  RECEIVED:
    'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300',
  COMPLETED:
    'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300',
  CANCELLED:
    'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-300',
};

const DEFAULT_STATUS_COLOR =
  'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  ORDERED: 'Ordered',
  PARTIALLY_RECEIVED: 'Partially Received',
  RECEIVED: 'Received',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const getStatusColor = (status: string): string =>
  STATUS_COLORS[status] || DEFAULT_STATUS_COLOR;

const getStatusLabel = (status: string): string =>
  STATUS_LABELS[status] || status;

const formatDateSafe = (date: string | Date | null | undefined): string => {
  if (!date) return 'N/A';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString();
  } catch {
    return 'N/A';
  }
};

const formatDateTimeSafe = (
  date: string | Date | null | undefined
): string => {
  if (!date) return 'N/A';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString();
  } catch {
    return 'N/A';
  }
};

/** Statuses where the receiving UI is active. */
const RECEIVABLE_STATUSES: ReadonlySet<PurchaseOrderStatus> = new Set([
  'PENDING',
  'APPROVED',
  'ORDERED',
  'PARTIALLY_RECEIVED',
]);

// ============================================
// MAIN COMPONENT
// ============================================

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id as string | undefined;

  const [order, setOrder] = useState<PurchaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [receiving, setReceiving] = useState(false);
  const [receiveQuantities, setReceiveQuantities] = useState<
    Record<string, number>
  >({});

  // ============================================
  // FETCH
  // ============================================

  const fetchOrder = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      const response = await api.get<ApiResponse<PurchaseOrderDetail>>(
        `/purchase-orders/${id}`
      );

      const orderData = response?.data;
      if (!orderData) {
        setOrder(null);
        return;
      }

      setOrder(orderData);

      const initialQuantities: Record<string, number> = {};
      orderData.items.forEach((item) => {
        const remaining = item.quantity - item.receivedQuantity;
        initialQuantities[item.id] = remaining > 0 ? remaining : 0;
      });
      setReceiveQuantities(initialQuantities);
    } catch (error: any) {
      console.error('Failed to load purchase order:', error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to load purchase order'
      );
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchOrder();
    }
  }, [id, fetchOrder]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleReceive = async () => {
    if (!order) return;

    try {
      setReceiving(true);

      const receivedItems = Object.entries(receiveQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([itemId, quantity]) => ({ itemId, quantity }));

      if (receivedItems.length === 0) {
        toast.error('No items to receive');
        return;
      }

      // Guard against receiving more than the remaining quantity.
      const overReceive = receivedItems.find(({ itemId, quantity }) => {
        const item = order.items.find((it) => it.id === itemId);
        if (!item) return true;
        const remaining = item.quantity - item.receivedQuantity;
        return quantity > remaining;
      });

      if (overReceive) {
        toast.error('Cannot receive more than ordered quantity');
        return;
      }

      const response = await api.post<ApiResponse<unknown>>(
        `/purchase-orders/${id}/receive`,
        { receivedQuantities: receivedItems }
      );

      if (response?.success) {
        toast.success('Purchase order received successfully');
        await fetchOrder();
      } else {
        toast.error(response?.message || 'Failed to receive order');
      }
    } catch (error: any) {
      console.error('Failed to receive purchase order:', error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to receive order'
      );
    } finally {
      setReceiving(false);
    }
  };

  const handleQuantityChange = (
    itemId: string,
    value: string,
    max: number
  ) => {
    const parsed = parseInt(value, 10);
    const safe = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    setReceiveQuantities((prev) => ({
      ...prev,
      [itemId]: Math.min(safe, max),
    }));
  };

  // ============================================
  // RENDER — LOADING
  // ============================================

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-b-2 border-brand-600 rounded-full"></div>
      </div>
    );
  }

  // ============================================
  // RENDER — NOT FOUND
  // ============================================

  if (!order) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        Purchase order not found
      </div>
    );
  }

  // ============================================
  // DERIVED
  // ============================================

  const canReceive = RECEIVABLE_STATUSES.has(order.status);
  const totalReceived = order.items.reduce(
    (sum, item) => sum + (item.receivedQuantity || 0),
    0
  );
  const totalOrdered = order.items.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0
  );

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-8 animate-fade-in">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4 transition duration-250 focus-ring rounded-lg px-2 py-1"
      >
        <ArrowLeftIcon className="w-5 h-5" />
        Back
      </button>

      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-mono tabular-nums text-brand-600 dark:text-brand-400">
            {order.orderNumber}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Created {formatDateSafe(order.createdAt)}
          </p>
          {order.notes && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              Notes: {order.notes}
            </p>
          )}
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
            order.status
          )}`}
        >
          {getStatusLabel(order.status)}
        </span>
      </div>

      {/* Supplier Info */}
      <div className="card-brand shadow-soft mb-6 animate-slide-down">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Supplier Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {order.supplier?.name || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {order.supplier?.email || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {order.supplier?.phone || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Expected Delivery
            </p>
            <p className="font-medium text-gray-900 dark:text-white">
              {formatDateSafe(order.expectedDelivery)}
            </p>
          </div>
        </div>
        {order.receivedAt && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Received At
            </p>
            <p className="font-medium text-gray-900 dark:text-white">
              {formatDateTimeSafe(order.receivedAt)}
            </p>
          </div>
        )}
      </div>

      {/* Progress summary */}
      <div className="card-brand shadow-soft mb-6 animate-slide-down">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total Items
            </p>
            <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
              {order.items.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Units Received
            </p>
            <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
              <span
                className={
                  totalReceived === totalOrdered
                    ? 'text-success-600 dark:text-success-400'
                    : 'text-warning-600 dark:text-warning-400'
                }
              >
                {totalReceived}
              </span>
              <span className="text-gray-400 dark:text-gray-500 text-lg">
                {' '}
                / {totalOrdered}
              </span>
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total Value
            </p>
            <p className="text-2xl font-bold tabular-nums text-brand-600 dark:text-brand-400">
              {formatCurrency(order.total)}
            </p>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="card-brand shadow-soft overflow-hidden animate-slide-down p-0">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Order Items
          </h2>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/30">
              <tr>
                <th className="px-6 py-3 text-left text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow">
                  SKU
                </th>
                <th className="px-6 py-3 text-right text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow">
                  Ordered
                </th>
                <th className="px-6 py-3 text-right text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow">
                  Received
                </th>
                <th className="px-6 py-3 text-right text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow">
                  Unit Price
                </th>
                <th className="px-6 py-3 text-right text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow">
                  Total
                </th>
                {canReceive && (
                  <th className="px-6 py-3 text-right text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow">
                    Receive Qty
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {order.items.map((item) => {
                const remaining =
                  (item.quantity || 0) - (item.receivedQuantity || 0);
                const isFullyReceived = remaining <= 0;

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-250"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {item.product?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono tabular-nums text-gray-500 dark:text-gray-400">
                      {item.product?.sku || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-right tabular-nums text-gray-900 dark:text-white">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 text-sm text-right tabular-nums">
                      <span
                        className={
                          isFullyReceived
                            ? 'text-success-600 dark:text-success-400 font-medium'
                            : 'text-gray-900 dark:text-white'
                        }
                      >
                        {item.receivedQuantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right tabular-nums text-gray-900 dark:text-white">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium tabular-nums text-gray-900 dark:text-white">
                      {formatCurrency(item.total)}
                    </td>
                    {canReceive && (
                      <td className="px-6 py-4 text-right">
                        {isFullyReceived ? (
                          <span className="text-success-600 dark:text-success-400 text-sm font-medium flex items-center justify-end gap-1">
                            ✓ Received
                          </span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            max={remaining}
                            value={receiveQuantities[item.id] ?? 0}
                            onChange={(e) =>
                              handleQuantityChange(
                                item.id,
                                e.target.value,
                                remaining
                              )
                            }
                            className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-right tabular-nums bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
                          />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700">
              <tr>
                <td
                  colSpan={canReceive ? 5 : 5}
                  className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white"
                >
                  Total:
                </td>
                <td className="px-6 py-4 text-right font-bold tabular-nums text-gray-900 dark:text-white">
                  {formatCurrency(order.total)}
                </td>
                {canReceive && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Actions */}
      {canReceive && (
        <div className="mt-6 flex flex-wrap gap-4 justify-end">
          <button
            onClick={handleReceive}
            disabled={receiving || totalReceived >= totalOrdered}
            className="btn-success inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <TruckIcon className="w-5 h-5" />
            {receiving ? 'Receiving...' : 'Receive Items'}
          </button>
        </div>
      )}

      {/* Order meta */}
      <div className="mt-8 card-brand shadow-soft animate-slide-down">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 eyebrow">
          Order Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">
              Order Number:
            </span>
            <span className="ml-2 font-mono tabular-nums text-gray-900 dark:text-white">
              {order.orderNumber}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Status:</span>
            <span
              className={`ml-2 px-2 py-0.5 rounded-full text-2xs font-medium ${getStatusColor(
                order.status
              )}`}
            >
              {getStatusLabel(order.status)}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">
              Total Items:
            </span>
            <span className="ml-2 font-medium tabular-nums text-gray-900 dark:text-white">
              {order.items.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
