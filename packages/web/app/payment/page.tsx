'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  CreditCard, Banknote, Wallet, Building, QrCode, Gift, Star,
  ArrowLeft, ShoppingBag, Shield, Lock, Zap, CheckCircle,
  AlertCircle, Loader2, Receipt, Printer, Download,
  Copy, Share2, ChevronRight, Home, User, Mail, Phone,
  MapPin, Calendar, Clock, DollarSign, Package,
  Smartphone, Landmark, Globe, FileText
} from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';
import { useAuth } from '../../hooks/useAuth';
import { paymentService } from '../../services/paymentService';
import { cartService } from '../../services/cartService';
import { checkoutService } from '../../services/checkoutService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { toast } from '../../utils/toast-manager';
import PublicNavigation from '../../components/PublicNavigation';
import { PaymentMethodSelector } from '../../components/payments/PaymentMethodSelector';
import { PaymentForm } from '../../components/payments/PaymentForm';
import { PaymentReceipt } from '../../components/payments/PaymentReceipt';

// ============================================
// TYPES
// ============================================

interface PaymentPageProps {
  amount?: number;
  orderId?: string;
  saleId?: string;
  cartId?: string;
  returnUrl?: string;
}

// ============================================
// CONSTANTS - EXACT PROVIDER IMAGE URLs
// ============================================

const PROVIDER_IMAGE_URLS: Record<string, string> = {
  STRIPE: 'https://stripe.com/img/v3/home/social.png',
  PAYPAL: 'https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg',
  FLUTTERWAVE: 'https://flutterwave.com/images/logo/flyer.png',
  PAYSTACK: 'https://paystack.com/assets/images/logo.png',
  SQUARE: 'https://squareup.com/icons/square_logo.svg',
  MTN: 'https://www.mtn.co.ug/wp-content/uploads/2023/05/mtn-logo.png',
  AIRTEL: 'https://www.airtel.in/static-assets/new-home/img/airtel-red-logo.svg',
  TIGO: 'https://www.tigo.com.tz/sites/default/files/tigo-logo.png',
  VODAFONE: 'https://www.vodafone.com/content/dam/vodcom/Images/Logo/vodafone_logo_red.png',
  CASH: 'https://cdn-icons-png.flaticon.com/512/2331/2331970.png',
  MOBILE_MONEY: 'https://cdn-icons-png.flaticon.com/512/545/545245.png',
  BANK_TRANSFER: 'https://cdn-icons-png.flaticon.com/512/2845/2845813.png',
  GIFT_CARD: 'https://cdn-icons-png.flaticon.com/512/3144/3144456.png',
  LOYALTY_POINTS: 'https://cdn-icons-png.flaticon.com/512/1828/1828665.png',
};

const PROVIDER_DARK_IMAGE_URLS: Record<string, string> = {
  STRIPE: 'https://stripe.com/img/v3/home/social.png',
  PAYPAL: 'https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg',
  FLUTTERWAVE: 'https://flutterwave.com/images/logo/flyer.png',
  PAYSTACK: 'https://paystack.com/assets/images/logo-white.png',
  SQUARE: 'https://squareup.com/icons/square_logo.svg',
  MTN: 'https://www.mtn.co.ug/wp-content/uploads/2023/05/mtn-logo.png',
  AIRTEL: 'https://www.airtel.in/static-assets/new-home/img/airtel-red-logo.svg',
  TIGO: 'https://www.tigo.com.tz/sites/default/files/tigo-logo.png',
  VODAFONE: 'https://www.vodafone.com/content/dam/vodcom/Images/Logo/vodafone_logo_red.png',
  CASH: 'https://cdn-icons-png.flaticon.com/512/2331/2331970.png',
  MOBILE_MONEY: 'https://cdn-icons-png.flaticon.com/512/545/545245.png',
  BANK_TRANSFER: 'https://cdn-icons-png.flaticon.com/512/2845/2845813.png',
  GIFT_CARD: 'https://cdn-icons-png.flaticon.com/512/3144/3144456.png',
  LOYALTY_POINTS: 'https://cdn-icons-png.flaticon.com/512/1828/1828665.png',
};

const PROVIDER_CONFIGS: Record<string, { icon: string; name: string; color: string }> = {
  STRIPE: { icon: '💳', name: 'Stripe', color: 'blue' },
  PAYPAL: { icon: '💸', name: 'PayPal', color: 'blue' },
  FLUTTERWAVE: { icon: '🌊', name: 'Flutterwave', color: 'cyan' },
  PAYSTACK: { icon: '🔷', name: 'Paystack', color: 'sky' },
  SQUARE: { icon: '⬜', name: 'Square', color: 'gray' },
  CASH: { icon: '💰', name: 'Cash', color: 'green' },
  MOBILE_MONEY: { icon: '📱', name: 'Mobile Money', color: 'orange' },
  BANK_TRANSFER: { icon: '🏦', name: 'Bank Transfer', color: 'indigo' },
  GIFT_CARD: { icon: '🎁', name: 'Gift Card', color: 'pink' },
  LOYALTY_POINTS: { icon: '⭐', name: 'Loyalty Points', color: 'yellow' },
  MTN: { icon: '📱', name: 'MTN Mobile Money', color: 'yellow' },
  AIRTEL: { icon: '📱', name: 'Airtel Money', color: 'red' },
  TIGO: { icon: '📱', name: 'Tigo Pesa', color: 'blue' },
  VODAFONE: { icon: '📱', name: 'Vodafone Cash', color: 'red' },
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDark } = useThemeStore();
  const { user, isAuthenticated } = useAuth();

  // URL params
  const amountParam = searchParams.get('amount');
  const orderIdParam = searchParams.get('orderId');
  const saleIdParam = searchParams.get('saleId');
  const cartIdParam = searchParams.get('cartId');
  const returnUrlParam = searchParams.get('returnUrl');

  // State
  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [selectedMethod, setSelectedMethod] = useState('CREDIT_CARD');
  const [selectedProvider, setSelectedProvider] = useState<string>('STRIPE');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const [step, setStep] = useState<'select' | 'pay' | 'complete'>('select');
  const [customerLoyaltyPoints, setCustomerLoyaltyPoints] = useState(0);
  const [availableProviders, setAvailableProviders] = useState<any[]>([]);

  // Load payment data
  useEffect(() => {
    loadPaymentData();
    loadAvailableProviders();
  }, [orderIdParam, saleIdParam, cartIdParam]);

  const loadPaymentData = async () => {
    try {
      setLoading(true);

      // If we have a sale or order, fetch its details
      if (saleIdParam) {
        const sale = await checkoutService.getCheckoutById(saleIdParam);
        setPaymentData({
          amount: sale.total,
          reference: sale.receiptNumber,
          customer: sale.customer,
          items: sale.items,
          saleId: sale.id,
        });
      } else if (orderIdParam) {
        // Use checkoutService.getCheckoutById for orders too
        try {
          const order = await checkoutService.getCheckoutById(orderIdParam);
          setPaymentData({
            amount: order.total,
            reference: order.receiptNumber || `ORD-${orderIdParam.slice(0, 8)}`,
            customer: order.customer,
            items: order.items,
            orderId: order.id,
          });
        } catch (error) {
          console.error('Failed to fetch order:', error);
          // If order not found, fallback to direct payment
          if (amountParam) {
            setPaymentData({
              amount: parseFloat(amountParam),
              reference: `PAY-${Date.now()}`,
            });
          } else {
            throw error;
          }
        }
      } else if (cartIdParam) {
        // Fetch cart summary
        const cart = await checkoutService.getCheckoutSummaryByCart(cartIdParam);
        setPaymentData({
          amount: cart.total,
          items: cart.items,
          cartId: cartIdParam,
        });
      } else if (amountParam) {
        // Direct payment
        setPaymentData({
          amount: parseFloat(amountParam),
          reference: `PAY-${Date.now()}`,
        });
      } else {
        // No payment data found
        setPaymentData(null);
      }

      // Get customer loyalty points if authenticated
      if (isAuthenticated && user) {
        // Fetch customer loyalty points
        try {
          const loyaltyResponse = await fetch(`/api/customers/${user.id}/loyalty`);
          if (loyaltyResponse.ok) {
            const data = await loyaltyResponse.json();
            setCustomerLoyaltyPoints(data.points || 0);
          }
        } catch (error) {
          console.warn('Failed to fetch loyalty points:', error);
          setCustomerLoyaltyPoints(0);
        }
      }

    } catch (error) {
      console.error('Failed to load payment data:', error);
      toast.error('Failed to load payment details');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableProviders = async () => {
    try {
      const response = await paymentService.getPaymentProviders();
      if (response.success && response.data) {
        // Filter active providers
        const active = response.data.filter(p => p.isActive && p.isHealthy && p.configured);
        setAvailableProviders(active);
      }
    } catch (error) {
      console.warn('Failed to load providers:', error);
      // Use default providers
      setAvailableProviders([]);
    }
  };

  const getProviderImageUrl = (providerCode: string): string => {
    if (!providerCode) return '';
    return isDark && PROVIDER_DARK_IMAGE_URLS[providerCode] 
      ? PROVIDER_DARK_IMAGE_URLS[providerCode] 
      : PROVIDER_IMAGE_URLS[providerCode] || '';
  };

  const getProviderConfig = (providerCode: string) => {
    return PROVIDER_CONFIGS[providerCode] || { icon: '💳', name: providerCode, color: 'gray' };
  };

  const handlePaymentComplete = async (payment: any) => {
    setPaymentComplete(true);
    setPaymentResult(payment);
    setStep('complete');

    // Dispatch event
    window.dispatchEvent(new CustomEvent('payment:completed', { detail: payment }));

    toast.success('Payment completed successfully');
  };

  const handlePaymentError = (error: any) => {
    toast.error('Payment failed. Please try again.');
  };

  const handleContinueShopping = () => {
    router.push('/shop');
  };

  const handleViewOrders = () => {
    router.push('/account/orders');
  };

  const handleDownloadReceipt = () => {
    if (!paymentResult) return;
    
    const receiptData = {
      reference: paymentResult.reference,
      amount: paymentResult.amount,
      paymentMethod: paymentResult.paymentMethod,
      provider: paymentResult.provider,
      status: paymentResult.status,
      date: paymentResult.processedAt,
    };
    
    const blob = new Blob([JSON.stringify(receiptData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${paymentResult.reference}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Receipt downloaded');
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'dark bg-gray-950' : 'bg-gray-50'} transition-colors`}>
        <PublicNavigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
            <p className={`mt-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Loading payment details...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!paymentData) {
    return (
      <div className={`min-h-screen ${isDark ? 'dark bg-gray-950' : 'bg-gray-50'} transition-colors`}>
        <PublicNavigation />
        <div className="max-w-2xl mx-auto px-4 py-12 mt-20">
          <div className={`rounded-2xl p-8 text-center ${
            isDark ? 'bg-gray-800' : 'bg-white'
          } shadow-sm border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Payment Not Found
            </h2>
            <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              No payment details were found. Please try again.
            </p>
            <Link
              href="/shop"
              className="mt-6 inline-flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <ShoppingBag className="w-4 h-4" />
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-gray-950' : 'bg-gray-50'} transition-colors`}>
      <PublicNavigation />

      <div className="max-w-4xl mx-auto px-4 py-8 mt-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className={`p-2 rounded-lg transition ${
                isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Payment
              </h1>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Complete your payment securely
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <Shield className="w-4 h-4" />
            <span>Secure</span>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[
            { step: 1, label: 'Select Method' },
            { step: 2, label: 'Enter Details' },
            { step: 3, label: 'Complete' },
          ].map((s, index) => (
            <div key={s.step} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition ${
                  step === 'select' && s.step === 1 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                  step === 'pay' && s.step === 2 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                  step === 'complete' && s.step === 3 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                  s.step < (step === 'select' ? 1 : step === 'pay' ? 2 : 3) ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                  'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                }`}
              >
                <span className="text-sm font-medium">{s.label}</span>
              </div>
              {index < 2 && (
                <ChevronRight className={`w-4 h-4 mx-1 ${
                  s.step < (step === 'select' ? 1 : step === 'pay' ? 2 : 3)
                    ? 'text-green-400'
                    : 'text-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className={`rounded-xl p-6 shadow-sm ${
              isDark ? 'bg-gray-800' : 'bg-white'
            } border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              {/* Payment Method Selector */}
              {step === 'select' && (
                <div>
                  <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Select Payment Method
                  </h2>
                  
                  {/* Available Providers Display */}
                  {availableProviders.length > 0 && (
                    <div className="mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                      <p className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Available Providers
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {availableProviders.map((provider) => {
                          const imageUrl = getProviderImageUrl(provider.provider);
                          const config = getProviderConfig(provider.provider);
                          return (
                            <span
                              key={provider.id}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                            >
                              {imageUrl ? (
                                <Image
                                  src={imageUrl}
                                  alt={config.name}
                                  width={16}
                                  height={16}
                                  className="rounded object-contain"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <span className="text-sm">{config.icon}</span>
                              )}
                              <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                                {config.name}
                              </span>
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <PaymentMethodSelector
                    selectedMethod={selectedMethod}
                    onSelect={(method) => {
                      setSelectedMethod(method);
                      // Map method to default provider
                      if (method === 'CREDIT_CARD' || method === 'DEBIT_CARD') {
                        setSelectedProvider('STRIPE');
                      } else if (method === 'PAYPAL') {
                        setSelectedProvider('PAYPAL');
                      } else if (method === 'FLUTTERWAVE') {
                        setSelectedProvider('FLUTTERWAVE');
                      } else if (method === 'PAYSTACK') {
                        setSelectedProvider('PAYSTACK');
                      } else if (method === 'SQUARE') {
                        setSelectedProvider('SQUARE');
                      } else if (method === 'MOBILE_MONEY') {
                        setSelectedProvider('MOBILE_MONEY');
                      }
                      setStep('pay');
                    }}
                  />
                </div>
              )}

              {/* Payment Form */}
              {step === 'pay' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Enter Payment Details
                    </h2>
                    <button
                      onClick={() => setStep('select')}
                      className={`text-sm ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                    >
                      Change Method
                    </button>
                  </div>

                  {/* Show selected provider logo */}
                  {selectedProvider && (
                    <div className="mb-4 flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                      <div className="relative w-10 h-10 flex-shrink-0">
                        {getProviderImageUrl(selectedProvider) ? (
                          <Image
                            src={getProviderImageUrl(selectedProvider)}
                            alt={getProviderConfig(selectedProvider).name}
                            width={40}
                            height={40}
                            className="rounded object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="text-2xl">{getProviderConfig(selectedProvider).icon}</span>
                        )}
                      </div>
                      <div>
                        <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {getProviderConfig(selectedProvider).name}
                        </p>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Secure payment processing
                        </p>
                      </div>
                    </div>
                  )}

                    <PaymentForm
                      amount={paymentData.amount}
                      currency="USD"
                      paymentMethod={selectedMethod}
                      customerId={user?.id}
                      customerLoyaltyPoints={customerLoyaltyPoints}
                      onSuccess={handlePaymentComplete}
                      onError={handlePaymentError}
                      onCancel={() => setStep('select')}
                    />
                </div>
              )}

              {/* Payment Complete */}
              {step === 'complete' && paymentResult && (
                <div>
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
                    </div>
                    <h2 className={`mt-4 text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Payment Successful!
                    </h2>
                    <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Your payment has been processed successfully.
                    </p>
                    <p className={`text-lg font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {formatCurrency(paymentResult.amount)}
                    </p>
                    {paymentResult.provider && (
                      <div className="mt-2 flex items-center gap-2">
                        {getProviderImageUrl(paymentResult.provider) ? (
                          <Image
                            src={getProviderImageUrl(paymentResult.provider)}
                            alt={getProviderConfig(paymentResult.provider).name}
                            width={20}
                            height={20}
                            className="rounded object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="text-sm">{getProviderConfig(paymentResult.provider).icon}</span>
                        )}
                        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          via {getProviderConfig(paymentResult.provider).name}
                        </span>
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        onClick={handleDownloadReceipt}
                        className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                          isDark
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        <Download className="w-4 h-4" />
                        Download Receipt
                      </button>
                      <button
                        onClick={() => window.print()}
                        className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                          isDark
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        <Printer className="w-4 h-4" />
                        Print Receipt
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={handleContinueShopping}
                      className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      Continue Shopping
                    </button>
                    <button
                      onClick={handleViewOrders}
                      className="flex-1 px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-gray-700 dark:text-gray-300"
                    >
                      <Receipt className="w-4 h-4" />
                      View Orders
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className={`sticky top-24 rounded-xl p-6 shadow-sm ${
              isDark ? 'bg-gray-800' : 'bg-white'
            } border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Order Summary
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Reference
                  </span>
                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {paymentData.reference || `PAY-${Date.now()}`}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Amount
                  </span>
                  <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {formatCurrency(paymentData.amount)}
                  </span>
                </div>

                {paymentData.items && paymentData.items.length > 0 && (
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Items ({paymentData.items.length})
                    </p>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {paymentData.items.map((item: any, index: number) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                            {item.product?.name || item.productName || `Item ${index + 1}`}
                            {item.quantity && ` × ${item.quantity}`}
                          </span>
                          <span className={isDark ? 'text-white' : 'text-gray-900'}>
                            {formatCurrency(item.total || item.unitPrice * item.quantity || 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {customerLoyaltyPoints > 0 && (
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-sm">
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                        Available Points: {customerLoyaltyPoints}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Trust Badges */}
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-green-500" />
                    Secure
                  </span>
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3 text-blue-500" />
                    Encrypted
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-orange-500" />
                    Instant
                  </span>
                </div>
                <p className={`mt-3 text-xs text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  By proceeding, you agree to our Terms of Service
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
