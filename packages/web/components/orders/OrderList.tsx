// src/components/orders/OrderList.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { Table } from '../common/Table';
import { Pagination } from '../common/Pagination';
import { Modal } from '../common/Modal';
import { toast } from '../../utils/toast-manager';
import { OrderStatus } from '../../types/enums';

// ============================================
// TYPES
// ============================================

interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string;
  customerId?: string;
  customer?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  items?: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
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

// ============================================
// STATUS STYLE MAPS (light + dark)
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

// ============================================
// MAIN COMPONENT
// ============================================

export function OrderList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
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
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [processing, setProcessing] = useState(false);

  // ============================================
  // LOAD ORDERS
  // ============================================

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);

      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search || undefined,
      };

      if (filters.status) {
        params.status = filters.status as OrderStatus;
      }
      if (filters.startDate) {
        params.startDate = new Date(filters.startDate).toISOString();
      }
      if (filters.endDate) {
        params.endDate = new Date(
          `${filters.endDate}T23:59:59.999Z`
        ).toISOString();
      }

      const result = await orderService.getAllOrders(params);

      setOrders(result.data || []);
      setPagination((prev) => ({
        ...prev,
        total: result.total || 0,
        totalPages: result.totalPages || 1,
      }));
    } catch (error: any) {
      console.error('Failed to load orders:', error);
      toast.error(error?.message || 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleCancel = async () => {
    if (!selectedOrder || !cancelReason.trim()) return;
    try {
      setProcessing(true);
      await orderService.cancelOrder(selectedOrder.id, cancelReason);
      toast.success('Order cancelled');
      setShowCancelModal(false);
      setCancelReason('');
      setSelectedOrder(null);
      await loadOrders();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to cancel order');
    } finally {
      setProcessing(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedOrder || !newStatus) return;
    try {
      setProcessing(true);
      await orderService.updateOrderStatus(selectedOrder.id, newStatus);
      toast.success('Order status updated');
      setShowStatusModal(false);
      setNewStatus('');
      setSelectedOrder(null);
      await loadOrders();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update status');
    } finally {
      setProcessing(false);
    }
  };

  const handleConvert = async (orderId: string) => {
    try {
      setProcessing(true);
      await orderService.convertOrderToSale(orderId);
      toast.success('Order converted to sale');
      await loadOrders();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to convert order');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'green';
      case 'PROCESSING':
        return 'blue';
      case 'PENDING':
        return 'yellow';
      case 'CANCELLED':
        return 'red';
      case 'REFUNDED':
        return 'purple';
      case 'ON_HOLD':
        return 'orange';
      default:
        return 'gray';
    }
  };

  const getStatusBadgeClasses = (status: string) =>
    STATUS_BADGE_CLASSES[status] || STATUS_BADGE_FALLBACK;

  const getStatusIcon = (status: string): React.ElementType => {
    switch (status) {
      case 'COMPLETED':
        return CheckCircle;
      case 'PROCESSING':
        return RefreshCw;
      case 'PENDING':
        return Clock;
      case 'CANCELLED':
        return XCircle;
      case 'REFUNDED':
        return AlertCircle;
      case 'ON_HOLD':
        return Clock;
      default:
        return Package;
    }
  };

  // ============================================
  // TABLE COLUMNS
  // ============================================

  const columns = [
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
              ? `${order.customer.firstName} ${order.customer.lastName}`
              : 'Guest'}
          </p>
          {order.customer && (
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
            ${order.total.toFixed(2)}
          </p>
          {order.discount > 0 && (
            <p className="text-sm tabular-nums text-success-600 dark:text-success-400">
              -${order.discount.toFixed(2)}
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
      render: (order: Order) => (
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
            onClick={() => {
              setSelectedOrder(order);
              setNewStatus(order.status);
              setShowStatusModal(true);
            }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition duration-250 focus-ring"
            title="Update status"
            aria-label={`Update status for order ${order.orderNumber}`}
          >
            <Edit className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>

          {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
            <button
              onClick={() => {
                setSelectedOrder(order);
                setCancelReason('');
                setShowCancelModal(true);
              }}
              className="p-1 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded transition duration-250 focus-ring"
              title="Cancel order"
              aria-label={`Cancel order ${order.orderNumber}`}
            >
              <XCircle className="w-4 h-4 text-danger-600 dark:text-danger-400" />
            </button>
          )}

          {order.status === 'PENDING' && (
            <button
              onClick={() => handleConvert(order.id)}
              disabled={processing}
              className="p-1 hover:bg-success-100 dark:hover:bg-success-900/30 rounded transition duration-250 focus-ring disabled:opacity-50"
              title="Convert to Sale"
              aria-label={`Convert order ${order.orderNumber} to sale`}
            >
              <TrendingUp className="w-4 h-4 text-success-600 dark:text-success-400" />
            </button>
          )}
        </div>
      ),
    },
  ];

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

        <Link
          href="/admin/orders/create"
          className="btn-brand"
        >
          <Plus className="w-4 h-4" />
          Create Order
        </Link>
      </div>

      {/* Filters */}
      <div className="card-brand shadow-soft mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by order number..."
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:outline-none transition duration-250"
              />
            </div>
          </div>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, startDate: e.target.value }))
            }
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition duration-250 tabular-nums"
          />
          <span className="text-gray-500 dark:text-gray-400">to</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, endDate: e.target.value }))
            }
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition duration-250 tabular-nums"
          />
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, status: e.target.value }))
            }
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition duration-250"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REFUNDED">Refunded</option>
            <option value="ON_HOLD">On Hold</option>
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
                Total: ${selectedOrder.total.toFixed(2)}
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
              onClick={() => setShowCancelModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleCancel}
              disabled={processing || !cancelReason.trim()}
              className="px-4 py-2 bg-gradient-to-r from-danger-600 to-brand-accent-500 hover:from-danger-700 hover:to-brand-accent-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-250 flex items-center gap-2 focus-ring shadow-brand"
            >
              {processing && <Loader2 className="w-4 h-4 animate-spin" />}
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
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition duration-250"
            >
              <option value="">Select Status</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="ON_HOLD">On Hold</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowStatusModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleStatusUpdate}
              disabled={processing || !newStatus}
              className="btn-brand disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing && <Loader2 className="w-4 h-4 animate-spin" />}
              Update Status
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default OrderList;
