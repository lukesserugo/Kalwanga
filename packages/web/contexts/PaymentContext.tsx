'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { paymentService } from '../services/paymentService';
import { toast } from '../utils/toast-manager';

// ============================================
// TYPES
// ============================================

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  icon?: string;
  enabled: boolean;
  description?: string;
}

interface Payment {
  id: string;
  amount: number;
  paymentMethod: string;
  status: string;
  reference: string;
  processedAt: string;
  saleId?: string;
  orderId?: string;
  customerId?: string;
  metadata?: Record<string, any>;
}

interface PaymentState {
  methods: PaymentMethod[];
  selectedMethod: string | null;
  isProcessing: boolean;
  lastPayment: Payment | null;
  error: string | null;
}

interface PaymentContextType {
  state: PaymentState;
  // Payment Methods
  loadPaymentMethods: () => Promise<void>;
  selectPaymentMethod: (methodId: string) => void;
  // Payment Processing
  processPayment: (data: {
    amount: number;
    paymentMethod: string;
    saleId?: string;
    orderId?: string;
    customerId?: string;
    metadata?: Record<string, any>;
  }) => Promise<Payment>;
  // Refund
  refundPayment: (paymentId: string, data: { amount?: number; reason?: string }) => Promise<any>;
  // Status
  getPaymentStatus: (paymentId: string) => Promise<Payment>;
  // Reset
  resetPaymentState: () => void;
  // Utilities
  formatMethod: (method: string) => string;
  getMethodIcon: (method: string) => string;
  getMethodColor: (method: string) => string;
  isCardPayment: (method: string) => boolean;
  requiresRedirect: (method: string) => boolean;
  isInstantPayment: (method: string) => boolean;
  getCartPaymentTotal: (subtotal: number, discount: number, tax: number) => number;
}

// ============================================
// DEFAULT VALUES
// ============================================

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'CASH', name: 'Cash', code: 'CASH', enabled: true, description: 'Pay with cash at the counter' },
  { id: 'CREDIT_CARD', name: 'Credit Card', code: 'CREDIT_CARD', enabled: true, description: 'Pay with credit card (Visa, Mastercard, Amex)' },
  { id: 'DEBIT_CARD', name: 'Debit Card', code: 'DEBIT_CARD', enabled: true, description: 'Pay with your debit card' },
  { id: 'MOBILE_MONEY', name: 'Mobile Money', code: 'MOBILE_MONEY', enabled: true, description: 'M-Pesa, Tigo Pesa, Airtel Money' },
  { id: 'BANK_TRANSFER', name: 'Bank Transfer', code: 'BANK_TRANSFER', enabled: true, description: 'Direct bank transfer' },
  { id: 'GIFT_CARD', name: 'Gift Card', code: 'GIFT_CARD', enabled: true, description: 'Redeem your gift card' },
  { id: 'LOYALTY_POINTS', name: 'Loyalty Points', code: 'LOYALTY_POINTS', enabled: true, description: 'Pay with your loyalty points' },
];

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  CASH: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  CREDIT_CARD: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  DEBIT_CARD: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  MOBILE_MONEY: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  BANK_TRANSFER: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  GIFT_CARD: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  LOYALTY_POINTS: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
};

const PAYMENT_METHOD_ICONS: Record<string, string> = {
  CASH: '💰',
  CREDIT_CARD: '💳',
  DEBIT_CARD: '💳',
  MOBILE_MONEY: '📱',
  BANK_TRANSFER: '🏦',
  GIFT_CARD: '🎁',
  LOYALTY_POINTS: '⭐',
};

const initialState: PaymentState = {
  methods: DEFAULT_PAYMENT_METHODS,
  selectedMethod: null,
  isProcessing: false,
  lastPayment: null,
  error: null,
};

// ============================================
// CONTEXT
// ============================================

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

export function PaymentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PaymentState>(initialState);

  // ✅ FIXED: Load payment methods with graceful fallback
  const loadPaymentMethods = useCallback(async () => {
    try {
      // Try to get payment providers from the service
      const response = await paymentService.getPaymentProviders();
      
      if (response && response.success && response.data && response.data.length > 0) {
        // Map providers to PaymentMethod format
        const methods: PaymentMethod[] = response.data.map((provider: any) => ({
          id: provider.provider?.toUpperCase() || provider.id,
          name: paymentService.getProviderDisplayName(provider.provider || provider.id),
          code: provider.provider || provider.id,
          enabled: provider.isActive !== false,
          description: provider.config?.name || 'Payment method',
        }));
        
        // Filter enabled methods
        const enabledMethods = methods.filter(m => m.enabled);
        if (enabledMethods.length > 0) {
          setState(prev => ({
            ...prev,
            methods: enabledMethods,
          }));
          return;
        }
      }
      
      // ✅ FIXED: Fallback to default methods if API fails or returns no data
      console.log('📦 Using default payment methods (API unavailable)');
      setState(prev => ({
        ...prev,
        methods: DEFAULT_PAYMENT_METHODS,
      }));
      
    } catch (error: any) {
      // ✅ FIXED: Gracefully handle 404 and other errors
      // This is expected if the /payment-providers endpoint doesn't exist
      console.warn('⚠️ Payment providers API unavailable, using default methods:', error?.message || error);
      
      // Use default methods as fallback
      setState(prev => ({
        ...prev,
        methods: DEFAULT_PAYMENT_METHODS,
      }));
    }
  }, []);

  // Select payment method
  const selectPaymentMethod = useCallback((methodId: string) => {
    setState(prev => ({
      ...prev,
      selectedMethod: methodId,
      error: null,
    }));
  }, []);

  // Process payment
  const processPayment = useCallback(async (data: {
    amount: number;
    paymentMethod: string;
    saleId?: string;
    orderId?: string;
    customerId?: string;
    metadata?: Record<string, any>;
  }): Promise<Payment> => {
    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      const response = await paymentService.processPayment({
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        saleId: data.saleId,
        orderId: data.orderId,
        customerId: data.customerId,
        metadata: data.metadata,
      });

      const payment: Payment = {
        id: response.id || `pay_${Date.now()}`,
        amount: response.amount || data.amount,
        paymentMethod: response.paymentMethod || data.paymentMethod,
        status: response.status || 'PAID',
        reference: response.reference || `PAY-${Date.now()}`,
        processedAt: response.processedAt || new Date().toISOString(),
        saleId: data.saleId,
        orderId: data.orderId,
        customerId: data.customerId,
        metadata: data.metadata,
      };

      setState(prev => ({
        ...prev,
        isProcessing: false,
        lastPayment: payment,
        error: null,
      }));

      // Dispatch payment event
      window.dispatchEvent(new CustomEvent('payment:completed', { detail: payment }));

      return payment;
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Payment failed';
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: errorMessage,
      }));
      toast.error(errorMessage);
      throw error;
    }
  }, []);

  // Refund payment
  const refundPayment = useCallback(async (paymentId: string, data: { amount?: number; reason?: string }) => {
    try {
      const result = await paymentService.refundPayment(paymentId, data);
      toast.success('Refund processed successfully');
      return result;
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Refund failed';
      toast.error(errorMessage);
      throw error;
    }
  }, []);

  // Get payment status
  const getPaymentStatus = useCallback(async (paymentId: string): Promise<Payment> => {
    try {
      const response = await paymentService.getPaymentStatus(paymentId);
      const responseAny = response as any;
      
      return {
        id: response.id || paymentId,
        amount: response.amount || 0,
        paymentMethod: response.paymentMethod || 'UNKNOWN',
        status: response.status || 'UNKNOWN',
        reference: response.reference || response.id || paymentId,
        processedAt: response.processedAt || new Date().toISOString(),
        saleId: responseAny.saleId,
        orderId: responseAny.orderId,
        customerId: responseAny.customerId,
        metadata: responseAny.metadata,
      };
    } catch (error: any) {
      console.error('Failed to get payment status:', error);
      throw error;
    }
  }, []);

  // Reset payment state
  const resetPaymentState = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedMethod: null,
      isProcessing: false,
      lastPayment: null,
      error: null,
    }));
  }, []);

  // Format payment method
  const formatMethod = useCallback((method: string): string => {
    const labels: Record<string, string> = {
      'CASH': 'Cash',
      'CREDIT_CARD': 'Credit Card',
      'DEBIT_CARD': 'Debit Card',
      'MOBILE_MONEY': 'Mobile Money',
      'BANK_TRANSFER': 'Bank Transfer',
      'GIFT_CARD': 'Gift Card',
      'LOYALTY_POINTS': 'Loyalty Points',
      'CHECK': 'Check',
    };
    return labels[method] || method;
  }, []);

  // Get payment method icon
  const getMethodIcon = useCallback((method: string): string => {
    return PAYMENT_METHOD_ICONS[method] || '💳';
  }, []);

  // Get payment method color
  const getMethodColor = useCallback((method: string): string => {
    return PAYMENT_METHOD_COLORS[method] || 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';
  }, []);

  // Check if card payment
  const isCardPayment = useCallback((method: string): boolean => {
    return method === 'CREDIT_CARD' || method === 'DEBIT_CARD';
  }, []);

  // Check if requires redirect
  const requiresRedirect = useCallback((method: string): boolean => {
    return method === 'CREDIT_CARD' || method === 'DEBIT_CARD' || method === 'BANK_TRANSFER';
  }, []);

  // Check if instant payment
  const isInstantPayment = useCallback((method: string): boolean => {
    return method === 'CASH' || method === 'CREDIT_CARD' || method === 'DEBIT_CARD' ||
           method === 'MOBILE_MONEY' || method === 'LOYALTY_POINTS' || method === 'GIFT_CARD';
  }, []);

  // Get cart payment total
  const getCartPaymentTotal = useCallback((subtotal: number, discount: number, tax: number): number => {
    return subtotal + tax - discount;
  }, []);

  // Load payment methods on mount
  useEffect(() => {
    loadPaymentMethods();
  }, [loadPaymentMethods]);

  // Listen for payment events
  useEffect(() => {
    const handlePaymentEvent = (event: CustomEvent) => {
      const payment = event.detail;
      if (payment) {
        setState(prev => ({
          ...prev,
          lastPayment: payment,
        }));
      }
    };

    window.addEventListener('payment:completed', handlePaymentEvent as EventListener);
    return () => {
      window.removeEventListener('payment:completed', handlePaymentEvent as EventListener);
    };
  }, []);

  const value: PaymentContextType = {
    state,
    loadPaymentMethods,
    selectPaymentMethod,
    processPayment,
    refundPayment,
    getPaymentStatus,
    resetPaymentState,
    formatMethod,
    getMethodIcon,
    getMethodColor,
    isCardPayment,
    requiresRedirect,
    isInstantPayment,
    getCartPaymentTotal,
  };

  return (
    <PaymentContext.Provider value={value}>
      {children}
    </PaymentContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function usePayment() {
  const context = useContext(PaymentContext);
  if (context === undefined) {
    throw new Error('usePayment must be used within a PaymentProvider');
  }
  return context;
}

export { PaymentContext };
export type { PaymentContextType, PaymentState, PaymentMethod, Payment };
