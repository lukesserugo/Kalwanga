// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\checkout\payment-methods\page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, CreditCard, Banknote, Wallet, Building,
  QrCode, Gift, Star, Loader2, Plus, Edit, Trash2,
  CheckCircle, XCircle, AlertCircle, RefreshCw,
  ChevronDown, ChevronUp, Eye, Copy, MoreVertical
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { checkoutService } from '../../../../../services/checkoutService';
import { toast } from '../../../../../utils/toast-manager';
import { useThemeStore } from '../../../../stores/themeStore';

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  icon?: string;
  enabled: boolean;
  description?: string;
}

const PAYMENT_METHOD_ICONS: Record<string, any> = {
  CASH: Banknote,
  CREDIT_CARD: CreditCard,
  DEBIT_CARD: Wallet,
  MOBILE_MONEY: QrCode,
  BANK_TRANSFER: Building,
  GIFT_CARD: Gift,
  LOYALTY_POINTS: Star,
};

// ✅ FIXED: Custom LockIcon component
const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-gray-400 dark:text-gray-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

export default function PaymentMethodsPage() {
  const router = useRouter();
  const { canView, canManage, isLoading: permissionLoading } = usePermission();
  const { isDark } = useThemeStore();
  
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (canView(PermissionResource.PAYMENT)) {
      loadPaymentMethods();
    }
  }, []);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      const response = await checkoutService.getPaymentMethods();
      setMethods(response.data || []);
    } catch (error) {
      console.error('Failed to load payment methods:', error);
      toast.error('Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMethod = async (methodId: string, currentState: boolean) => {
    try {
      const method = methods.find(m => m.id === methodId);
      if (!method) return;

      // Update locally
      setMethods(prev => prev.map(m => 
        m.id === methodId ? { ...m, enabled: !currentState } : m
      ));

      // In a real implementation, you would call an API to update
      toast.success(`${method.name} ${currentState ? 'disabled' : 'enabled'} successfully`);
    } catch (error) {
      console.error('Failed to toggle payment method:', error);
      toast.error('Failed to update payment method');
      loadPaymentMethods(); // Revert
    }
  };

  const getIcon = (code: string) => {
    const Icon = PAYMENT_METHOD_ICONS[code] || CreditCard;
    return <Icon className="w-6 h-6" />;
  };

  if (permissionLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!canView(PermissionResource.PAYMENT)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <LockIcon />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to manage payment methods.</p>
        <button
          onClick={() => router.push('/admin/checkout')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Back to Checkout
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/checkout')}
            className={`p-2 rounded-lg transition ${
              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Payment Methods
            </h1>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Manage available payment methods for checkout
            </p>
          </div>
        </div>
        <button
          onClick={loadPaymentMethods}
          className={`p-2 rounded-lg transition ${
            isDark
              ? 'bg-gray-800 hover:bg-gray-700 text-white'
              : 'bg-white hover:bg-gray-100 text-gray-700'
          } border ${isDark ? 'border-gray-700' : 'border-gray-300'}`}
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Payment Methods Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {methods.map((method) => {
          const IconComponent = getIcon(method.code);
          return (
            <div
              key={method.id}
              className={`p-6 rounded-xl shadow-sm transition ${
                isDark ? 'bg-gray-800' : 'bg-white'
              } ${method.enabled ? 'border-l-4 border-l-green-500' : 'opacity-50'}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${
                    method.enabled
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                  }`}>
                    {IconComponent}
                  </div>
                  <div>
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {method.name}
                    </h3>
                    {method.description && (
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {method.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => handleToggleMethod(method.id, method.enabled)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition ${
                    method.enabled
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                  }`}
                >
                  {method.enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {methods.length === 0 && (
        <div className={`text-center py-12 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          <AlertCircle className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            No payment methods configured
          </h3>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Payment methods will appear here once configured
          </p>
        </div>
      )}
    </div>
  );
}
