// D:\Projects\Kalwanga\packages\web\services\orderService.ts
import { api } from './api';
import { Order, OrderSearchParams } from '../types';

// Define PaginatedResponse locally since it's not exported from types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export const orderService = {
  /**
   * Get all orders - calls GET /orders
   */
  async getAllOrders(params?: OrderSearchParams): Promise<PaginatedResponse<Order>> {
    const response = await api.get<PaginatedResponse<Order>>('/orders', { params });
    return response;
  },

  /**
   * Get order by ID - calls GET /orders/:id
   */
  async getOrderById(id: string): Promise<Order> {
    const response = await api.get<Order>(`/orders/${id}`);
    return response;
  },

  /**
   * Get order by order number - calls GET /orders/number/:orderNumber
   */
  async getOrderByNumber(orderNumber: string): Promise<Order> {
    const response = await api.get<Order>(`/orders/number/${orderNumber}`);
    return response;
  },

  /**
   * Create order - calls POST /orders
   */
  async createOrder(data: {
    items: Array<{ productId: string; variantId?: string; quantity: number; unitPrice: number }>;
    customerId?: string;
    discount?: number;
    notes?: string;
    businessUnitId: string;
  }): Promise<Order> {
    const response = await api.post<Order>('/orders', data);
    return response;
  },

  /**
   * Update order status - calls PUT /orders/:id/status
   */
  async updateOrderStatus(id: string, status: string): Promise<Order> {
    const response = await api.put<Order>(`/orders/${id}/status`, { status });
    return response;
  },

  /**
   * Cancel order - calls POST /orders/:id/cancel
   */
  async cancelOrder(id: string, reason: string): Promise<Order> {
    const response = await api.post<Order>(`/orders/${id}/cancel`, { reason });
    return response;
  },

  /**
   * Convert order to sale - calls POST /orders/:id/convert
   */
  async convertOrderToSale(id: string): Promise<Order> {
    const response = await api.post<Order>(`/orders/${id}/convert`);
    return response;
  },
};
