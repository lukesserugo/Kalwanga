// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\orders\[id]\page.tsx

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  User,
  Mail,
  Phone,
  MapPin,
  Clock,
  Calendar,
  Loader2,
  XCircle,
  RefreshCw,
  TrendingUp,
  Printer,
  ExternalLink,
  FileText,
  DollarSign,
  Truck,
  AlertCircle,
} from 'lucide-react';
import {
  orderService,
  type Order,
  type OrderHistoryEntry,
  type OrderTimelineEntry,
} from '../../../../services/orderService';
import { OrderStatus } from '../../../../types/enums';
import { OrderStatusBadge } from '../../../../components/orders/OrderStatusBadge';
import { OrderTimeline } from '../../../../components/orders/OrderTimeline';
import { OrderSummaryCard } from '../../../../components/orders/OrderSummaryCard';
import { Modal } from '../../../../components/common/Modal';
import { toast } from '../../../../utils/toast-manager';
import {
  formatCurrency,
  formatDateTime,
} from '../../../../utils/formatters';

// ============================================
// CONSTANTS
// ============================================

const UPDATABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PROCESSING,
  OrderStatus.COMPLETED,
  OrderStatus.REFUNDED,
  OrderStatus.ON_HOLD,
];

const CANCELLABLE_STATUSES = new Set<string>([
  OrderStatus.PENDING,
  OrderStatus.PROCESSING,
  OrderStatus.ON_HOLD,
]);

const CONVERTIBLE_STATUSES = new Set<string>([OrderStatus.PENDING]);

const PRIORITY_BADGE_CLASSES: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
  MEDIUM:
    'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  HIGH: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
  URGENT:
    'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
};

// ============================================
// PAGE
// ============================================

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [timeline, setTimeline] = useState<OrderTimelineEntry[]>([]);
  const [history, setHistory] = useState<OrderHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderStatus | ''>('');
  const [cancelReason, setCancelReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadOrder = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      // Load the order plus its timeline and history in parallel.
      // Timeline and history are non-fatal — a failure to load them
      // does not prevent the order itself from rendering.
      const [orderResult, timelineResult, historyResult] =
        await Promise.allSettled([
          orderService.getOrderById(id),
          orderService.getOrderTimeline(id),
          orderService.getOrderHistory(id),
        ]);

      if (!isMountedRef.current) return;

      if (orderResult.status === 'rejected') {
        throw orderResult.reason;
      }

      setOrder(orderResult.value);
      setTimeline(
        timelineResult.status === 'fulfilled' ? timelineResult.value : [],
      );
      setHistory(
        historyResult.status === 'fulfilled' ? historyResult.value : [],
      );
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.error('Failed to load order:', err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to load order',
      );
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleStatusUpdate = useCallback(async () => {
    if (!order || !newStatus) return;

    setProcessing(true);
    try {
      await orderService.updateOrderStatus(order.id, newStatus);
      toast.success('Order status updated');
      setShowStatusModal(false);
      setNewStatus('');
      await loadOrder();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to update status',
      );
    } finally {
      if (isMountedRef.current) setProcessing(false);
    }
  }, [order, newStatus, loadOrder]);

  const handleCancel = useCallback(async () => {
    if (!order || !cancelReason.trim()) return;

    setProcessing(true);
    try {
      await orderService.cancelOrder(order.id, cancelReason.trim());
      toast.success('Order cancelled');
      setShowCancelModal(false);
      setCancelReason('');
      await loadOrder();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to cancel order',
      );
    } finally {
      if (isMountedRef.current) setProcessing(false);
    }
  }, [order, cancelReason, loadOrder]);

  const handleConvert = useCallback(async () => {
    if (!order) return;

    setProcessing(true);
    try {
      const sale = await orderService.convertOrderToSale(order.id);
      toast.success('Order converted to sale');
      // Reload so the UI reflects the new status, then optionally
      // navigate to the sale detail page. The backend exposes the
      // sale through the order detail payload after conversion.
      await loadOrder();
      if (sale?.id) {
        router.push(`/admin/sales/${sale.id}`);
      }
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to convert order',
      );
    } finally {
      if (isMountedRef.current) setProcessing(false);
    }
  }, [order, loadOrder, router]);

  // ============================================
  // RENDER — loading / error
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-brand-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading order…
          </p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <XCircle className="w-16 h-16 text-danger-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Order Not Found
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          {error || "The order you're looking for doesn't exist."}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={loadOrder}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/orders')}
            className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // DERIVED
  // ============================================

  const customerName = order.customer
    ? `${order.customer.firstName ?? ''} ${order.customer.lastName ?? ''}`.trim() ||
      'Customer'
    : 'Guest';

  const canCancel = CANCELLABLE_STATUSES.has(order.status);
  const canConvert = CONVERTIBLE_STATUSES.has(order.status);

  const priorityClass =
    PRIORITY_BADGE_CLASSES[order.priority ?? 'MEDIUM'] ??
    PRIORITY_BADGE_CLASSES.MEDIUM;

  // ============================================
  // RENDER — main
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push('/admin/orders')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
              aria-label="Back to orders"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3 flex-wrap">
                Order
                <span className="font-mono tabular-nums">
                  #{order.orderNumber}
                </span>
                <OrderStatusBadge status={order.status} size="md" />
                <span
                  className={`px-2 py-1 rounded-full text-2xs font-medium ${priorityClass}`}
                >
                  {order.priority ?? 'MEDIUM'}
                </span>
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDateTime(order.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/orders/${order.id}/print`}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm focus-ring"
            >
              <Printer className="w-4 h-4" />
              Print
            </Link>
            {canCancel && (
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                disabled={processing}
                className="px-4 py-2 border border-danger-300 dark:border-danger-800 text-danger-600 dark:text-danger-400 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors flex items-center gap-2 text-sm disabled:opacity-50 focus-ring"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </button>
            )}
            {canConvert && (
              <button
                type="button"
                onClick={handleConvert}
                disabled={processing}
                className="px-4 py-2 bg-success-600 hover:bg-success-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm disabled:opacity-50 focus-ring"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <TrendingUp className="w-4 h-4" />
                )}
                Convert to Sale
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setNewStatus(order.status);
                setShowStatusModal(true);
              }}
              disabled={processing}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm disabled:opacity-50 focus-ring"
            >
              <RefreshCw className="w-4 h-4" />
              Update Status
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Items */}
            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-brand-500" />
                Items ({order.items?.length ?? 0})
              </h2>

              {order.items && order.items.length > 0 ? (
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
                    >
                      <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        {item.product?.images?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.product.images[0]}
                            alt={item.product.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-gray-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {item.product?.name ?? 'Product'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                          {item.quantity} ×{' '}
                          {formatCurrency(item.unitPrice)}
                          {item.variant?.name && (
                            <span className="ml-2 text-xs">
                              ({item.variant.name})
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                          {formatCurrency(item.total)}
                        </p>
                        {item.discount > 0 && (
                          <p className="text-xs text-success-600 dark:text-success-400 tabular-nums">
                            −{formatCurrency(item.discount)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No items on this order.
                </p>
              )}
            </section>

            {/* Notes */}
            {order.notes && (
              <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-brand-500" />
                  Notes
                </h2>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {order.notes}
                </p>
              </section>
            )}

            {/* Timeline */}
            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-brand-500" />
                Activity
              </h2>
              <OrderTimeline
                entries={timeline}
                reverse
                loading={false}
              />
              {history.length > 0 && timeline.length === 0 && (
                <ul className="space-y-2 mt-4 text-sm text-gray-600 dark:text-gray-400">
                  {history.map((h) => (
                    <li key={h.id}>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {h.action}
                      </span>{' '}
                      — {formatDateTime(h.createdAt)}
                      {h.notes && ` · ${h.notes}`}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Summary */}
            <OrderSummaryCard
              totals={{
                subtotal: order.subtotal,
                tax: order.tax,
                discount: order.discount,
                total: order.total,
              }}
              sticky={false}
            />

            {/* Customer */}
            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-brand-500" />
                Customer
              </h2>
              <div className="space-y-2 text-sm">
                <p className="font-medium text-gray-900 dark:text-white">
                  {customerName}
                </p>
                {order.customer?.email && (
                  <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Mail className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {order.customer.email}
                    </span>
                  </p>
                )}
                {order.customer?.phoneNumber && (
                  <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Phone className="w-4 h-4 shrink-0" />
                    {order.customer.phoneNumber}
                  </p>
                )}
                {order.shippingAddress && (
                  <p className="text-gray-500 dark:text-gray-400 flex items-start gap-2">
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{order.shippingAddress}</span>
                  </p>
                )}
                {!order.customer && (
                  <p className="text-gray-500 dark:text-gray-400">
                    Walk-in / no customer record attached.
                  </p>
                )}
              </div>
            </section>

            {/* Payment */}
            {order.payment && (
              <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                  <DollarSign className="w-4 h-4 text-success-500" />
                  Payment
                </h2>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      Amount
                    </span>
                    <span className="text-gray-900 dark:text-white tabular-nums">
                      {formatCurrency(order.payment.amount)}
                    </span>
                  </div>
                  {order.payment.paymentMethod && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">
                        Method
                      </span>
                      <span className="text-gray-900 dark:text-white capitalize">
                        {String(order.payment.paymentMethod)
                          .toLowerCase()
                          .replace(/_/g, ' ')}
                      </span>
                    </div>
                  )}
                  {order.payment.status && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">
                        Status
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        {order.payment.status}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Related */}
            {(order.sale || order.receipt) && (
              <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                  <ExternalLink className="w-4 h-4 text-brand-500" />
                  Related records
                </h2>
                <div className="space-y-2">
                  {order.sale?.id && (
                    <Link
                      href={`/admin/sales/${order.sale.id}`}
                      className="block text-sm text-brand-600 dark:text-brand-400 hover:underline focus-ring rounded"
                    >
                      View sale #{order.sale.receiptNumber ?? order.sale.id}
                    </Link>
                  )}
                  {order.receipt?.id && (
                    <Link
                      href={`/admin/receipts/${order.receipt.id}`}
                      className="block text-sm text-brand-600 dark:text-brand-400 hover:underline focus-ring rounded"
                    >
                      View receipt #{order.receipt.receiptNumber}
                    </Link>
                  )}
                </div>
              </section>
            )}

            {/* Shipping */}
            {order.expectedDeliveryDate && (
              <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                  <Truck className="w-4 h-4 text-brand-500" />
                  Delivery
                </h2>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Expected:{' '}
                  <span className="tabular-nums">
                    {formatDateTime(order.expectedDeliveryDate)}
                  </span>
                </p>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* STATUS UPDATE MODAL                          */}
      {/* ============================================ */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="Update Order Status"
      >
        <div className="p-6 bg-white dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Current:{' '}
            <OrderStatusBadge status={order.status} size="sm" />
          </p>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            New status
          </label>
          <select
            value={newStatus}
            onChange={(e) =>
              setNewStatus(e.target.value as OrderStatus | '')
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
          >
            <option value="">Select status</option>
            {UPDATABLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ')}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Use the Cancel action for cancellations — a reason is
            required.
          </p>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => setShowStatusModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStatusUpdate}
              disabled={processing || !newStatus}
              className="btn-brand disabled:opacity-50"
            >
              {processing && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Update
            </button>
          </div>
        </div>
      </Modal>

      {/* ============================================ */}
      {/* CANCEL MODAL                                 */}
      {/* ============================================ */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Order"
      >
        <div className="p-6 bg-white dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Order{' '}
            <span className="font-mono tabular-nums">
              #{order.orderNumber}
            </span>{' '}
            — {formatCurrency(order.total)}
          </p>

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Reason for cancellation
          </label>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-danger-500 focus:outline-none resize-none"
            placeholder="Explain why this order is being cancelled…"
          />

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => setShowCancelModal(false)}
              className="btn-secondary"
            >
              Keep Order
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={processing || !cancelReason.trim()}
              className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 focus-ring"
            >
              {processing && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Cancel Order
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
