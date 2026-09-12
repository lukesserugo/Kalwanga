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
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  PROCESSING:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  PENDING:
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  CANCELLED:
    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  REFUNDED:
    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  ON_HOLD:
    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
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
          <p className="font-medium text-gray-900 dark:text-white">
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
        <span className="text-gray-700 dark:text-gray-300">
          {order.items?.length || 0} items
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (order: Order) => (
        <div>
          <p className="font-bold text-gray-900 dark:text-white">
            ${order.total.toFixed(2)}
          </p>
          {order.discount > 0 && (
            <p className="text-sm text-green-600 dark:text-green-400">
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
            className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${badgeClasses}`}
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
            className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
            title="View order"
          >
            <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </Link>

          <button
            onClick={() => {
              setSelectedOrder(order);
              setNewStatus(order.status);
              setShowStatusModal(true);
            }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Update status"
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
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
              title="Cancel order"
            >
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            </button>
          )}

          {order.status === 'PENDING' && (
            <button
              onClick={() => handleConvert(order.id)}
              disabled={processing}
              className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors disabled:opacity-50"
              title="Convert to Sale"
            >
              <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
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
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors duration-200">
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
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Order
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6 transition-colors duration-200">
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none transition-colors duration-200"
              />
            </div>
          </div>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, startDate: e.target.value }))
            }
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none transition-colors duration-200"
          />
          <span className="text-gray-500 dark:text-gray-400">to</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, endDate: e.target.value }))
            }
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none transition-colors duration-200"
          />
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, status: e.target.value }))
            }
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none transition-colors duration-200"
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors duration-200">
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
        <div className="p-6 bg-white dark:bg-gray-800 transition-colors duration-200">
          {selectedOrder && (
            <div className="mb-4">
              <p className="font-medium text-gray-900 dark:text-white">
                Order: #{selectedOrder.orderNumber}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
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
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none transition-colors duration-200"
              placeholder="Reason for cancellation..."
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowCancelModal(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleCancel}
              disabled={processing || !cancelReason.trim()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2"
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
        <div className="p-6 bg-white dark:bg-gray-800 transition-colors duration-200">
          {selectedOrder && (
            <div className="mb-4">
              <p className="font-medium text-gray-900 dark:text-white">
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none transition-colors duration-200"
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
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleStatusUpdate}
              disabled={processing || !newStatus}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2"
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
