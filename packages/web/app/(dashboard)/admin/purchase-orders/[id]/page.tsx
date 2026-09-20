// src/app/(dashboard)/purchase-orders/[id]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../services/api';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency } from '../../../../../utils/formatters';
import { ArrowLeftIcon, TruckIcon } from '@heroicons/react/24/outline';

interface PurchaseOrderDetail {
  id: string;
  orderNumber: string;
  supplier: { id: string; name: string; email: string; phone: string };
  status: string;
  total: number;
  notes: string;
  expectedDelivery: string;
  receivedAt: string;
  createdAt: string;
  items: Array<{
    id: string;
    quantity: number;
    receivedQuantity: number;
    unitPrice: number;
    total: number;
    product: { id: string; name: string; sku: string };
  }>;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export default function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<PurchaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [receiving, setReceiving] = useState(false);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({});

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<ApiResponse<PurchaseOrderDetail>>(`/purchase-orders/${id}`);
      const orderData = response.data;
      setOrder(orderData);

      const initialQuantities: Record<string, number> = {};
      orderData.items.forEach((item: any) => {
        initialQuantities[item.id] = item.quantity - item.receivedQuantity;
      });
      setReceiveQuantities(initialQuantities);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchOrder();
    }
  }, [id, fetchOrder]);

  const handleReceive = async () => {
    try {
      setReceiving(true);
      const receivedItems = Object.entries(receiveQuantities)
        .filter(([_, qty]) => qty > 0)
        .map(([itemId, quantity]) => ({ itemId, quantity }));

      if (receivedItems.length === 0) {
        toast.error('No items to receive');
        return;
      }

      const response = await api.post<ApiResponse<any>>(`/purchase-orders/${id}/receive`, {
        receivedQuantities: receivedItems,
      });

      if (response.success) {
        toast.success('Purchase order received successfully');
        fetchOrder();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to receive order');
    } finally {
      setReceiving(false);
    }
  };

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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-b-2 border-brand-600 rounded-full"></div>
      </div>
    );
  }

  if (!order) {
    return <div className="text-center py-12 text-gray-500 dark:text-gray-400">Purchase order not found</div>;
  }

  const canReceive = ['PENDING', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(order.status);

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
            Created {new Date(order.createdAt).toLocaleDateString()}
          </p>
          {order.notes && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              Notes: {order.notes}
            </p>
          )}
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
          {order.status.replace('_', ' ')}
        </span>
      </div>

      {/* Supplier Info */}
      <div className="card-brand shadow-soft mb-6 animate-slide-down">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Supplier Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
            <p className="font-medium text-gray-900 dark:text-white">{order.supplier?.name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
            <p className="font-medium text-gray-900 dark:text-white">{order.supplier?.email || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
            <p className="font-medium text-gray-900 dark:text-white">{order.supplier?.phone || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Expected Delivery</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {order.expectedDelivery ? new Date(order.expectedDelivery).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>
        {order.receivedAt && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Received At</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {new Date(order.receivedAt).toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="card-brand shadow-soft overflow-hidden animate-slide-down p-0">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Order Items</h2>
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
                const remaining = item.quantity - item.receivedQuantity;
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
                      <span className={item.receivedQuantity === item.quantity ? 'text-success-600 dark:text-success-400 font-medium' : 'text-gray-900 dark:text-white'}>
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
                            value={receiveQuantities[item.id] || 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setReceiveQuantities({
                                ...receiveQuantities,
                                [item.id]: Math.min(val, remaining)
                              });
                            }}
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
                  colSpan={canReceive ? 6 : 5}
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
            disabled={receiving}
            className="btn-success"
          >
            <TruckIcon className="w-5 h-5" />
            {receiving ? 'Receiving...' : 'Receive Items'}
          </button>
        </div>
      )}

      {/* Status History / Timeline (Optional) */}
      <div className="mt-8 card-brand shadow-soft animate-slide-down">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 eyebrow">Order Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Order Number:</span>
            <span className="ml-2 font-mono tabular-nums text-gray-900 dark:text-white">
              {order.orderNumber}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Status:</span>
            <span className={`ml-2 px-2 py-0.5 rounded-full text-2xs font-medium ${getStatusColor(order.status)}`}>
              {order.status}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Total Items:</span>
            <span className="ml-2 font-medium tabular-nums text-gray-900 dark:text-white">
              {order.items.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
