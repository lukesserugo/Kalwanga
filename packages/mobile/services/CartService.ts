import AsyncStorage from "@react-native-async-storage/async-storage";
import { CartItem } from "@pos/shared/types";

const CART_KEY = "@pos_cart";

export class CartService {
  static async getCart(): Promise<CartItem[]> {
    try {
      const cart = await AsyncStorage.getItem(CART_KEY);
      return cart ? JSON.parse(cart) : [];
    } catch (error) {
      console.error("Error loading cart:", error);
      return [];
    }
  }

  static async saveCart(items: CartItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch (error) {
      console.error("Error saving cart:", error);
    }
  }

  static async addItem(item: CartItem): Promise<CartItem[]> {
    const cart = await this.getCart();
    const existing = cart.find((i) => i.productId === item.productId);

    if (existing) {
      existing.quantity += item.quantity;
      existing.total = existing.quantity * existing.unitPrice;
    } else {
      cart.push({
        ...item,
        total: item.quantity * item.unitPrice,
      });
    }

    await this.saveCart(cart);
    return cart;
  }

  static async removeItem(productId: string): Promise<CartItem[]> {
    const cart = await this.getCart();
    const filtered = cart.filter((i) => i.productId !== productId);
    await this.saveCart(filtered);
    return filtered;
  }

  static async updateQuantity(productId: string, quantity: number): Promise<CartItem[]> {
    const cart = await this.getCart();
    const item = cart.find((i) => i.productId === productId);

    if (item) {
      if (quantity <= 0) {
        return this.removeItem(productId);
      }
      item.quantity = quantity;
      item.total = quantity * item.unitPrice;
      await this.saveCart(cart);
    }

    return cart;
  }

  static async clearCart(): Promise<void> {
    await AsyncStorage.removeItem(CART_KEY);
  }

  static async getTotal(): Promise<number> {
    const cart = await this.getCart();
    return cart.reduce((sum, item) => sum + item.total, 0);
  }

  static async getItemCount(): Promise<number> {
    const cart = await this.getCart();
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }
}
