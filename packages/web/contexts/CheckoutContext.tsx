'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { toast } from '../utils/toast-manager';
import { paymentService } from '../services/paymentService';
import { checkoutService } from '../services/checkoutService';
import { usePayment } from './PaymentContext';

// ============================================
// TYPES
// ============================================

interface CheckoutItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  image?: string;
  variant?: string;
  variantId?: string;
}

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

interface CheckoutState {
  items: CheckoutItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  customerInfo: CustomerInfo;
  paymentMethod: string;
  loyaltyPointsUsed: number;
  promotionCode: string;
  notes: string;
  cartId?: string;
  customerId?: string;
  businessUnitId?: string;
}

interface CheckoutContextType {
  state: CheckoutState;
  // Cart Management
  addItem: (item: CheckoutItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  loadCart: (cartId: string) => Promise<void>;
  // Customer Info
  updateCustomerInfo: (info: Partial<CustomerInfo>) => void;
  // Payment
  setPaymentMethod: (method: string) => void;
  // Promotions
  applyPromotion: (code: string) => Promise<void>;
  removePromotion: () => void;
  // Loyalty
  applyLoyaltyPoints: (points: number) => void;
  // Calculations
  calculateTotals: () => void;
  // Order Placement
  placeOrder: () => Promise<any>;
  // Payment Integration
  processPayment: () => Promise<any>;
  // Reset
  resetCheckout: () => void;
}

// ============================================
// DEFAULT VALUES
// ============================================

const initialState: CheckoutState = {
  items: [],
  subtotal: 0,
  tax: 0,
  discount: 0,
  total: 0,
  customerInfo: {
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
  },
  paymentMethod: 'CASH',
  loyaltyPointsUsed: 0,
  promotionCode: '',
  notes: '',
  cartId: undefined,
  customerId: undefined,
  businessUnitId: undefined,
};

// ============================================
// CONTEXT
// ============================================

const CheckoutContext = createContext<CheckoutContextType | undefined>(undefined);

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CheckoutState>(initialState);
  const { processPayment: processPaymentService, selectPaymentMethod, state: paymentState } = usePayment();

  // Calculate totals
  const calculateTotals = useCallback(() => {
    setState(prev => {
      const subtotal = prev.items.reduce((sum, item) => sum + item.total, 0);
      const tax = subtotal * 0.1; // 10% tax rate
      const total = subtotal + tax - prev.discount;
      return { ...prev, subtotal, tax, total };
    });
  }, []);

  // ✅ FIXED: Load cart from server - use 'customer' not 'customerId'
  const loadCart = useCallback(async (cartId: string) => {
    try {
      const response = await checkoutService.getCheckoutSummaryByCart(cartId);
      if (response) {
        const items: CheckoutItem[] = (response.items || []).map((item: any) => ({
          id: item.id || `item_${Date.now()}`,
          productId: item.productId,
          name: item.product?.name || 'Product',
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          total: (item.quantity || 1) * (item.unitPrice || 0),
          image: item.product?.images?.[0],
          variant: item.variant?.name,
          variantId: item.variantId,
        }));

        // ✅ FIXED: Get customerId from customer object (response has 'customer', not 'customerId')
        const customerId = response.customer?.id;

        setState(prev => ({
          ...prev,
          items,
          subtotal: response.subtotal || 0,
          tax: response.tax || 0,
          discount: response.discount || 0,
          total: response.total || 0,
          cartId,
          customerId: customerId,
        }));

        // If customer info is available, update customer info
        if (response.customer) {
          setState(prev => ({
            ...prev,
            customerInfo: {
              ...prev.customerInfo,
              name: `${response.customer.firstName || ''} ${response.customer.lastName || ''}`.trim(),
              email: response.customer.email || '',
              phone: response.customer.phoneNumber || '',
              address: response.customer.address || '',
            },
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load cart:', error);
      toast.error('Failed to load cart');
    }
  }, []);

  // Add item
  const addItem = useCallback((item: CheckoutItem) => {
    setState(prev => {
      const existing = prev.items.find(i => i.id === item.id);
      if (existing) {
        const updated = prev.items.map(i =>
          i.id === item.id
            ? { ...i, quantity: i.quantity + item.quantity, total: (i.quantity + item.quantity) * i.unitPrice }
            : i
        );
        return { ...prev, items: updated };
      }
      return { ...prev, items: [...prev.items, item] };
    });
    calculateTotals();
  }, [calculateTotals]);

  // Remove item
  const removeItem = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id),
    }));
    calculateTotals();
  }, [calculateTotals]);

  // Update quantity
  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    setState(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === id
          ? { ...item, quantity, total: quantity * item.unitPrice }
          : item
      ),
    }));
    calculateTotals();
  }, [calculateTotals, removeItem]);

  // Clear cart
  const clearCart = useCallback(() => {
    setState(prev => ({ ...prev, items: [] }));
    calculateTotals();
  }, [calculateTotals]);

  // Update customer info
  const updateCustomerInfo = useCallback((info: Partial<CustomerInfo>) => {
    setState(prev => ({
      ...prev,
      customerInfo: { ...prev.customerInfo, ...info },
    }));
  }, []);

  // Set payment method
  const setPaymentMethod = useCallback((method: string) => {
    setState(prev => ({ ...prev, paymentMethod: method }));
    selectPaymentMethod(method);
  }, [selectPaymentMethod]);

  // Apply promotion
  const applyPromotion = useCallback(async (code: string) => {
    try {
      const response = await fetch('/api/promotions/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal: state.subtotal }),
      });
      const data = await response.json();
      if (data.valid) {
        setState(prev => ({
          ...prev,
          discount: data.discount,
          promotionCode: code,
        }));
        calculateTotals();
        toast.success(`Promotion applied: ${data.discountAmount} off`);
      } else {
        toast.error(data.message || 'Invalid promotion code');
      }
    } catch (error) {
      toast.error('Failed to apply promotion');
    }
  }, [state.subtotal, calculateTotals]);

  // Remove promotion
  const removePromotion = useCallback(() => {
    setState(prev => ({
      ...prev,
      discount: 0,
      promotionCode: '',
    }));
    calculateTotals();
  }, [calculateTotals]);

  // Apply loyalty points
  const applyLoyaltyPoints = useCallback((points: number) => {
    const discount = points * 0.1;
    setState(prev => ({
      ...prev,
      loyaltyPointsUsed: points,
      discount: prev.discount + discount,
    }));
    calculateTotals();
  }, [calculateTotals]);

  // Process payment (integrated with PaymentContext)
  const processPayment = useCallback(async () => {
    try {
      const paymentData = {
        amount: state.total,
        paymentMethod: state.paymentMethod,
        saleId: state.cartId,
        customerId: state.customerId,
        metadata: {
          customerInfo: state.customerInfo,
          items: state.items,
          notes: state.notes,
          promotionCode: state.promotionCode,
          loyaltyPointsUsed: state.loyaltyPointsUsed,
        },
      };

      const payment = await processPaymentService(paymentData);
      
      // Update checkout state with payment info
      setState(prev => ({
        ...prev,
        total: payment.amount,
      }));

      toast.success('Payment processed successfully');
      return payment;
    } catch (error) {
      console.error('Payment failed:', error);
      throw error;
    }
  }, [state, processPaymentService]);

  // Place order (integrated with payment)
  const placeOrder = useCallback(async () => {
    try {
      // First process payment
      const payment = await processPayment();

      // Then create the order
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...state,
          payment,
          orderDate: new Date().toISOString(),
        }),
      });
      const data = await response.json();
      
      if (data.success) {
        clearCart();
        resetCheckout();
        toast.success('Order placed successfully!');
        return data.order;
      }
      throw new Error(data.message || 'Order failed');
    } catch (error) {
      console.error('Order placement failed:', error);
      toast.error('Failed to place order');
      throw error;
    }
  }, [state, processPayment, clearCart]);

  // Reset checkout
  const resetCheckout = useCallback(() => {
    setState(initialState);
  }, []);

  // Calculate totals when items change
  useEffect(() => {
    calculateTotals();
  }, [calculateTotals]);

  const value: CheckoutContextType = {
    state,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    loadCart,
    updateCustomerInfo,
    setPaymentMethod,
    applyPromotion,
    removePromotion,
    applyLoyaltyPoints,
    calculateTotals,
    placeOrder,
    processPayment,
    resetCheckout,
  };

  return (
    <CheckoutContext.Provider value={value}>
      {children}
    </CheckoutContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useCheckout() {
  const context = useContext(CheckoutContext);
  if (context === undefined) {
    throw new Error('useCheckout must be used within a CheckoutProvider');
  }
  return context;
}

export { CheckoutContext };
export type { CheckoutContextType, CheckoutState, CheckoutItem, CustomerInfo };
