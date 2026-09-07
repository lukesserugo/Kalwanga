// src/components/orders/OrderList.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Plus, Eye, Edit, Trash2, Package,
  CheckCircle, XCircle, Clock, AlertCircle,
  TrendingUp, Filter, Download, RefreshCw
} from 'lucide-react';
import { orderService } from '../../services/orderService';
import { Table } from '../common/Table';
import { Pagination } from '../common/Pagination';
import { Modal } from '../common/Modal';
import { toast } from '../../utils/toast-manager';
import { OrderStatus } from '../../types/enums';

// Define Order type
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

  useEffect(() => {
    loadOrders();
  }, [filters, pagination.page]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      // Build params with proper status type
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search,
      };
      
      // Only add status if it has a value
      if (filters.status) {
        params.status = filters.status as OrderStatus;
      }
      
      if (filters.startDate) {
        params.startDate = filters.startDate;
      }
      if (filters.endDate) {
        params.endDate = filters.endDate;
      }

      const result = await orderService.getAllOrders(params);
      setOrders(result.data || []);
      setPagination({
        ...pagination,
        total: result.total || 0,
        totalPages: result.totalPages || 1,
      });
    } catch (error) {
      console.error('Failed to load orders:', error);
      toast.error('Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedOrder) return;
    try {
      await orderService.cancelOrder(selectedOrder.id, cancelReason);
      toast.success('Order cancelled');
      setShowCancelModal(false);
      loadOrders();
    } catch (error) {
      toast.error('Failed to cancel order');
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedOrder || !newStatus) return;
    try {
      await orderService.updateOrderStatus(selectedOrder.id, newStatus);
      toast.success('Order status updated');
      setShowStatusModal(false);
      loadOrders();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleConvert = async (orderId: string) => {
    try {
      await orderService.convertOrderToSale(orderId);
      toast.success('Order converted to sale');
      loadOrders();
    } catch (error) {
      toast.error('Failed to convert order');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'green';
      case 'PROCESSING': return 'blue';
      case 'PENDING': return 'yellow';
      case 'CANCELLED': return 'red';
      case 'REFUNDED': return 'purple';
      case 'ON_HOLD': return 'orange';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return CheckCircle;
      case 'PROCESSING': return RefreshCw;
      case 'PENDING': return Clock;
      case 'CANCELLED': return XCircle;
      case 'REFUNDED': return AlertCircle;
      case 'ON_HOLD': return Clock;
      default: return Package;
    }
  };

  const columns = [
    {
      key: 'order',
      header: 'Order',
      render: (order: Order) => (
        <div>
          <p className="font-medium text-gray-900">#{order.orderNumber}</p>
          <p className="text-sm text-gray-500">
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
          <p className="font-medium">
            {order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'Guest'}
          </p>
          {order.customer && (
            <p className="text-sm text-gray-500">{order.customer.email}</p>
          )}
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      render: (order: Order) => (
        <span>{order.items?.length || 0} items</span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (order: Order) => (
        <div>
          <p className="font-bold text-gray-900">${order.total.toFixed(2)}</p>
          {order.discount > 0 && (
            <p className="text-sm text-green-600">-${order.discount.toFixed(2)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (order: Order) => {
        const StatusIcon = getStatusIcon(order.status);
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${getStatusColor(order.status)}-100 text-${getStatusColor(order.status)}-700 inline-flex items-center gap-1`}>
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
            to={`/orders/${order.id}`}
            className="p-1 hover:bg-blue-100 rounded transition-colors"
          >
            <Eye className="w-4 h-4 text-blue-600" />
          </Link>
          <button
            onClick={() => {
              setSelectedOrder(order);
              setShowStatusModal(true);
            }}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <Edit className="w-4 h-4 text-gray-600" />
          </button>
          {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
            <button
              onClick={() => {
                setSelectedOrder(order);
                setShowCancelModal(true);
              }}
              className="p-1 hover:bg-red-100 rounded transition-colors"
            >
              <XCircle className="w-4 h-4 text-red-600" />
            </button>
          )}
          {order.status === 'PENDING' && (
            <button
              onClick={() => handleConvert(order.id)}
              className="p-1 hover:bg-green-100 rounded transition-colors"
              title="Convert to Sale"
            >
              <TrendingUp className="w-4 h-4 text-green-600" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600 mt-1">Manage all customer orders</p>
        </div>
        <Link
          to="/orders/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Create Order
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by order number..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <Table
          columns={columns}
          data={orders}
          loading={loading}
        />
        <div className="border-t border-gray-200 p-4">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(page) => setPagination({ ...pagination, page })}
          />
        </div>
      </div>

      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Order"
      >
        <div className="p-6">
          {selectedOrder && (
            <div className="mb-4">
              <p className="font-medium">Order: #{selectedOrder.orderNumber}</p>
              <p className="text-sm text-gray-600">
                Total: ${selectedOrder.total.toFixed(2)}
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Cancellation
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Reason for cancellation..."
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowCancelModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
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
        <div className="p-6">
          {selectedOrder && (
            <div className="mb-4">
              <p className="font-medium">Order: #{selectedOrder.orderNumber}</p>
              <p className="text-sm text-gray-600">
                Current Status: {selectedOrder.status}
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Status
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleStatusUpdate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Update Status
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}