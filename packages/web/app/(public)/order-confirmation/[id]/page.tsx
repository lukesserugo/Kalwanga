// D:\Projects\Kalwanga\packages\web\app\order-confirmation\[id]\page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  Package,
  Truck,
  Clock,
  Receipt,
  Download,
  Printer,
  Share2,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  User,
  ShoppingBag,
  Loader2,
  AlertCircle,
  Gift,
  CreditCard,
  Banknote,
  Wallet,
  Star,
  Smartphone,
  Landmark,
  Globe,
  FileText,
} from 'lucide-react';
import { orderService } from '../../../services/orderService';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from '../../../utils/formatters';
import { toast } from '../../../utils/toast-manager';
import { useThemeStore } from '../../stores/themeStore';

// ============================================
// TYPES
// ============================================

type OrderStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'ON_HOLD';

type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIAL';

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  variantName?: string;
  product?: {
    id: string;
    name: string;
    images: string[];
  };
}

interface OrderPayment {
  id: string;
  amount: number;
  paymentMethod: string;
  status: string;
  processedAt: string;
  provider?: string;
  gatewayId?: string;
  reference?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  changeAmount?: number;
  paymentStatus: PaymentStatus;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  customerId?: string;
  customer?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    address?: string;
  };
  items: OrderItem[];
  payment?: OrderPayment;
  saleId?: string;
}

// ============================================
// HELPERS
// ============================================

function normalizeOrder(raw: any): Order {
  const payment =
    raw.payment ||
    (Array.isArray(raw.payments) && raw.payments.length > 0
      ? raw.payments[0]
      : undefined);

  const items: OrderItem[] = (raw.items || []).map((item: any) => ({
    id: item.id,
    productId: item.productId,
    productName:
      item.product?.name || item.productName || item.name || 'Item',
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.total,
    variantName: item.variant?.name || item.variantName,
    product: item.product
      ? {
          id: item.product.id,
          name: item.product.name,
          images: item.product.images || [],
        }
      : undefined,
  }));

  const derivedPaymentStatus: PaymentStatus =
    raw.paymentStatus ||
    (payment?.status === 'PAID'
      ? 'PAID'
      : payment?.status === 'PARTIAL'
        ? 'PARTIAL'
        : payment?.status === 'REFUNDED'
          ? 'REFUNDED'
          : payment?.status === 'FAILED'
            ? 'FAILED'
            : raw.status === 'COMPLETED'
              ? 'PAID'
              : 'PENDING');

  const customer = raw.customer || {};

  return {
    id: raw.id,
    orderNumber:
      raw.orderNumber ||
      raw.receiptNumber ||
      raw.id?.slice(0, 8) ||
      'N/A',
    status: (raw.status || 'PENDING') as OrderStatus,
    subtotal: raw.subtotal || 0,
    tax: raw.tax || 0,
    discount: raw.discount || 0,
    total: raw.total || 0,
    paidAmount: raw.paidAmount || payment?.amount || 0,
    changeAmount: raw.changeAmount || 0,
    paymentStatus: derivedPaymentStatus,
    notes: raw.notes,
    createdAt: raw.createdAt || raw.saleDate,
    updatedAt: raw.updatedAt,
    customerId: raw.customerId,
    customer: {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phoneNumber: customer.phoneNumber || customer.phone,
      address: customer.address,
    },
    items,
    payment: payment
      ? {
          id: payment.id,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          processedAt: payment.processedAt,
          provider: payment.provider,
          gatewayId: payment.gatewayId,
          reference: payment.reference,
        }
      : undefined,
    saleId: raw.saleId,
  };
}

/** Status → progress percentage (0-100) for the shipping bar */
function getProgressPercent(status: OrderStatus): number {
  switch (status) {
    case 'PENDING':
      return 15;
    case 'PROCESSING':
    case 'ON_HOLD':
      return 40;
    case 'COMPLETED':
      return 100;
    case 'CANCELLED':
    case 'REFUNDED':
      return 0;
    default:
      return 25;
  }
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card',
  MOBILE_MONEY: 'Mobile Money',
  BANK_TRANSFER: 'Bank Transfer',
  GIFT_CARD: 'Gift Card',
  LOYALTY_POINTS: 'Loyalty Points',
  CHECK: 'Check',
  PAYPAL: 'PayPal',
  FLUTTERWAVE: 'Flutterwave',
  PAYSTACK: 'Paystack',
  SQUARE: 'Square',
  MTN: 'MTN Mobile Money',
  AIRTEL: 'Airtel Money',
  TIGO: 'Tigo Pesa',
  VODAFONE: 'Vodafone Cash',
};

const PAYMENT_METHOD_ICONS: Record<string, React.ElementType> = {
  CASH: Banknote,
  CREDIT_CARD: CreditCard,
  DEBIT_CARD: Wallet,
  MOBILE_MONEY: Smartphone,
  BANK_TRANSFER: Landmark,
  GIFT_CARD: Gift,
  LOYALTY_POINTS: Star,
  CHECK: FileText,
  PAYPAL: Globe,
  FLUTTERWAVE: Globe,
  PAYSTACK: CreditCard,
  SQUARE: CreditCard,
  MTN: Smartphone,
  AIRTEL: Smartphone,
  TIGO: Smartphone,
  VODAFONE: Smartphone,
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function OrderConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { isDark } = useThemeStore();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // ============================================
  // LOAD ORDER — try by ID first, then by order number
  // ============================================

  const loadOrder = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      let data: any = null;

      // Try by ID first (works for CUIDs returned from order list)
      try {
        data = await orderService.getOrderById(id);
      } catch (err: any) {
        // If that fails, try by order number (works when URL uses ORD-xxx)
        console.warn(
          'Order lookup by ID failed, trying by number:',
          err?.message,
        );
        try {
          data = await orderService.getOrderByNumber(id);
        } catch (innerErr: any) {
          throw new Error(
            innerErr?.response?.data?.message ||
              innerErr?.message ||
              'Order not found',
          );
        }
      }

      setOrder(normalizeOrder(data));
    } catch (error: any) {
      console.error('Failed to load order:', error);
      setError(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to load order',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isClient && id) {
      loadOrder();
    }
  }, [isClient, id, loadOrder]);

  // ============================================
  // HANDLERS
  // ============================================

  const handlePrint = () => {
    router.push(`/order-confirmation/${id}/print`);
  };

  const handleDownload = () => {
    if (!order) return;
    const data = {
      order,
      downloadedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `order-${order.orderNumber}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Order downloaded');
  };

  const handleShare = async () => {
    if (!order) return;
    const shareUrl = `${window.location.origin}/order-confirmation/${order.id}`;
    const shareData = {
      title: `Order #${order.orderNumber}`,
      text: `Check out my order #${order.orderNumber}`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled or share failed — no-op
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Order link copied');
      } catch {
        toast.error('Failed to copy link');
      }
    }
  };

  // ============================================
  // LOADING STATE
  // ============================================

  if (!isClient || loading) {
    return (
      <div
        className={`min-h-screen ${
          isDark ? 'dark bg-gray-950' : 'bg-gray-50'
        }`}
      >
        <div className="flex items-center justify-center min-h-[60vh] pt-24 md:pt-28">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-orange-600 mx-auto" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Loading order...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // ERROR STATE
  // ============================================

  if (error || !order) {
    return (
      <div
        className={`min-h-screen ${
          isDark ? 'dark bg-gray-950' : 'bg-gray-50'
        }`}
      >
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 pt-32">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            Order Not Found
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-center">
            {error || "The order you're looking for doesn't exist."}
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={loadOrder}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push('/account/orders')}
              className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg transition-colors flex items-center gap-2 shadow-md"
            >
              <ArrowLeft className="w-4 h-4" />
              My Orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // DERIVED DATA
  // ============================================

  const estimatedDelivery = new Date(order.createdAt);
  estimatedDelivery.setDate(estimatedDelivery.getDate() + 3);

  const progressPercent = getProgressPercent(order.status);

  const PaymentIcon =
    PAYMENT_METHOD_ICONS[order.payment?.paymentMethod || ''] || CreditCard;

  const paymentMethodLabel =
    PAYMENT_METHOD_LABELS[order.payment?.paymentMethod || ''] ||
    order.payment?.paymentMethod ||
    '—';

  // ============================================
  // RENDER
  // ============================================

  return (
    <div
      className={`min-h-screen ${
        isDark ? 'dark bg-gray-950' : 'bg-gray-50'
      }`}
    >
      <div className="max-w-4xl mx-auto px-4 pt-24 md:pt-28 pb-8">
        {/* Success Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              order.status === 'CANCELLED' || order.status === 'REFUNDED'
                ? 'bg-red-100 dark:bg-red-900/30'
                : 'bg-green-100 dark:bg-green-900/30'
            }`}
          >
            {order.status === 'CANCELLED' || order.status === 'REFUNDED' ? (
              <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
            ) : (
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            )}
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {order.status === 'CANCELLED'
              ? 'Order Cancelled'
              : order.status === 'REFUNDED'
                ? 'Order Refunded'
                : 'Order Confirmed!'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {order.status === 'CANCELLED'
              ? 'This order was cancelled. If this was a mistake, please contact support.'
              : order.status === 'REFUNDED'
                ? 'This order was refunded. The amount will appear on your original payment method.'
                : "Thank you for your order. We'll send you a confirmation email shortly."}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <Receipt className="w-4 h-4 text-gray-500" />
            <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
              Order #{order.orderNumber}
            </span>
          </div>
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Placed on {formatDateTime(order.createdAt)}
          </div>
        </motion.div>

        {/* Order Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500" />
            Order Status
          </h2>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  order.status === 'COMPLETED'
                    ? 'bg-green-500'
                    : order.status === 'CANCELLED' ||
                        order.status === 'REFUNDED'
                      ? 'bg-red-500'
                      : order.status === 'PROCESSING' ||
                          order.status === 'ON_HOLD'
                        ? 'bg-orange-500'
                        : 'bg-yellow-500'
                }`}
              />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {order.status.charAt(0) +
                  order.status.slice(1).toLowerCase().replace('_', ' ')}
              </span>
            </div>
            {order.status !== 'CANCELLED' &&
              order.status !== 'REFUNDED' && (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Truck className="w-4 h-4" />
                  <span>
                    Estimated delivery: {formatDate(estimatedDelivery)}
                  </span>
                </div>
              )}
          </div>

          {order.status !== 'CANCELLED' &&
            order.status !== 'REFUNDED' && (
              <>
                <div className="mt-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
                  <span>Order Placed</span>
                  <span>Processing</span>
                  <span>Shipped</span>
                  <span>Delivered</span>
                </div>
              </>
            )}

          {order.notes && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Notes
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {order.notes}
              </p>
            </div>
          )}
        </motion.div>

        {/* Order Items */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-500" />
            Order Items ({order.items.length})
          </h2>
          <div className="space-y-4">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {item.product?.images?.[0] ? (
                    <Image
                      src={item.product.images[0]}
                      alt={item.productName}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (
                          e.target as HTMLImageElement
                        ).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Package className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {item.productName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {item.quantity} × {formatCurrency(item.unitPrice)}
                    {item.variantName && (
                      <span className="ml-2 text-xs">
                        ({item.variantName})
                      </span>
                    )}
                  </p>
                </div>
                <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">
                  {formatCurrency(item.total)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Customer & Payment Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-orange-500" />
              Customer Details
            </h3>
            <div className="space-y-2 text-sm">
              <p className="text-gray-900 dark:text-white">
                {order.customer?.firstName || order.customer?.lastName
                  ? `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim()
                  : 'Guest'}
              </p>
              {order.customer?.email && (
                <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {order.customer.email}
                </p>
              )}
              {order.customer?.phoneNumber && (
                <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {order.customer.phoneNumber}
                </p>
              )}
              {order.customer?.address && (
                <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {order.customer.address}
                </p>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-green-500" />
              Payment Summary
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Subtotal
                </span>
                <span className="text-gray-900 dark:text-white">
                  {formatCurrency(order.subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Tax</span>
                <span className="text-gray-900 dark:text-white">
                  {formatCurrency(order.tax)}
                </span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-green-600 dark:text-green-400">
                  <span>Discount</span>
                  <span>-{formatCurrency(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-900 dark:text-white">Total</span>
                <span className="text-gray-900 dark:text-white">
                  {formatCurrency(order.total)}
                </span>
              </div>
              {order.paidAmount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      Paid
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {formatCurrency(order.paidAmount)}
                    </span>
                  </div>
                  {order.changeAmount && order.changeAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">
                        Change
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        {formatCurrency(order.changeAmount)}
                      </span>
                    </div>
                  )}
                </>
              )}
              {order.payment && (
                <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">
                    Payment Method
                  </span>
                  <span className="text-gray-900 dark:text-white flex items-center gap-1.5">
                    <PaymentIcon className="w-4 h-4" />
                    {paymentMethodLabel}
                  </span>
                </div>
              )}
              {order.paymentStatus && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">
                    Payment Status
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      order.paymentStatus === 'PAID'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : order.paymentStatus === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                          : order.paymentStatus === 'REFUNDED'
                            ? 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300'
                            : order.paymentStatus === 'FAILED'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                    }`}
                  >
                    {order.paymentStatus}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap gap-3 mt-8"
        >
          <button
            onClick={() => router.push('/shop')}
            className="flex-1 min-w-[180px] px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md"
          >
            <ShoppingBag className="w-5 h-5" />
            Continue Shopping
          </button>
          <button
            onClick={handlePrint}
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-300"
          >
            <Printer className="w-5 h-5" />
            Print
          </button>
          <button
            onClick={handleDownload}
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-300"
          >
            <Download className="w-5 h-5" />
            Download
          </button>
          <button
            onClick={handleShare}
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-300"
          >
            <Share2 className="w-5 h-5" />
            Share
          </button>
        </motion.div>

        {/* Loyalty Points Earned */}
        {order.status === 'COMPLETED' && order.total > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-8 p-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl border border-orange-200 dark:border-orange-800"
          >
            <div className="flex items-center gap-3">
              <Gift className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              <div>
                <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                  You earned {Math.floor(order.total / 10)} loyalty points!
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400">
                  {Math.floor(order.total / 10)} points ={' '}
                  {formatCurrency(Math.floor(order.total / 10) * 0.1)}{' '}
                  discount on your next order
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Help */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          <p>
            Need help with your order?{' '}
            <Link
              href="/contact"
              className="text-orange-600 dark:text-orange-400 hover:underline"
            >
              Contact Support
            </Link>
          </p>
          <p className="mt-2">
            <Link
              href="/account/orders"
              className="text-orange-600 dark:text-orange-400 hover:underline"
            >
              View all my orders →
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
