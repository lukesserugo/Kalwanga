'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from 'react';
import { toast } from '../utils/toast-manager';
import { checkoutService } from '../services/checkoutService';
import type {
  CheckoutSummary,
  CanonicalPaymentMethod,
} from '../types/checkout';
import type { PaymentMethod } from '../services/saleService';
import { usePayment } from './PaymentContext';

// ============================================
// LOCAL TYPES
// ============================================
//
// The summary endpoint (`GET /checkout/summary/:cartId`) is typed in
// `types/checkout.ts` as a flattened `CheckoutSummary`, but the
// backend service actually returns the raw Prisma cart shape with
// nested `product` / `variant` on each item and a `customer` object.
// These local interfaces describe what the endpoint really emits so
// the mapping code below can read those fields without a cast.

interface RawCartItem {
  id: string;
  productId: string;
  product?: {
    id: string;
    name: string;
    images?: string[] | null;
    unitPrice?: number;
  };
  variantId?: string | null;
  variant?: {
    id: string;
    name: string;
    price?: number;
  };
  quantity: number;
  unitPrice: number;
  total: number;
}

interface RawCartCustomer {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
}

interface RawCartSummary extends CheckoutSummary {
  items: RawCartItem[];
  customer?: RawCartCustomer | null;
}

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

/**
 * Payment methods this context can hold.
 *
 * Narrowed from `string` to the canonical union so downstream code
 * (`checkoutService.processCheckout`) accepts the value without a
 * cast. Includes both alias forms (`CARD`, `MOBILE`, …) and
 * canonical Prisma enum values (`CREDIT_CARD`, `MOBILE_MONEY`, …).
 */
type CheckoutPaymentMethod = CanonicalPaymentMethod | PaymentMethod;

interface CheckoutState {
  items: CheckoutItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  customerInfo: CustomerInfo;
  paymentMethod: CheckoutPaymentMethod;
  loyaltyPointsUsed: number;
  promotionCode: string;
  notes: string;
  cartId?: string;
  customerId?: string;
  businessUnitId?: string;
}

interface CheckoutContextType {
  state: CheckoutState;
  addItem: (item: CheckoutItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  loadCart: (cartId: string) => Promise<void>;
  updateCustomerInfo: (info: Partial<CustomerInfo>) => void;
  setPaymentMethod: (method: CheckoutPaymentMethod) => void;
  applyPromotion: (code: string) => Promise<void>;
  removePromotion: () => void;
  applyLoyaltyPoints: (points: number) => void;
  calculateTotals: () => void;
  placeOrder: () => Promise<any>;
  processPayment: () => Promise<any>;
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
  const {
    processPayment: processPaymentService,
    selectPaymentMethod,
  } = usePayment();

  // Calculate totals
  const calculateTotals = useCallback(() => {
    setState(prev => {
      const subtotal = prev.items.reduce((sum, item) => sum + item.total, 0);
      const tax = subtotal * 0.1;
      const total = subtotal + tax - prev.discount;
      return { ...prev, subtotal, tax, total };
    });
  }, []);

  // Load cart
  const loadCart = useCallback(async (cartId: string) => {
    try {
      // The summary endpoint returns the raw cart shape at runtime,
      // even though the wire type is the flattened `CheckoutSummary`.
      // Read it as `RawCartSummary` so the nested `product`,
      // `variant`, and `customer` fields are available.
      const response = (await checkoutService.getCheckoutSummaryByCart(
        cartId,
      )) as unknown as RawCartSummary;

      if (!response) return;

      const items: CheckoutItem[] = (response.items || []).map(item => ({
        id: item.id || `item_${item.productId}_${item.variantId ?? ''}`,
        productId: item.productId,
        name: item.product?.name || 'Product',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        total: item.total ?? (item.quantity || 1) * (item.unitPrice || 0),
        image: item.product?.images?.[0],
        variant: item.variant?.name,
        variantId: item.variantId ?? undefined,
      }));

      setState(prev => ({
        ...prev,
        items,
        subtotal: response.subtotal || 0,
        tax: response.tax || 0,
        discount: response.discount || 0,
        total: response.total || 0,
        cartId,
        customerId: response.customer?.id ?? response.customerId,
      }));

      if (response.customer) {
        const c = response.customer;
        setState(prev => ({
          ...prev,
          customerInfo: {
            ...prev.customerInfo,
            name: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
            email: c.email ?? '',
            phone: c.phoneNumber ?? '',
            address: c.address ?? '',
          },
        }));
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
            ? {
                ...i,
                quantity: i.quantity + item.quantity,
                total: (i.quantity + item.quantity) * i.unitPrice,
              }
            : i,
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
          : item,
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
  const setPaymentMethod = useCallback(
    (method: CheckoutPaymentMethod) => {
      setState(prev => ({ ...prev, paymentMethod: method }));
      selectPaymentMethod(method);
    },
    [selectPaymentMethod],
  );

  // Apply promotion
  //
  // ⚠ There is no standalone `POST /api/promotions/validate` endpoint.
  //   Discounts are applied server-side via
  //   `POST /checkout/:id/discount` (see `checkoutService.applyDiscount`).
  const applyPromotion = useCallback(async (code: string) => {
    if (!state.cartId) {
      toast.error('Cart is not ready. Please add items first.');
      return;
    }

    try {
      const result = await checkoutService.applyDiscount(state.cartId, {
        code,
      });

      // The sale returned by `applyDiscount` carries the authoritative
      // discount figure. Mirror it into local state.
      const discountAmount = Number((result as any)?.discount) || 0;

      setState(prev => ({
        ...prev,
        discount: discountAmount,
        promotionCode: code,
      }));

      calculateTotals();
      toast.success('Promotion applied');
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Invalid promotion code';
      toast.error(message);
      throw error;
    }
  }, [state.cartId, calculateTotals]);

  // Remove promotion
  const removePromotion = useCallback(async () => {
    if (state.cartId) {
      try {
        await checkoutService.removeDiscount(state.cartId);
      } catch (error) {
        console.error('Failed to remove discount server-side:', error);
      }
    }
    setState(prev => ({
      ...prev,
      discount: 0,
      promotionCode: '',
    }));
    calculateTotals();
  }, [state.cartId, calculateTotals]);

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

  // Process payment (delegated to PaymentContext)
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

      setState(prev => ({ ...prev, total: payment.amount }));

      toast.success('Payment processed successfully');
      return payment;
    } catch (error) {
      console.error('Payment failed:', error);
      throw error;
    }
  }, [state, processPaymentService]);

  // Reset checkout
  const resetCheckout = useCallback(() => {
    setState(initialState);
  }, []);

  // Place order — offline checkout via `checkoutService.processCheckout`.
  //
  // ⚠ The previous implementation hit `/api/checkout` directly with
  //   `fetch`, bypassing the API client (no auth header, no base URL
  //   resolution, no error normalization). It also ran payment first,
  //   then created the order — so a payment-then-order failure left
  //   money captured with no sale row. The backend's `POST /checkout`
  //   path creates the Sale and Payment atomically; use it.
  const placeOrder = useCallback(async () => {
    if (!state.cartId) {
      throw new Error('No cart to check out');
    }

    try {
      const response = await checkoutService.processCheckout({
        cartId: state.cartId,
        paymentMethod: state.paymentMethod,
        paidAmount: state.total,
        customerId: state.customerId,
        customerEmail: state.customerInfo.email || undefined,
        customerPhone: state.customerInfo.phone || undefined,
        customerName: state.customerInfo.name || undefined,
        customerAddress: state.customerInfo.address || undefined,
        discount: state.discount,
        notes: state.notes || undefined,
        applyLoyaltyPoints: state.loyaltyPointsUsed > 0,
        promotionCode: state.promotionCode || undefined,
      });

      clearCart();
      resetCheckout();
      toast.success('Order placed successfully!');
      return response;
    } catch (error) {
      console.error('Order placement failed:', error);
      toast.error('Failed to place order');
      throw error;
    }
  }, [state, clearCart, resetCheckout]);

  // Recalculate totals whenever items change
  useEffect(() => {
    calculateTotals();
  }, [state.items, calculateTotals]);

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
export type {
  CheckoutContextType,
  CheckoutState,
  CheckoutItem,
  CustomerInfo,
  CheckoutPaymentMethod,
};
