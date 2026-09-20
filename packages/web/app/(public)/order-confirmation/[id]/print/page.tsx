// D:\Projects\Kalwanga\packages\web\app\order-confirmation\[id]\print\page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiService } from '../../../../services/api';
import { formatCurrency } from '../../../../utils/helpers';

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  total: number;
}

interface Order {
  id: string;
  receiptNumber: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  createdAt: string;
  items: OrderItem[];
  payments?: Array<{
    paymentMethod: string;
    amount: number;
  }>;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export default function PrintReceiptPage() {
  const params = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const response = await apiService.get<ApiResponse<Order>>(
        `/sales/${params.id as string}`,
      );
      setOrder(response.data);
    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // PRINT-ONLY STYLES
  // ============================================
  //
  // The print page is meant to be rendered without any site chrome.
  // These rules hide scrollbars, remove the page background color when
  // printing, and ensure the receipt fills the printed page cleanly.

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
          {/* Store Header */}
          <div className="text-center border-b pb-4 mb-4">
            <h1 className="text-2xl font-bold">POS Store</h1>
            <p className="text-sm text-gray-600">
              123 Main Street, City, State 12345
            </p>
            <p className="text-sm text-gray-600">
              Phone: (555) 123-4567
            </p>
            <p className="text-sm text-gray-600">
              Email: info@posstore.com
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">
              Loading receipt...
            </div>
          ) : !order ? (
            <div className="p-8 text-center text-gray-500">
              Order not found
            </div>
          ) : (
            <>
              {/* Receipt Header */}
              <div className="flex justify-between mb-4">
                <div>
                  <p className="font-bold">RECEIPT</p>
                  <p className="text-sm">#{order.receiptNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm">
                    Date:{' '}
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                  <p className="text-sm">
                    Time:{' '}
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div className="border-t border-b py-4 mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Item</th>
                      <th className="text-center py-2">Qty</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items &&
                      order.items.map((item: OrderItem) => (
                        <tr key={item.id}>
                          <td className="py-1">{item.productName}</td>
                          <td className="text-center py-1">
                            {item.quantity}
                          </td>
                          <td className="text-right py-1">
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
                  <span>Subtotal</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>{formatCurrency(order.tax)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(order.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>TOTAL</span>
                  <span>{formatCurrency(order.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid</span>
                  <span>{formatCurrency(order.paidAmount)}</span>
                </div>
                {order.changeAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Change</span>
                    <span>{formatCurrency(order.changeAmount)}</span>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              {order.payments && order.payments.length > 0 && (
                <div className="border-t pt-4 mb-4">
                  <p className="text-sm">
                    <strong>Payment Method:</strong>{' '}
                    {order.payments[0].paymentMethod}
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
                  onClick={() => window.print()}
                  className="no-print mt-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-4 py-2 rounded transition-colors shadow-md"
                >
                  🖨️ Print Receipt
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
