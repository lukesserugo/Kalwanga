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
      case 'RECEIVED': return 'green';
      case 'PARTIALLY_RECEIVED': return 'blue';
      case 'PENDING': return 'yellow';
      case 'APPROVED': return 'purple';
      case 'ORDERED': return 'indigo';
      case 'DRAFT': return 'gray';
      case 'CANCELLED': return 'red';
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
          <p className="font-medium text-gray-900">{order.orderNumber}</p>
          <p className="text-sm text-gray-500">
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
          <p className="font-medium">{order.supplier?.name}</p>
          <p className="text-sm text-gray-500">{order.supplier?.email}</p>
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      render: (order: PurchaseOrder) => (
        <span>{order.items?.length || 0} items</span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (order: PurchaseOrder) => (
        <span className="font-bold text-gray-900">${order.total.toFixed(2)}</span>
      ),
    },
    {
      key: 'delivery',
      header: 'Expected Delivery',
      render: (order: PurchaseOrder) => (
        order.expectedDelivery ? (
          <div className="text-sm">
            <p>{new Date(order.expectedDelivery).toLocaleDateString()}</p>
            <span className={`text-xs ${
              new Date(order.expectedDelivery) < new Date() && order.status !== 'RECEIVED'
                ? 'text-red-600'
                : 'text-gray-500'
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
      render: (order: PurchaseOrder) => (
        <div className="flex items-center gap-2">
          <Link
            to={`/purchase-orders/${order.id}`}
            className="p-1 hover:bg-blue-100 rounded transition-colors"
          >
            <Eye className="w-4 h-4 text-blue-600" />
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
                className="p-1 hover:bg-green-100 rounded transition-colors"
                title="Receive PO"
              >
                <Truck className="w-4 h-4 text-green-600" />
              </button>
              <button
                onClick={() => {
                  setSelectedOrder(order);
                  setShowCancelModal(true);
                }}
                className="p-1 hover:bg-red-100 rounded transition-colors"
                title="Cancel PO"
              >
                <XCircle className="w-4 h-4 text-red-600" />
              </button>
            </>
          )}
          {order.status === 'DRAFT' && (
            <Link
              to={`/purchase-orders/${order.id}/edit`}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <Edit className="w-4 h-4 text-gray-600" />
            </Link>
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
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-gray-600 mt-1">Manage all purchase orders</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <Link
            to="/purchase-orders/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create PO
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by PO number..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
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

      {/* Receive Modal */}
      <Modal
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        title="Receive Purchase Order"
      >
        <div className="p-6">
          {selectedOrder && (
            <div className="mb-4">
              <p className="font-medium">PO: {selectedOrder.orderNumber}</p>
              <p className="text-sm text-gray-600">Supplier: {selectedOrder.supplier?.name}</p>
            </div>
          )}
          <div className="space-y-3">
            {selectedOrder?.items?.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{item.product?.name}</p>
                  <p className="text-sm text-gray-500">
                    Ordered: {item.quantity} | Received: {item.receivedQuantity || 0}
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Receive</label>
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
                    className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowReceiveModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReceive}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
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
              <p className="font-medium">PO: {selectedOrder.orderNumber}</p>
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
              Cancel PO
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
