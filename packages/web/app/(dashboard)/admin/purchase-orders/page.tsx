// src/app/(dashboard)/purchase-orders/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../services/api';
import { toast } from '../../../../utils/toast-manager';
import { formatCurrency } from '../../../../utils/formatters';
import Link from 'next/link';

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplier: { name: string };
  status: string;
  total: number;
  expectedDelivery: string;
  createdAt: string;
  items: Array<{
    id: string;
    quantity: number;
    receivedQuantity: number;
    product: { name: string };
  }>;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

interface PurchaseOrderListResponse {
  data: PurchaseOrder[];
  pagination?: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    totalPages: 1,
    limit: 10,
  });

  const fetchOrders = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params: any = { page, limit: 10 };
      if (statusFilter) params.status = statusFilter;

      const response = await api.get<ApiResponse<PurchaseOrderListResponse>>('/purchase-orders', { params });

      if (response.success && response.data) {
        setOrders(response.data.data || []);
        if (response.data.pagination) {
          setPagination(response.data.pagination);
        }
      } else {
        setOrders(response.data?.data || []);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
      PENDING: 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300',
      APPROVED: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300',
      ORDERED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
      PARTIALLY_RECEIVED: 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300',
      RECEIVED: 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300',
      CANCELLED: 'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: 'Draft',
      PENDING: 'Pending',
      APPROVED: 'Approved',
      ORDERED: 'Ordered',
      PARTIALLY_RECEIVED: 'Partially Received',
      RECEIVED: 'Received',
      CANCELLED: 'Cancelled',
    };
    return labels[status] || status;
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchOrders(newPage);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin h-8 w-8 border-b-2 border-brand-600 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Purchase Orders</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Manage all purchase orders</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-brand"
        >
          + Create PO
        </button>
      </div>

      {/* Filters */}
      <div className="card-brand shadow-soft mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
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
          </div>
          <button
            onClick={() => {
              setStatusFilter('');
              fetchOrders(1);
            }}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition duration-250 focus-ring rounded-lg"
          >
            Clear Filter
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card-brand shadow-soft overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/30">
              <tr>
                <th className="px-6 py-3 text-left text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow">
                  Order #
                </th>
                <th className="px-6 py-3 text-left text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow">
                  Delivery
                </th>
                <th className="px-6 py-3 text-left text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No purchase orders found
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-250">
                    <td className="px-6 py-4 font-mono font-bold tabular-nums text-brand-600 dark:text-brand-400">
                      <Link
                        href={`/dashboard/purchase-orders/${order.id}`}
                        className="hover:underline transition duration-250 focus-ring rounded"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {order.supplier?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-2xs font-medium ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium tabular-nums text-gray-900 dark:text-white">
                      {formatCurrency(order.total)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {order.expectedDelivery ? new Date(order.expectedDelivery).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm tabular-nums text-gray-500 dark:text-gray-400">
                      {order.items?.length || 0} items
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Link
                        href={`/dashboard/purchase-orders/${order.id}`}
                        className="text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium transition duration-250 focus-ring rounded"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex items-center justify-between">
            <p className="text-sm tabular-nums text-gray-600 dark:text-gray-400">
              Showing {orders.length} of {pagination.total} orders
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition duration-250 focus-ring text-gray-700 dark:text-gray-300"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm tabular-nums text-gray-700 dark:text-gray-300">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition duration-250 focus-ring text-gray-700 dark:text-gray-300"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {orders.length > 0 && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card-brand shadow-soft hover:shadow-card-hover transition duration-250">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Orders</p>
            <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{pagination.total}</p>
          </div>
          <div className="card-brand shadow-soft hover:shadow-card-hover transition duration-250">
            <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
            <p className="text-2xl font-bold tabular-nums text-warning-600 dark:text-warning-400">
              {orders.filter(o => o.status === 'PENDING').length}
            </p>
          </div>
          <div className="card-brand shadow-soft hover:shadow-card-hover transition duration-250">
            <p className="text-sm text-gray-500 dark:text-gray-400">Received</p>
            <p className="text-2xl font-bold tabular-nums text-success-600 dark:text-success-400">
              {orders.filter(o => o.status === 'RECEIVED').length}
            </p>
          </div>
          <div className="card-brand shadow-soft hover:shadow-card-hover transition duration-250">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Value</p>
            <p className="text-2xl font-bold tabular-nums text-brand-600 dark:text-brand-400">
              {formatCurrency(orders.reduce((sum, o) => sum + o.total, 0))}
            </p>
          </div>
        </div>
      )}

      {/* Create Modal (Placeholder - to be implemented) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-modal p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Purchase Order</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition duration-250 focus-ring rounded p-1"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              Purchase order creation form coming soon...
            </p>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                className="btn-brand disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
