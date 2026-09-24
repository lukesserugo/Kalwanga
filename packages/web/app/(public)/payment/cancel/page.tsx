// D:\Projects\Kalwanga\packages\web\app\payment\cancel\page.tsx

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  XCircle,
  ShoppingBag,
  Mail,
  Phone,
  HelpCircle,
  RefreshCw,
  AlertCircle,
  CreditCard,
  Shield,
  Lock,
  MessageCircle,
  Copy,
} from 'lucide-react';
import { useThemeStore } from '../../../stores/themeStore';
import { toast } from '../../../utils/toast-manager';

// ============================================
// CONSTANTS
// ============================================

const PROVIDER_NAMES: Record<string, string> = {
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

// ============================================
// MAIN COMPONENT
// ============================================

export default function PaymentCancelPage() {
  const { isDark } = useThemeStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Parse the URL once ───────────────────────────────────────
  //
  // Doing this inside a `useMemo` means the parse runs once per
  // mount and the derived values are stable identities for the
  // rest of the component's life.
  const { provider, reference } = useMemo(() => {
    const providerParam =
      searchParams.get('provider') ||
      searchParams.get('gateway') ||
      null;
    const referenceParam =
      searchParams.get('reference') ||
      searchParams.get('session_id') ||
      searchParams.get('payment_intent') ||
      searchParams.get('tx_ref') ||
      searchParams.get('saleId') ||
      null;

    return {
      provider: providerParam,
      reference: referenceParam,
    };
  }, [searchParams]);

  const [countdown, setCountdown] = useState(5);

  // ── Countdown to auto-redirect ───────────────────────────────

  useEffect(() => {
    if (countdown <= 0) {
      router.push('/cart');
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, router]);

  // ── Handlers ─────────────────────────────────────────────────

  const getProviderName = useCallback((providerCode: string | null) => {
    if (!providerCode) return null;
    return PROVIDER_NAMES[providerCode] || providerCode;
  }, []);

  const handleCopyReference = useCallback(() => {
    if (!reference) return;
    navigator.clipboard
      .writeText(reference)
      .then(() => toast.success('Reference copied to clipboard'))
      .catch(() => toast.error('Failed to copy reference'));
  }, [reference]);

  const providerName = getProviderName(provider);

  // ── Render ───────────────────────────────────────────────────

  return (
    <div
      className={`min-h-screen ${
        isDark ? 'dark bg-gray-950' : 'bg-gray-50'
      } transition-colors`}
    >
      <div className="max-w-2xl mx-auto px-4 pt-24 md:pt-28 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={`rounded-2xl p-8 text-center ${
            isDark ? 'bg-gray-800' : 'bg-white'
          } shadow-sm border ${
            isDark ? 'border-gray-700' : 'border-gray-200'
          }`}
        >
          <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
          </div>

          <h2
            className={`text-2xl font-bold ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            Payment Cancelled
          </h2>
          <p
            className={`mt-2 ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            Your payment was cancelled. No charges have been made to your
            account.
          </p>

          {/* Provider info — shown when we know which gateway
              returned the user, otherwise a generic note. */}
          <div
            className={`mt-4 p-3 rounded-lg ${
              isDark ? 'bg-gray-700/30' : 'bg-gray-50'
            }`}
          >
            <p
              className={`text-sm ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              <CreditCard className="w-4 h-4 inline mr-2 text-gray-400" />
              {providerName ? (
                <>
                  Payment via{' '}
                  <span className="font-medium">{providerName}</span>
                </>
              ) : (
                <>Your payment session was cancelled</>
              )}
            </p>
            {reference && (
              <div className="mt-2 flex items-center justify-center gap-2">
                <span
                  className={`text-xs font-mono break-all ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  Ref: {reference}
                </span>
                <button
                  type="button"
                  onClick={handleCopyReference}
                  className={`p-1 rounded transition-colors focus-ring ${
                    isDark
                      ? 'hover:bg-gray-600 text-gray-400 hover:text-gray-300'
                      : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'
                  }`}
                  title="Copy reference"
                  aria-label="Copy reference"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          <div
            className={`mt-6 p-4 rounded-lg ${
              isDark ? 'bg-gray-700/30' : 'bg-gray-50'
            }`}
          >
            <p
              className={`text-sm ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              <AlertCircle className="w-4 h-4 inline mr-2 text-yellow-500" />
              If you encountered any issues, please contact our support
              team.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <Link
              href="/cart"
              className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg transition-colors flex items-center gap-2 shadow-md"
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
            <p
              className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              Need help?
            </p>
            <div className="mt-2 flex flex-wrap gap-3 justify-center">
              <Link
                href="/support"
                className={`inline-flex items-center gap-1 text-sm ${
                  isDark
                    ? 'text-orange-400 hover:text-orange-300'
                    : 'text-orange-600 hover:text-orange-700'
                }`}
              >
                <Mail className="w-4 h-4" />
                Contact Support
              </Link>
              <Link
                href="/faq"
                className={`inline-flex items-center gap-1 text-sm ${
                  isDark
                    ? 'text-orange-400 hover:text-orange-300'
                    : 'text-orange-600 hover:text-orange-700'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                FAQ
              </Link>
              <a
                href="tel:+1-800-555-0199"
                className={`inline-flex items-center gap-1 text-sm ${
                  isDark
                    ? 'text-orange-400 hover:text-orange-300'
                    : 'text-orange-600 hover:text-orange-700'
                }`}
              >
                <Phone className="w-4 h-4" />
                Call Support
              </a>
            </div>
          </div>

          {/* Auto-redirect notice */}
          <div
            className={`mt-4 pt-4 border-t ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}
          >
            <p
              className={`text-xs tabular-nums ${
                isDark ? 'text-gray-500' : 'text-gray-400'
              }`}
            >
              Redirecting to cart in {countdown} seconds...
              <button
                onClick={() => router.push('/cart')}
                className="ml-2 text-orange-600 dark:text-orange-400 hover:underline"
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
              <Lock className="w-3 h-3 text-orange-500" />
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
