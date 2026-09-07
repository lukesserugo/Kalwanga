// D:\Projects\Kalwanga\packages\web\stores\posStore.ts
import { create } from 'zustand';
import { api } from '../../services/api';  // Change from apiService to api
import { Cart, CartItem, Product, Customer, Sale } from '../../types';

interface POSState {
  // Cart state
  cart: Cart | null;
  cartItems: CartItem[];
  cartTotal: number;
  cartSubtotal: number;
  cartTax: number;
  cartDiscount: number;
  
  // UI state
  isLoading: boolean;
  isCheckoutOpen: boolean;
  isCustomerSearchOpen: boolean;
  isDiscountModalOpen: boolean;
  
  // Customer state
  selectedCustomer: Customer | null;
  
  // Product search
  searchQuery: string;
  searchResults: Product[];
  
  // Actions
  loadCart: () => Promise<void>;
  addItem: (productId: string, quantity?: number, variantId?: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  applyDiscount: (discount: number) => Promise<void>;
  selectCustomer: (customer: Customer | null) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: Product[]) => void;
  openCheckout: () => void;
  closeCheckout: () => void;
  processCheckout: (paymentData: any) => Promise<Sale>;
  reset: () => void;
}

export const usePOSStore = create<POSState>((set, get) => ({
  // Initial state
  cart: null,
  cartItems: [],
  cartTotal: 0,
  cartSubtotal: 0,
  cartTax: 0,
  cartDiscount: 0,
  isLoading: false,
  isCheckoutOpen: false,
  isCustomerSearchOpen: false,
  isDiscountModalOpen: false,
  selectedCustomer: null,
  searchQuery: '',
  searchResults: [],

  // Actions
  loadCart: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get<Cart>('/cart');
      set({
        cart: response,
        cartItems: response.items || [],
        cartSubtotal: response.subtotal || 0,
        cartTax: response.tax || 0,
        cartDiscount: response.discount || 0,
        cartTotal: response.total || 0,
      });
    } catch (error) {
      console.error('Failed to load cart:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addItem: async (productId: string, quantity: number = 1, variantId?: string) => {
    set({ isLoading: true });
    try {
      const response = await api.post<Cart>('/cart/items', { productId, quantity, variantId });
      set({
        cart: response,
        cartItems: response.items || [],
        cartSubtotal: response.subtotal || 0,
        cartTax: response.tax || 0,
        cartDiscount: response.discount || 0,
        cartTotal: response.total || 0,
      });
    } catch (error) {
      console.error('Failed to add item:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateQuantity: async (itemId: string, quantity: number) => {
    set({ isLoading: true });
    try {
      const response = await api.put<Cart>(`/cart/items/${itemId}`, { quantity });
      set({
        cart: response,
        cartItems: response.items || [],
        cartSubtotal: response.subtotal || 0,
        cartTax: response.tax || 0,
        cartDiscount: response.discount || 0,
        cartTotal: response.total || 0,
      });
    } catch (error) {
      console.error('Failed to update quantity:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  removeItem: async (itemId: string) => {
    set({ isLoading: true });
    try {
      const response = await api.delete<Cart>(`/cart/items/${itemId}`);
      set({
        cart: response,
        cartItems: response.items || [],
        cartSubtotal: response.subtotal || 0,
        cartTax: response.tax || 0,
        cartDiscount: response.discount || 0,
        cartTotal: response.total || 0,
      });
    } catch (error) {
      console.error('Failed to remove item:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  clearCart: async () => {
    set({ isLoading: true });
    try {
      const response = await api.delete<Cart>('/cart');
      set({
        cart: response,
        cartItems: [],
        cartSubtotal: 0,
        cartTax: 0,
        cartDiscount: 0,
        cartTotal: 0,
      });
    } catch (error) {
      console.error('Failed to clear cart:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  applyDiscount: async (discount: number) => {
    set({ isLoading: true });
    try {
      const response = await api.post<Cart>('/cart/discount', { discount });
      set({
        cart: response,
        cartSubtotal: response.subtotal || 0,
        cartTax: response.tax || 0,
        cartDiscount: response.discount || 0,
        cartTotal: response.total || 0,
      });
      set({ isDiscountModalOpen: false });
    } catch (error) {
      console.error('Failed to apply discount:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  selectCustomer: (customer: Customer | null) => {
    set({ selectedCustomer: customer });
    if (customer) {
      api.post('/cart/customer', { customerId: customer.id }).then(response => {
        set({ cart: response });
      }).catch(console.error);
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setSearchResults: (results: Product[]) => {
    set({ searchResults: results });
  },

  openCheckout: () => {
    set({ isCheckoutOpen: true });
  },

  closeCheckout: () => {
    set({ isCheckoutOpen: false });
  },

  processCheckout: async (paymentData: any): Promise<Sale> => {
    set({ isLoading: true });
    try {
      const response = await api.post<Sale>('/checkout', paymentData);
      set({
        cart: null,
        cartItems: [],
        cartSubtotal: 0,
        cartTax: 0,
        cartDiscount: 0,
        cartTotal: 0,
        isCheckoutOpen: false,
      });
      return response;
    } catch (error) {
      console.error('Failed to process checkout:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  reset: () => {
    set({
      cart: null,
      cartItems: [],
      cartTotal: 0,
      cartSubtotal: 0,
      cartTax: 0,
      cartDiscount: 0,
      isLoading: false,
      isCheckoutOpen: false,
      isCustomerSearchOpen: false,
      isDiscountModalOpen: false,
      selectedCustomer: null,
      searchQuery: '',
      searchResults: [],
    });
  },
}));
