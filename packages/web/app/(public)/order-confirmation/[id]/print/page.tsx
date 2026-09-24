// D:\Projects\Kalwanga\packages\web\app\(public)\order-confirmation\[id]\print\page.tsx

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';
import {
  orderService,
  type Order,
} from '../../../../../services/orderService';
import { formatCurrency, formatDateTime } from '../../../../../utils/formatters';

export default function PrintReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadOrder = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);

      let data: Order;
      try {
        data = await orderService.getOrderById(id);
      } catch {
        data = await orderService.getOrderByNumber(id);
      }

      if (!isMountedRef.current) return;
      setOrder(data);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Order not found',
      );
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  // Auto-print once loaded. Browsers show their own dialog.
  useEffect(() => {
    if (!order) return;
    const t = setTimeout(() => {
      try {
        window.print();
      } catch {
        /* user can press the button */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [order]);

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            margin: 12mm;
          }
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-white p-8 print:p-0">
        <div className="max-w-2xl mx-auto border p-8 rounded-lg shadow-lg print:border-0 print:shadow-none print:rounded-none">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
              Loading receipt…
            </div>
          ) : error || !order ? (
            <div className="p-8 text-center text-gray-500">
              <p className="font-medium text-danger-600">
                {error ?? 'Order not found'}
              </p>
              <button
                type="button"
                onClick={() => router.push('/account/orders')}
                className="no-print mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Orders
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="text-center border-b pb-4 mb-4">
                <h1 className="text-2xl font-bold text-gray-900">
                  Receipt
                </h1>
                <p className="text-sm text-gray-600 tabular-nums">
                  Order #{order.orderNumber}
                </p>
                <p className="text-sm text-gray-600 tabular-nums">
                  {formatDateTime(order.createdAt)}
                </p>
              </div>

              {/* Customer */}
              {order.customer && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-900">
                    Customer
                  </p>
                  <p className="text-sm text-gray-700">
                    {`${order.customer.firstName ?? ''} ${
                      order.customer.lastName ?? ''
                    }`.trim() || 'Customer'}
                  </p>
                  {order.customer.email && (
                    <p className="text-sm text-gray-600">
                      {order.customer.email}
                    </p>
                  )}
                </div>
              )}

              {/* Items */}
              <div className="border-t border-b py-4 mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="text-left py-2">Item</th>
                      <th className="text-center py-2">Qty</th>
                      <th className="text-right py-2">Unit</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(order.items ?? []).map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-gray-100"
                      >
                        <td className="py-1.5">
                          {item.product?.name ?? 'Product'}
                          {item.variant?.name && (
                            <span className="text-xs text-gray-500 ml-1">
                              ({item.variant.name})
                            </span>
                          )}
                        </td>
                        <td className="text-center py-1.5 tabular-nums">
                          {item.quantity}
                        </td>
                        <td className="text-right py-1.5 tabular-nums">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="text-right py-1.5 tabular-nums">
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="space-y-1 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="tabular-nums">
                    {formatCurrency(order.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax</span>
                  <span className="tabular-nums">
                    {formatCurrency(order.tax)}
                  </span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span className="tabular-nums">
                      −{formatCurrency(order.discount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {formatCurrency(order.total)}
                  </span>
                </div>
              </div>

              {/* Payment */}
              {order.payment && (
                <div className="border-t pt-4 mb-4 text-sm">
                  <p>
                    <strong>Payment method:</strong>{' '}
                    <span className="capitalize">
                      {String(order.payment.paymentMethod ?? '')
                        .toLowerCase()
                        .replace(/_/g, ' ')}
                    </span>
                  </p>
                </div>
              )}

              {/* Footer */}
              <div className="text-center text-sm text-gray-500 border-t pt-4">
                <p>Thank you for your business!</p>
                <p className="mt-1">
                  For returns, please contact us within 30 days.
                </p>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="no-print mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-4 py-2 rounded-lg transition-colors shadow-md"
                >
                  <Printer className="w-4 h-4" />
                  Print Receipt
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
