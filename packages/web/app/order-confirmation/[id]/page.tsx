'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link'; // ✅ Added missing import
import { motion } from 'framer-motion';
import {
  CheckCircle, Package, Truck, Clock, Receipt,
  Download, Printer, Share2, ArrowLeft, Heart,
  Mail, Phone, MapPin, User, ShoppingBag,
  Loader2, AlertCircle, Star, Gift, Sparkles
} from 'lucide-react';
import PublicNavigation from '../../../components/PublicNavigation';
import { checkoutService } from '../../../services/checkoutService';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { toast } from '../../../utils/toast-manager';
import { useThemeStore } from '../../stores/themeStore';

export default function OrderConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { isDark } = useThemeStore();
  
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && id) {
      loadOrder();
    }
  }, [isClient, id]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      const data = await checkoutService.getCheckoutById(id);
      setOrder(data);
    } catch (error: any) {
      console.error('Failed to load order:', error);
      setError(error?.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!order) return;
    const data = {
      order: order,
      downloadedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `order-${order.receiptNumber}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Order downloaded');
  };

  const handleShare = () => {
    if (!order) return;
    const url = `${window.location.origin}/order-confirmation/${order.id}`;
    if (navigator.share) {
      navigator.share({
        title: `Order #${order.receiptNumber}`,
        text: `Check out my order #${order.receiptNumber}`,
        url: url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        toast.success('Order link copied');
      }).catch(() => {
        toast.error('Failed to copy link');
      });
    }
  };

  if (!isClient || loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'dark bg-gray-950' : 'bg-gray-50'}`}>
        <PublicNavigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading order...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className={`min-h-screen ${isDark ? 'dark bg-gray-950' : 'bg-gray-50'}`}>
        <PublicNavigation />
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Order Not Found</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">{error || 'The order you\'re looking for doesn\'t exist.'}</p>
          <button
            onClick={() => router.push('/shop')}
            className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  const estimatedDelivery = new Date(order.createdAt);
  estimatedDelivery.setDate(estimatedDelivery.getDate() + 3);

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-gray-950' : 'bg-gray-50'}`}>
      <PublicNavigation />
      
      <div className="max-w-4xl mx-auto px-4 py-8 mt-20">
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
            className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Order Confirmed!</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Thank you for your order. We'll send you a confirmation email shortly.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <Receipt className="w-4 h-4 text-gray-500" />
            <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
              Order #{order.receiptNumber}
            </span>
          </div>
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Placed on {formatDate(order.createdAt)}
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
            <Clock className="w-5 h-5 text-blue-500" />
            Order Status
          </h2>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {order.status || 'Processing'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Truck className="w-4 h-4" />
              <span>Estimated delivery: {formatDate(estimatedDelivery)}</span>
            </div>
          </div>
          <div className="mt-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full" style={{ width: '60%' }}></div>
          </div>
          <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
            <span>Order Placed</span>
            <span>Processing</span>
            <span>Shipped</span>
            <span>Delivered</span>
          </div>
        </motion.div>

        {/* Order Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-500" />
            Order Items
          </h2>
          <div className="space-y-4">
            {(order.items || []).map((item: any) => (
              <div key={item.id} className="flex items-center gap-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                  {item.product?.images?.[0] ? (
                    <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-full h-full p-2 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{item.product?.name || 'Product'}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {item.quantity} × {formatCurrency(item.unitPrice)}
                    {item.variant?.name && <span className="ml-2 text-xs">({item.variant.name})</span>}
                  </p>
                </div>
                <span className="font-medium text-gray-900 dark:text-white">
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
              <User className="w-4 h-4 text-blue-500" />
              Customer Details
            </h3>
            <div className="space-y-2 text-sm">
              <p className="text-gray-900 dark:text-white">
                {order.customer?.firstName} {order.customer?.lastName}
              </p>
              <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {order.customer?.email}
              </p>
              {order.customer?.phone && (
                <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {order.customer.phone}
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
                <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                <span className="text-gray-900 dark:text-white">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Tax</span>
                <span className="text-gray-900 dark:text-white">{formatCurrency(order.tax)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-green-600 dark:text-green-400">
                  <span>Discount</span>
                  <span>-{formatCurrency(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-900 dark:text-white">Total</span>
                <span className="text-gray-900 dark:text-white">{formatCurrency(order.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Payment Method</span>
                <span className="text-gray-900 dark:text-white capitalize">
                  {order.paymentMethod?.toLowerCase().replace('_', ' ')}
                </span>
              </div>
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
            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
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
        {order.loyaltyPointsEarned > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-8 p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-800"
          >
            <div className="flex items-center gap-3">
              <Gift className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  You earned {order.loyaltyPointsEarned} loyalty points!
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {order.loyaltyPointsEarned} points = {formatCurrency(order.loyaltyPointsEarned * 0.1)} discount on your next order
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
            <Link href="/contact" className="text-blue-600 dark:text-blue-400 hover:underline">
              Contact Support
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
