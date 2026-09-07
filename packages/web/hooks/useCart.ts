// src/hooks/useCart.ts
import { useState, useEffect, useCallback } from 'react';
import { cartService } from '../services/cartService';

interface CartItem {
  id: string;
  productId: string;
  product: { name: string; sku: string; images?: string[] };
  variantId?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
}

export function useCart() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);

  const loadCart = useCallback(async () => {
    try {
      setLoading(true);
      const data = await cartService.getCart();
      setCart(data);
      setCount(data.items?.length || 0);
    } catch (error) {
      console.error('Failed to load cart:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const addItem = async (productId: string, quantity: number = 1, variantId?: string) => {
    try {
      const updated = await cartService.addItem({ productId, quantity, variantId });
      setCart(updated);
      setCount(updated.items?.length || 0);
      return updated;
    } catch (error) {
      throw error;
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    try {
      const updated = await cartService.updateItemQuantity(itemId, quantity);
      setCart(updated);
      return updated;
    } catch (error) {
      throw error;
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      const updated = await cartService.removeItem(itemId);
      setCart(updated);
      setCount(updated.items?.length || 0);
      return updated;
    } catch (error) {
      throw error;
    }
  };

  const clearCart = async () => {
    try {
      const updated = await cartService.clearCart();
      setCart(updated);
      setCount(0);
      return updated;
    } catch (error) {
      throw error;
    }
  };

  const applyDiscount = async (discount: number) => {
    try {
      const updated = await cartService.applyDiscount(discount);
      setCart(updated);
      return updated;
    } catch (error) {
      throw error;
    }
  };

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  return {
    cart,
    loading,
    count,
    loadCart,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    applyDiscount,
  };
}
