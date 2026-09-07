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
      DRAFT: 'bg-gray-100 text-gray-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-blue-100 text-blue-800',
      ORDERED: 'bg-indigo-100 text-indigo-800',
      PARTIALLY_RECEIVED: 'bg-orange-100 text-orange-800',
      RECEIVED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full"></div>
      </div>
    );
  }

  if (!order) {
    return <div className="text-center py-12 text-gray-500">Purchase order not found</div>;
  }

  const canReceive = ['PENDING', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(order.status);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <button 
        onClick={() => router.back()} 
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 transition-colors"
      >
        <ArrowLeftIcon className="w-5 h-5" />
        Back
      </button>

      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-mono text-blue-600">{order.orderNumber}</h1>
          <p className="text-gray-600 mt-1">Created {new Date(order.createdAt).toLocaleDateString()}</p>
          {order.notes && (
            <p className="text-sm text-gray-500 mt-1">Notes: {order.notes}</p>
          )}
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
          {order.status.replace('_', ' ')}
        </span>
      </div>

      {/* Supplier Info */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Supplier Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Name</p>
            <p className="font-medium text-gray-900">{order.supplier?.name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Email</p>
            <p className="font-medium text-gray-900">{order.supplier?.email || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Phone</p>
            <p className="font-medium text-gray-900">{order.supplier?.phone || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Expected Delivery</p>
            <p className="font-medium text-gray-900">
              {order.expectedDelivery ? new Date(order.expectedDelivery).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>
        {order.receivedAt && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">Received At</p>
            <p className="font-medium text-gray-900">{new Date(order.receivedAt).toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Order Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ordered</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Received</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                {canReceive && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Receive Qty</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {order.items.map((item) => {
                const remaining = item.quantity - item.receivedQuantity;
                const isFullyReceived = remaining <= 0;
                
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.product?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.product?.sku || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900">{item.quantity}</td>
                    <td className="px-6 py-4 text-sm text-right">
                      <span className={item.receivedQuantity === item.quantity ? 'text-green-600 font-medium' : 'text-gray-900'}>
                        {item.receivedQuantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">{formatCurrency(item.total)}</td>
                    {canReceive && (
                      <td className="px-6 py-4 text-right">
                        {isFullyReceived ? (
                          <span className="text-green-600 text-sm font-medium">✓ Received</span>
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
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-right focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={canReceive ? 6 : 5} className="px-6 py-4 text-right font-bold text-gray-900">Total:</td>
                <td className="px-6 py-4 text-right font-bold text-gray-900">{formatCurrency(order.total)}</td>
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
            className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md"
          >
            <TruckIcon className="w-5 h-5" />
            {receiving ? 'Receiving...' : 'Receive Items'}
          </button>
        </div>
      )}

      {/* Status History / Timeline (Optional) */}
      <div className="mt-8 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-sm font-medium text-gray-500 mb-3">Order Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Order Number:</span>
            <span className="ml-2 font-mono text-gray-900">{order.orderNumber}</span>
          </div>
          <div>
            <span className="text-gray-500">Status:</span>
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
              {order.status}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Total Items:</span>
            <span className="ml-2 font-medium text-gray-900">{order.items.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
