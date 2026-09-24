// D:\Projects\Kalwanga\packages\web\src\components\orders\OrderList.tsx

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Plus,
  Eye,
  Edit,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { orderService } from '../../services/orderService';
import type {
  Order,
  OrderSearchParams,
} from '../../types/order';
import { OrderStatus } from '../../types/enums';
import { Table } from '../common/Table';
import { Pagination } from '../common/Pagination';
import { Modal } from '../common/Modal';
import { toast } from '../../utils/toast-manager';
import { formatCurrency } from '../../utils/formatters';

// ============================================
// CONSTANTS
// ============================================

const STATUS_BADGE_CLASSES: Record<string, string> = {
  COMPLETED:
    'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
  PROCESSING:
    'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  PENDING:
    'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
  CANCELLED:
    'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
  REFUNDED:
    'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300',
  ON_HOLD:
    'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
};

const STATUS_BADGE_FALLBACK =
  'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';

/**
 * Statuses a user can set from the status-update modal.
 *
 * `CANCELLED` is excluded — the backend requires a `reason` for
 * cancellation, which the cancel modal collects. Offering it here
 * would bypass that requirement.
 */
const UPDATABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PROCESSING,
  OrderStatus.COMPLETED,
  OrderStatus.REFUNDED,
  OrderStatus.ON_HOLD,
];

/**
 * Statuses that can still be cancelled via the cancel modal.
 */
const CANCELLABLE_STATUSES = new Set<string>([
  OrderStatus.PENDING,
  OrderStatus.PROCESSING,
  OrderStatus.ON_HOLD,
]);

/**
 * Statuses eligible for conversion to a sale.
 */
const CONVERTIBLE_STATUSES = new Set<string>([OrderStatus.PENDING]);

// ============================================
// MAIN COMPONENT
// ============================================

export function OrderList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    search: '',
    status: '' as OrderStatus | '',
    startDate: '',
    endDate: '',
  });

  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 20,
  });

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [newStatus, setNewStatus] = useState<OrderStatus | ''>('');

  /** Tracks which row is currently in flight for action buttons. */
  const [processingId, setProcessingId] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);

      const params: OrderSearchParams = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.startDate) {
        params.startDate = new Date(filters.startDate).toISOString();
      }
      if (filters.endDate) {
        // Extend the end date to the end of the chosen day.
        params.endDate = new Date(
          `${filters.endDate}T23:59:59.999Z`,
        ).toISOString();
      }

      const result = await orderService.getAllOrders(params);
      if (!isMountedRef.current) return;

      setOrders(result.data);
      setPagination((prev) => ({
        ...prev,
        total: result.pagination.total,
        totalPages: result.pagination.totalPages,
      }));
    } catch (error: any) {
      if (!isMountedRef.current) return;
      console.error('Failed to load orders:', error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to load orders',
      );
      setOrders([]);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    if (!isMountedRef.current) return;
    void loadOrders();
  }, [loadOrders]);

  /**
   * Reset to page 1 whenever any filter changes. Previously filtering
   * on page 5 returned an empty list because the fetch kept the old
   * page number.
   */
  const updateFilter = useCallback(
    <K extends keyof typeof filters>(
      key: K,
      value: (typeof filters)[K],
    ) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    [],
  );

  // ============================================
  // HANDLERS
  // ============================================

  const handleCancel = useCallback(async () => {
    if (!selectedOrder || !cancelReason.trim()) return;

    setProcessingId(selectedOrder.id);
    try {
      await orderService.cancelOrder(selectedOrder.id, cancelReason.trim());
      toast.success('Order cancelled');
      setShowCancelModal(false);
      setCancelReason('');
      setSelectedOrder(null);
      await loadOrders();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to cancel order',
      );
    } finally {
      if (isMountedRef.current) setProcessingId(null);
    }
  }, [selectedOrder, cancelReason, loadOrders]);

  const handleStatusUpdate = useCallback(async () => {
    if (!selectedOrder || !newStatus) return;

    setProcessingId(selectedOrder.id);
    try {
      await orderService.updateOrderStatus(selectedOrder.id, newStatus);
      toast.success('Order status updated');
      setShowStatusModal(false);
      setNewStatus('');
      setSelectedOrder(null);
      await loadOrders();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to update status',
      );
    } finally {
      if (isMountedRef.current) setProcessingId(null);
    }
  }, [selectedOrder, newStatus, loadOrders]);

  const handleConvert = useCallback(
    async (orderId: string) => {
      setProcessingId(orderId);
      try {
        await orderService.convertOrderToSale(orderId);
        toast.success('Order converted to sale');
        await loadOrders();
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message ||
            error?.message ||
            'Failed to convert order',
        );
      } finally {
        if (isMountedRef.current) setProcessingId(null);
      }
    },
    [loadOrders],
  );

  // ============================================
  // HELPERS
  // ============================================

  const getStatusBadgeClasses = (status: string) =>
    STATUS_BADGE_CLASSES[status] || STATUS_BADGE_FALLBACK;

  const getStatusIcon = (status: string): React.ElementType => {
    switch (status) {
      case OrderStatus.COMPLETED:
        return CheckCircle;
      case OrderStatus.PROCESSING:
        return RefreshCw;
      case OrderStatus.PENDING:
        return Clock;
      case OrderStatus.CANCELLED:
        return XCircle;
      case OrderStatus.REFUNDED:
        return AlertCircle;
      case OrderStatus.ON_HOLD:
        return Clock;
      default:
        return Package;
    }
  };

  // ============================================
  // TABLE COLUMNS
  // ============================================

  const columns = useMemo(
    () => [
      {
        key: 'order',
        header: 'Order',
        render: (order: Order) => (
          <div>
            <p className="font-medium tabular-nums text-gray-900 dark:text-white">
              #{order.orderNumber}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
        ),
      },
      {
        key: 'customer',
        header: 'Customer',
        render: (order: Order) => (
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {order.customer
                ? `${order.customer.firstName} ${order.customer.lastName}`.trim()
                : 'Guest'}
            </p>
            {order.customer?.email && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {order.customer.email}
              </p>
            )}
          </div>
        ),
      },
      {
        key: 'items',
        header: 'Items',
        render: (order: Order) => (
          <span className="tabular-nums text-gray-700 dark:text-gray-300">
            {order.items?.length || 0} items
          </span>
        ),
      },
      {
        key: 'total',
        header: 'Total',
        render: (order: Order) => (
          <div>
            <p className="font-bold tabular-nums text-gray-900 dark:text-white">
              {formatCurrency(order.total)}
            </p>
            {order.discount > 0 && (
              <p className="text-sm tabular-nums text-success-600 dark:text-success-400">
                -{formatCurrency(order.discount)}
              </p>
            )}
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (order: Order) => {
          const StatusIcon = getStatusIcon(order.status);
          const badgeClasses = getStatusBadgeClasses(order.status);
          return (
            <span
              className={`px-2 py-1 rounded-full text-2xs font-medium inline-flex items-center gap-1 ${badgeClasses}`}
            >
              <StatusIcon className="w-3 h-3" />
              {order.status}
            </span>
          );
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (order: Order) => {
          const isProcessing = processingId === order.id;
          const canCancel = CANCELLABLE_STATUSES.has(order.status);
          const canConvert = CONVERTIBLE_STATUSES.has(order.status);

          return (
            <div className="flex items-center gap-2">
              <Link
                href={`/admin/orders/${order.id}`}
                className="p-1 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded transition duration-250 focus-ring"
                title="View order"
                aria-label={`View order ${order.orderNumber}`}
              >
                <Eye className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              </Link>

              <button
                type="button"
                onClick={() => {
                  setSelectedOrder(order);
                  setNewStatus(order.status);
                  setShowStatusModal(true);
                }}
                disabled={isProcessing}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition duration-250 focus-ring disabled:opacity-50"
                title="Update status"
                aria-label={`Update status for order ${order.orderNumber}`}
              >
                <Edit className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>

              {canCancel && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrder(order);
                    setCancelReason('');
                    setShowCancelModal(true);
                  }}
                  disabled={isProcessing}
                  className="p-1 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded transition duration-250 focus-ring disabled:opacity-50"
                  title="Cancel order"
                  aria-label={`Cancel order ${order.orderNumber}`}
                >
                  <XCircle className="w-4 h-4 text-danger-600 dark:text-danger-400" />
                </button>
              )}

              {canConvert && (
                <button
                  type="button"
                  onClick={() => handleConvert(order.id)}
                  disabled={isProcessing}
                  className="p-1 hover:bg-success-100 dark:hover:bg-success-900/30 rounded transition duration-250 focus-ring disabled:opacity-50"
                  title="Convert to Sale"
                  aria-label={`Convert order ${order.orderNumber} to sale`}
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin text-success-600 dark:text-success-400" />
                  ) : (
                    <TrendingUp className="w-4 h-4 text-success-600 dark:text-success-400" />
                  )}
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [processingId, handleConvert],
  );

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen transition duration-250 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Orders
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage all customer orders
          </p>
        </div>

        <Link href="/admin/orders/create" className="btn-brand">
          <Plus className="w-4 h-4" />
          Create Order
        </Link>
      </div>

      {/* Filters */}
      <div className="card-brand shadow-soft mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by order number..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:outline-none transition duration-250"
              />
            </div>
          </div>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => updateFilter('startDate', e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition duration-250 tabular-nums"
            aria-label="Start date"
          />
          <span className="text-gray-500 dark:text-gray-400">to</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => updateFilter('endDate', e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition duration-250 tabular-nums"
            aria-label="End date"
          />
          <select
            value={filters.status}
            onChange={(e) =>
              updateFilter('status', e.target.value as OrderStatus | '')
            }
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition duration-250"
            aria-label="Order status"
          >
            <option value="">All Status</option>
            <option value={OrderStatus.PENDING}>Pending</option>
            <option value={OrderStatus.PROCESSING}>Processing</option>
            <option value={OrderStatus.COMPLETED}>Completed</option>
            <option value={OrderStatus.CANCELLED}>Cancelled</option>
            <option value={OrderStatus.REFUNDED}>Refunded</option>
            <option value={OrderStatus.ON_HOLD}>On Hold</option>
          </select>
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

      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Order"
      >
        <div className="p-6 bg-white dark:bg-gray-800 transition duration-250">
          {selectedOrder && (
            <div className="mb-4">
              <p className="font-medium tabular-nums text-gray-900 dark:text-white">
                Order: #{selectedOrder.orderNumber}
              </p>
              <p className="text-sm tabular-nums text-gray-600 dark:text-gray-400">
                Total: {formatCurrency(selectedOrder.total)}
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason for Cancellation
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:outline-none transition duration-250 resize-none"
              placeholder="Reason for cancellation..."
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => setShowCancelModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={
                processingId === selectedOrder?.id || !cancelReason.trim()
              }
              className="px-4 py-2 bg-gradient-to-r from-danger-600 to-brand-accent-500 hover:from-danger-700 hover:to-brand-accent-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-250 flex items-center gap-2 focus-ring shadow-brand"
            >
              {processingId === selectedOrder?.id && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Cancel Order
            </button>
          </div>
        </div>
      </Modal>

      {/* Status Update Modal */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="Update Order Status"
      >
        <div className="p-6 bg-white dark:bg-gray-800 transition duration-250">
          {selectedOrder && (
            <div className="mb-4">
              <p className="font-medium tabular-nums text-gray-900 dark:text-white">
                Order: #{selectedOrder.orderNumber}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Current Status: {selectedOrder.status}
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              New Status
            </label>
            <select
              value={newStatus}
              onChange={(e) =>
                setNewStatus(e.target.value as OrderStatus | '')
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition duration-250"
            >
              <option value="">Select Status</option>
              {UPDATABLE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status
                    .split('_')
                    .map(
                      (w) => w.charAt(0) + w.slice(1).toLowerCase(),
                    )
                    .join(' ')}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              To cancel an order, use the cancel action so a reason
              can be captured.
            </p>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => setShowStatusModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStatusUpdate}
              disabled={processingId === selectedOrder?.id || !newStatus}
              className="btn-brand disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingId === selectedOrder?.id && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Update Status
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default OrderList;
