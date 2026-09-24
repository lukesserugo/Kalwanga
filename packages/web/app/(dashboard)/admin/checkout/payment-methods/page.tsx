// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\checkout\payment-methods\page.tsx

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CreditCard,
  Banknote,
  Wallet,
  Building,
  QrCode,
  Gift,
  Star,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Lock,
  AlertCircle,
  Info,
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import {
  checkoutService,
  type PaymentMethodOption,
} from '../../../../../services/checkoutService';
import { toast } from '../../../../../utils/toast-manager';

// ============================================
// ICON MAP
// ============================================

const PAYMENT_METHOD_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  CASH: Banknote,
  CARD: CreditCard,
  CREDIT_CARD: CreditCard,
  DEBIT_CARD: Wallet,
  MOBILE_MONEY: QrCode,
  MOBILE: QrCode,
  MPESA: QrCode,
  BANK_TRANSFER: Building,
  BANK: Building,
  GIFT_CARD: Gift,
  GIFT: Gift,
  LOYALTY_POINTS: Star,
  LOYALTY: Star,
  WALLET: Wallet,
  PAYPAL: CreditCard,
  FLUTTERWAVE: CreditCard,
  PAYSTACK: CreditCard,
  SQUARE: CreditCard,
  CHECK: Banknote,
};

function getIconForCode(code: string) {
  const Icon = PAYMENT_METHOD_ICONS[code] ?? CreditCard;
  return <Icon className="w-6 h-6" />;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function PaymentMethodsPage() {
  const router = useRouter();
  const { hasPermission, isLoading: permissionLoading } = usePermission();

  const [methods, setMethods] = useState<PaymentMethodOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const canView = hasPermission(PermissionResource.PAYMENT);

  const loadPaymentMethods = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!canView) return;

      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);

      try {
        const list = await checkoutService.getPaymentMethods();
        if (!isMountedRef.current) return;
        setMethods(Array.isArray(list) ? list : []);
      } catch (error: any) {
        if (!isMountedRef.current) return;
        console.error('Failed to load payment methods:', error);
        toast.error(
          error?.response?.data?.message ||
            'Failed to load payment methods',
        );
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [canView],
  );

  useEffect(() => {
    if (permissionLoading) return;
    if (canView) {
      void loadPaymentMethods('initial');
    } else {
      setLoading(false);
    }
  }, [permissionLoading, canView, loadPaymentMethods]);

  // ============================================
  // GUARDS
  // ============================================

  if (permissionLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to manage payment methods.
        </p>
        <button
          type="button"
          onClick={() => router.push('/admin/checkout')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Back to Checkout
        </button>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push('/admin/checkout')}
            className="p-2 rounded-lg transition hover:bg-gray-200 dark:hover:bg-gray-700 focus-ring"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Payment Methods
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage available payment methods for checkout
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => loadPaymentMethods('refresh')}
          disabled={refreshing}
          className="p-2 rounded-lg transition bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-white border border-gray-300 dark:border-gray-700 disabled:opacity-50 focus-ring"
          aria-label="Refresh"
        >
          <RefreshCw
            className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {/* Read-only notice */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300 mb-6">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          Payment methods are managed by the backend configuration.
          Enabling or disabling a method here is not yet persisted —
          the backend does not expose a write endpoint for this
          resource.
        </p>
      </div>

      {/* Grid */}
      {methods.length === 0 ? (
        <div className="text-center py-12 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
          <AlertCircle className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            No payment methods configured
          </h3>
          <p className="text-sm mt-1 text-gray-500 dark:text-gray-400">
            Payment methods will appear here once configured
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {methods.map((method) => (
            <div
              key={method.id}
              className={`p-6 rounded-xl shadow-sm transition bg-white dark:bg-gray-800 ${
                method.enabled
                  ? 'border-l-4 border-l-green-500'
                  : 'opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-3 rounded-lg shrink-0 ${
                      method.enabled
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                    }`}
                  >
                    {getIconForCode(method.code)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {method.name}
                    </h3>
                    {method.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {method.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {method.enabled ? (
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      Disabled
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
