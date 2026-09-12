// D:\Projects\Kalwanga\packages\web\services\orderService.ts
import { api } from './api';
import type { Order, OrderSearchParams } from '../types';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  stats?: any;
}

export interface CreateOrderPayload {
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    notes?: string;
  }>;
  customerId?: string;
  discount?: number;
  tax?: number;
  notes?: string;
  businessUnitId?: string;  // ✅ optional — backend resolves it
  expectedDeliveryDate?: string;
  shippingAddress?: string;
  paymentMethod?: string;
  paymentTerms?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export const orderService = {
  /**
   * GET /orders
   * Requests the raw backend envelope so pagination + stats are preserved.
   */
  async getAllOrders(params?: OrderSearchParams): Promise<PaginatedResponse<Order>> {
    const response: any = await api.get('/orders', {
      params,
      rawResponse: true,
    } as any);

    // Case A: backend envelope { success, data: [...], pagination, stats }
    if (response && Array.isArray(response.data)) {
      const pagination = response.pagination || {};
      return {
        data: response.data,
        total: pagination.total ?? response.data.length,
        page: pagination.page ?? 1,
        totalPages: pagination.totalPages ?? 1,
        limit: pagination.limit ?? 20,
        stats: response.stats,
      };
    }

    // Case B: bare array (defensive)
    if (Array.isArray(response)) {
      return {
        data: response,
        total: response.length,
        page: params?.page ?? 1,
        totalPages: 1,
        limit: params?.limit ?? response.length ?? 20,
      };
    }

    return { data: [], total: 0, page: 1, totalPages: 1, limit: 20 };
  },

  async getOrderById(id: string): Promise<Order> {
    const response: any = await api.get(`/orders/${id}`);
    return response?.data ?? response;
  },

  async getOrderByNumber(orderNumber: string): Promise<Order> {
    const response: any = await api.get(`/orders/number/${orderNumber}`);
    return response?.data ?? response;
  },

  async getOrdersByCustomer(customerId: string, params?: { page?: number; limit?: number }) {
    const response: any = await api.get(`/orders/customer/${customerId}`, {
      params,
      rawResponse: true,
    } as any);
    return {
      data: response?.data ?? [],
      total: response?.pagination?.total ?? 0,
      page: response?.pagination?.page ?? 1,
      totalPages: response?.pagination?.totalPages ?? 1,
      limit: response?.pagination?.limit ?? 20,
    };
  },

  async createOrder(data: CreateOrderPayload): Promise<Order> {
    const response: any = await api.post('/orders', data);
    return response?.data ?? response;
  },

  /** Backend route is PATCH /orders/:id/status */
  async updateOrderStatus(id: string, status: string, notes?: string): Promise<Order> {
    const response: any = await api.patch(`/orders/${id}/status`, { status, notes });
    return response?.data ?? response;
  },

  /** Backend route is PUT /orders/:id (status included in body) */
  async updateOrder(id: string, data: Partial<Order> & { status?: string }): Promise<Order> {
    const response: any = await api.put(`/orders/${id}`, data);
    return response?.data ?? response;
  },

  async cancelOrder(id: string, reason: string): Promise<Order> {
    const response: any = await api.post(`/orders/${id}/cancel`, { reason });
    return response?.data ?? response;
  },

  /** Backend route is POST /orders/:orderId/convert-to-sale */
  async convertOrderToSale(id: string): Promise<Order> {
    const response: any = await api.post(`/orders/${id}/convert-to-sale`);
    return response?.data ?? response;
  },

  async addItemToOrder(orderId: string, item: CreateOrderPayload['items'][number]) {
    const response: any = await api.post(`/orders/${orderId}/items`, item);
    return response?.data ?? response;
  },

  async updateOrderItem(orderId: string, itemId: string, data: any) {
    const response: any = await api.put(`/orders/${orderId}/items/${itemId}`, data);
    return response?.data ?? response;
  },

  async removeOrderItem(orderId: string, itemId: string) {
    const response: any = await api.delete(`/orders/${orderId}/items/${itemId}`);
    return response?.data ?? response;
  },

  async getOrderHistory(orderId: string) {
    const response: any = await api.get(`/orders/${orderId}/history`);
    return response?.data ?? response;
  },

  async getOrderTimeline(orderId: string) {
    const response: any = await api.get(`/orders/${orderId}/timeline`);
    return response?.data ?? response;
  },
};

export default orderService;
