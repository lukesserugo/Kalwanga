// src/components/purchase-orders/PurchaseOrderList.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Plus, Eye, Edit, Trash2, Package,
  CheckCircle, XCircle, Clock, AlertCircle,
  Truck, Download, RefreshCw, Filter
} from 'lucide-react';
import { purchaseOrderService } from '../../services/purchaseOrderService';
import { Table } from '../common/Table';
import { Pagination } from '../common/Pagination';
import { Modal } from '../common/Modal';
import { toast } from '../../utils/toast-manager';

// Define PurchaseOrder type
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
  items?: Array<{
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

export function PurchaseOrderList() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    supplierId: '',
    startDate: '',
    endDate: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 20,
  });
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [receivedItems, setReceivedItems] = useState<Record<string, number>>({});
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    loadOrders();
  }, [filters, pagination.page]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const result = await purchaseOrderService.getAllPurchaseOrders({
        page: pagination.page,
        limit: pagination.limit,
        ...filters,
      });
      setOrders(result.data || []);
      setPagination({
        ...pagination,
        total: result.total || 0,
        totalPages: result.totalPages || 1,
      });
    } catch (error) {
      console.error('Failed to load purchase orders:', error);
      toast.error('Failed to load purchase orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReceive = async () => {
    if (!selectedOrder) return;
    try {
      const items = selectedOrder.items?.map((item: any) => ({
        itemId: item.id,
        quantity: receivedItems[item.id] || 0,
      })).filter((item: any) => item.quantity > 0) || [];

      if (items.length === 0) {
        toast.warning('Please enter quantities for at least one item');
        return;
      }

      await purchaseOrderService.receivePurchaseOrder(selectedOrder.id, items);
      toast.success('Purchase order received successfully');
      setShowReceiveModal(false);
      loadOrders();
    } catch (error) {
      toast.error('Failed to receive purchase order');
    }
  };

  const handleCancel = async () => {
    if (!selectedOrder) return;
    try {
      await purchaseOrderService.cancelPurchaseOrder(selectedOrder.id, cancelReason);
      toast.success('Purchase order cancelled');
      setShowCancelModal(false);
      loadOrders();
    } catch (error) {
      toast.error('Failed to cancel purchase order');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RECEIVED': return 'success';
      case 'PARTIALLY_RECEIVED': return 'brand';
      case 'PENDING': return 'warning';
      case 'APPROVED': return 'secondary';
      case 'ORDERED': return 'indigo';
      case 'DRAFT': return 'gray';
      case 'CANCELLED': return 'danger';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RECEIVED': return CheckCircle;
      case 'PARTIALLY_RECEIVED': return Clock;
      case 'PENDING': return Clock;
      case 'APPROVED': return CheckCircle;
      case 'ORDERED': return Truck;
      case 'DRAFT': return Package;
      case 'CANCELLED': return XCircle;
      default: return Package;
    }
  };

  const columns = [
    {
      key: 'order',
      header: 'PO Number',
      render: (order: PurchaseOrder) => (
        <div>
          <p className="font-medium tabular-nums text-gray-900 dark:text-white">{order.orderNumber}</p>
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
          <p className="font-medium text-gray-900 dark:text-white">{order.supplier?.name}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{order.supplier?.email}</p>
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      render: (order: PurchaseOrder) => (
        <span className="tabular-nums text-gray-700 dark:text-gray-300">{order.items?.length || 0} items</span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (order: PurchaseOrder) => (
        <span className="font-bold tabular-nums text-gray-900 dark:text-white">${order.total.toFixed(2)}</span>
      ),
    },
    {
      key: 'delivery',
      header: 'Expected Delivery',
      render: (order: PurchaseOrder) => (
        order.expectedDelivery ? (
          <div className="text-sm">
            <p className="tabular-nums text-gray-900 dark:text-white">{new Date(order.expectedDelivery).toLocaleDateString()}</p>
            <span className={`text-2xs ${
              new Date(order.expectedDelivery) < new Date() && order.status !== 'RECEIVED'
                ? 'text-danger-600 dark:text-danger-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}>
              {new Date(order.expectedDelivery) < new Date() && order.status !== 'RECEIVED'
                ? 'Overdue'
                : 'Pending'}
            </span>
          </div>
        ) : 'N/A'
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (order: PurchaseOrder) => {
        const StatusIcon = getStatusIcon(order.status);
        return (
          <span className={`px-2 py-1 rounded-full text-2xs font-medium bg-${getStatusColor(order.status)}-100 text-${getStatusColor(order.status)}-700 inline-flex items-center gap-1`}>
            <StatusIcon className="w-3 h-3" />
            {order.status}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (order: PurchaseOrder) => (
        <div className="flex items-center gap-2">
          <Link
            to={`/purchase-orders/${order.id}`}
            className="p-1 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded transition duration-250 focus-ring"
            aria-label={`View ${order.orderNumber}`}
          >
            <Eye className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          </Link>
          {(order.status === 'PENDING' || order.status === 'APPROVED' || order.status === 'ORDERED' || order.status === 'PARTIALLY_RECEIVED') && (
            <>
              <button
                onClick={() => {
                  setSelectedOrder(order);
                  setReceivedItems({});
                  order.items?.forEach((item: any) => {
                    setReceivedItems(prev => ({ ...prev, [item.id]: item.quantity - (item.receivedQuantity || 0) }));
                  });
                  setShowReceiveModal(true);
                }}
                className="p-1 hover:bg-success-100 dark:hover:bg-success-900/30 rounded transition duration-250 focus-ring"
                title="Receive PO"
                aria-label={`Receive ${order.orderNumber}`}
              >
                <Truck className="w-4 h-4 text-success-600 dark:text-success-400" />
              </button>
              <button
                onClick={() => {
                  setSelectedOrder(order);
                  setShowCancelModal(true);
                }}
                className="p-1 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded transition duration-250 focus-ring"
                title="Cancel PO"
                aria-label={`Cancel ${order.orderNumber}`}
              >
                <XCircle className="w-4 h-4 text-danger-600 dark:text-danger-400" />
              </button>
            </>
          )}
          {order.status === 'DRAFT' && (
            <Link
              to={`/purchase-orders/${order.id}/edit`}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition duration-250 focus-ring"
              aria-label={`Edit ${order.orderNumber}`}
            >
              <Edit className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </Link>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Purchase Orders</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage all purchase orders</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="btn-secondary"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <Link
            to="/purchase-orders/new"
            className="btn-brand"
          >
            <Plus className="w-4 h-4" />
            Create PO
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card-brand shadow-soft mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by PO number..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
              />
            </div>
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
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
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
          />
          <span className="text-gray-500 dark:text-gray-400">to</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card-brand shadow-soft p-0 overflow-hidden">
        <Table
          columns={columns}
          data={orders}
          loading={loading}
        />
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(page) => setPagination({ ...pagination, page })}
          />
        </div>
      </div>

      {/* Receive Modal */}
      <Modal
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        title="Receive Purchase Order"
      >
        <div className="p-6">
          {selectedOrder && (
            <div className="mb-4">
              <p className="font-medium tabular-nums text-gray-900 dark:text-white">PO: {selectedOrder.orderNumber}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Supplier: {selectedOrder.supplier?.name}</p>
            </div>
          )}
          <div className="space-y-3">
            {selectedOrder?.items?.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-xl">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{item.product?.name}</p>
                  <p className="text-sm tabular-nums text-gray-500 dark:text-gray-400">
                    Ordered: {item.quantity} | Received: {item.receivedQuantity || 0}
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Receive</label>
                  <input
                    type="number"
                    value={receivedItems[item.id] || 0}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setReceivedItems(prev => ({
                        ...prev,
                        [item.id]: Math.min(val, item.quantity - (item.receivedQuantity || 0))
                      }));
                    }}
                    min="0"
                    max={item.quantity - (item.receivedQuantity || 0)}
                    className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowReceiveModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleReceive}
              className="btn-success"
            >
              Receive Items
            </button>
          </div>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Purchase Order"
      >
        <div className="p-6">
          {selectedOrder && (
            <div className="mb-4">
              <p className="font-medium tabular-nums text-gray-900 dark:text-white">PO: {selectedOrder.orderNumber}</p>
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
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 resize-none"
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
              className="px-4 py-2 bg-gradient-to-r from-danger-600 to-brand-accent-500 hover:from-danger-700 hover:to-brand-accent-600 text-white rounded-xl transition duration-250 flex items-center gap-2 focus-ring shadow-brand"
            >
              Cancel PO
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
