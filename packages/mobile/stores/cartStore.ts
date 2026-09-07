import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CartItem } from "@pos/shared/types";

interface CartState {
  items: CartItem[];
  total: number;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  calculateTotal: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      total: 0,

      addItem: (item) => {
        const items = get().items;
        const existing = items.find((i) => i.productId === item.productId);

        if (existing) {
          existing.quantity += item.quantity;
          existing.total = existing.quantity * existing.unitPrice;
          set({ items });
        } else {
          set({ items: [...items, { ...item, total: item.quantity * item.unitPrice }] });
        }
        get().calculateTotal();
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((i) => i.productId !== productId) });
        get().calculateTotal();
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }

        const items = get().items.map((item) =>
          item.productId === productId
            ? { ...item, quantity, total: quantity * item.unitPrice }
            : item
        );
        set({ items });
        get().calculateTotal();
      },

      clearCart: () => {
        set({ items: [], total: 0 });
      },

      calculateTotal: () => {
        const total = get().items.reduce((sum, item) => sum + item.total, 0);
        set({ total });
      },
    }),
    {
      name: "cart-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
