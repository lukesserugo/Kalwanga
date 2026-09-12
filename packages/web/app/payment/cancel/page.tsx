// D:\Projects\Kalwanga\packages\web\app\payment\cancel\page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  XCircle, ShoppingBag, Home, Mail, Phone,
  ArrowRight, HelpCircle, RefreshCw, AlertCircle,
  CreditCard, Shield, Lock, Clock, MessageCircle
} from 'lucide-react';
import { useThemeStore } from '../../../app/stores/themeStore';
import PublicNavigation from '../../../components/PublicNavigation';

export default function PaymentCancelPage() {
  const { isDark } = useThemeStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [provider, setProvider] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);

  // Get query params
  useEffect(() => {
    const providerParam = searchParams.get('provider');
    const referenceParam = searchParams.get('reference');
    const sessionId = searchParams.get('session_id');
    
    if (providerParam) setProvider(providerParam);
    if (referenceParam) setReference(referenceParam);
    if (sessionId) setReference(sessionId);
  }, [searchParams]);

  // Auto-redirect to cart after countdown
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      router.push('/cart');
    }
  }, [countdown, router]);

  const getProviderName = (providerCode: string | null): string => {
    const names: Record<string, string> = {
      STRIPE: 'Stripe',
      PAYPAL: 'PayPal',
      FLUTTERWAVE: 'Flutterwave',
      PAYSTACK: 'Paystack',
      SQUARE: 'Square',
      MTN: 'MTN Mobile Money',
      AIRTEL: 'Airtel Money',
      TIGO: 'Tigo Pesa',
      VODAFONE: 'Vodafone Cash',
      CASH: 'Cash',
      MOBILE_MONEY: 'Mobile Money',
      BANK_TRANSFER: 'Bank Transfer',
      GIFT_CARD: 'Gift Card',
      LOYALTY_POINTS: 'Loyalty Points',
    };
    return providerCode ? names[providerCode] || providerCode : 'payment provider';
  };

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-gray-950' : 'bg-gray-50'} transition-colors`}>
      <PublicNavigation />
      
      <div className="max-w-2xl mx-auto px-4 py-12 mt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={`rounded-2xl p-8 text-center ${
            isDark ? 'bg-gray-800' : 'bg-white'
          } shadow-sm border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
        >
          <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
          </div>
          
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Payment Cancelled
          </h2>
          <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Your payment was cancelled. No charges have been made to your account.
          </p>

          {/* Provider info if available */}
          {provider && (
            <div className={`mt-4 p-3 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <CreditCard className="w-4 h-4 inline mr-2 text-gray-400" />
                Payment via <span className="font-medium">{getProviderName(provider)}</span>
                {reference && (
                  <span className="text-xs block mt-1 font-mono text-gray-500 dark:text-gray-400">
                    Reference: {reference.slice(0, 20)}...
                  </span>
                )}
              </p>
            </div>
          )}

          <div className={`mt-6 p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <AlertCircle className="w-4 h-4 inline mr-2 text-yellow-500" />
              If you encountered any issues, please contact our support team.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <Link
              href="/cart"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Link>
            <Link
              href="/shop"
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-300"
            >
              <ShoppingBag className="w-4 h-4" />
              Continue Shopping
            </Link>
          </div>

          {/* Support options */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Need help?
            </p>
            <div className="mt-2 flex flex-wrap gap-3 justify-center">
              <Link
                href="/support"
                className={`inline-flex items-center gap-1 text-sm ${
                  isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                <Mail className="w-4 h-4" />
                Contact Support
              </Link>
              <Link
                href="/faq"
                className={`inline-flex items-center gap-1 text-sm ${
                  isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                FAQ
              </Link>
              <a
                href="tel:+1-800-555-0199"
                className={`inline-flex items-center gap-1 text-sm ${
                  isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                <Phone className="w-4 h-4" />
                Call Support
              </a>
            </div>
          </div>

          {/* Auto-redirect notice */}
          <div className={`mt-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Redirecting to cart in {countdown} seconds...
              <button
                onClick={() => router.push('/cart')}
                className="ml-2 text-blue-600 dark:text-blue-400 hover:underline"
              >
                Go now
              </button>
            </p>
          </div>

          {/* Trust Badges */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-green-500" />
              Secure
            </span>
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-blue-500" />
              Encrypted
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3 text-orange-500" />
              Support Available
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
