// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\orders\[id]\edit\page.tsx

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import {
  orderService,
  type Order,
  type OrderPriority,
  type UpdateOrderPayload,
} from '../../../../../../services/orderService';
import { OrderStatus } from '../../../../../../types/enums';
import { toast } from '../../../../../../utils/toast-manager';

// ============================================
// CONSTANTS
// ============================================

const STATUS_OPTIONS: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PROCESSING,
  OrderStatus.COMPLETED,
  OrderStatus.REFUNDED,
  OrderStatus.ON_HOLD,
];

const PRIORITY_OPTIONS: OrderPriority[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
];

// ============================================
// PAGE
// ============================================

export default function AdminOrderEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [priority, setPriority] = useState<OrderPriority>('MEDIUM');
  const [notes, setNotes] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ============================================
  // LOAD
  // ============================================

  const loadOrder = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      const data = await orderService.getOrderById(id);
      if (!isMountedRef.current) return;

      setOrder(data);
      setStatus(data.status);
      setPriority((data.priority as OrderPriority) ?? 'MEDIUM');
      setNotes(data.notes ?? '');
      setShippingAddress(data.shippingAddress ?? '');
      setExpectedDeliveryDate(
        data.expectedDeliveryDate
          ? new Date(data.expectedDeliveryDate)
              .toISOString()
              .slice(0, 16)
          : '',
      );
    } catch (err: any) {
      if (!isMountedRef.current) return;
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
  // SAVE
  // ============================================

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!order || !status) return;

      setSaving(true);
      try {
        const payload: UpdateOrderPayload = {
          status,
          notes: notes.trim() || undefined,
          priority,
          shippingAddress: shippingAddress.trim() || undefined,
          expectedDeliveryDate: expectedDeliveryDate
            ? new Date(expectedDeliveryDate).toISOString()
            : undefined,
        };

        await orderService.updateOrder(order.id, payload);
        toast.success('Order updated');
        router.push(`/admin/orders/${order.id}`);
      } catch (err: any) {
        toast.error(
          err?.response?.data?.message ||
            err?.message ||
            'Failed to update order',
        );
      } finally {
        if (isMountedRef.current) setSaving(false);
      }
    },
    [order, status, priority, notes, shippingAddress, expectedDeliveryDate, router],
  );

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <XCircle className="w-16 h-16 text-danger-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300">
          Order not found
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          {error}
        </p>
        <button
          type="button"
          onClick={() => router.push('/admin/orders')}
          className="mt-4 px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Orders
        </button>
      </div>
    );
  }

  const inputBase =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg ' +
    'bg-white dark:bg-gray-700 text-gray-900 dark:text-white ' +
    'focus:ring-2 focus:ring-brand-500 focus:outline-none transition';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push(`/admin/orders/${order.id}`)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
            aria-label="Back to order"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Edit Order{' '}
              <span className="font-mono tabular-nums">
                #{order.orderNumber}
              </span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Update workflow fields. Line items and totals are
              immutable once the order is created.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as OrderStatus | '')
              }
              className={inputBase}
              required
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) +
                    s.slice(1).toLowerCase().replace('_', ' ')}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Use the Cancel action on the detail page to cancel with a
              reason.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value as OrderPriority)
              }
              className={inputBase}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0) + p.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Expected delivery
            </label>
            <input
              type="datetime-local"
              value={expectedDeliveryDate}
              onChange={(e) =>
                setExpectedDeliveryDate(e.target.value)
              }
              className={inputBase}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Shipping address
            </label>
            <input
              type="text"
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              className={inputBase}
              placeholder="123 Main St, City"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className={`${inputBase} resize-none`}
              placeholder="Any additional context for this order…"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => router.push(`/admin/orders/${order.id}`)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-brand disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

