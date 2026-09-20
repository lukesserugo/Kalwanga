'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Package, User, CreditCard, Clock,
  CheckCircle, XCircle, Loader2, Printer,
} from 'lucide-react';
import { orderService } from '../../../../../services/orderService';
import { formatCurrency, formatDateTime } from '../../../../../utils/formatters';
import { toast } from '../../../../../utils/toast-manager';

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await orderService.getOrderById(id);
        setOrder(data);
      } catch (e: any) {
        setError(e.message || 'Failed to load order');
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-16 h-16 text-danger-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold">Order not found</h2>
        <p className="text-gray-500 mt-2">{error}</p>
        <button
          onClick={() => router.push('/admin/orders')}
          className="mt-4 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors focus-ring"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/admin/orders')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
            Order #{order.orderNumber}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formatDateTime(order.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <div className="card-brand p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-brand-500" /> Items
            </h2>
            <div className="space-y-3">
              {(order.items || []).map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {item.product?.name || item.productName || 'Item'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                      {item.quantity} × {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(item.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="card-brand p-6">
            <h2 className="text-lg font-semibold mb-4">Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tax</span>
                <span className="tabular-nums">{formatCurrency(order.tax)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-success-600">
                  <span>Discount</span>
                  <span className="tabular-nums">-{formatCurrency(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card-brand p-6">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-brand-500" /> Customer
            </h3>
            {order.customer ? (
              <div className="text-sm space-y-1">
                <p className="font-medium">
                  {order.customer.firstName} {order.customer.lastName}
                </p>
                <p className="text-gray-500">{order.customer.email}</p>
                {order.customer.phoneNumber && (
                  <p className="text-gray-500">{order.customer.phoneNumber}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Guest</p>
            )}
          </div>

          <div className="card-brand p-6">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-warning-500" /> Status
            </h3>
            <p className="text-lg font-bold">{order.status}</p>
            {order.notes && (
              <p className="text-sm text-gray-500 mt-2">{order.notes}</p>
            )}
          </div>

          {order.payment && (
            <div className="card-brand p-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-success-500" /> Payment
              </h3>
              <div className="text-sm space-y-1">
                <p className="font-medium tabular-nums">
                  {formatCurrency(order.payment.amount)}
                </p>
                <p className="text-gray-500">{order.payment.paymentMethod}</p>
                <p className="text-gray-500">{order.payment.status}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
