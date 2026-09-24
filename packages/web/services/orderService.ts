// D:\Projects\Kalwanga\packages\web\services\orderService.ts

import { api } from './api';
import type {
  Order,
  OrderAnalytics,
  OrderDashboardData,
  OrderFulfillmentStatus,
  OrderHistoryEntry,
  OrderListResponse,
  OrderSearchParams,
  OrderStats,
  OrderTimelineEntry,
  CreateOrderPayload,
  UpdateOrderPayload,
  UpdateOrderStatusPayload,
  BulkUpdateStatusPayload,
  BulkDeleteOrdersPayload,
} from '../types/order';
import type { Sale } from '../types/sale';

export type {
  Order,
  OrderListResponse,
  OrderSearchParams,
  OrderStats,
  OrderDashboardData,
  OrderAnalytics,
  OrderFulfillmentStatus,
  OrderHistoryEntry,
  OrderTimelineEntry,
  CreateOrderPayload,
  UpdateOrderPayload,
  UpdateOrderStatusPayload,
  BulkUpdateStatusPayload,
  BulkDeleteOrdersPayload,
};

// ============================================
// COMPATIBILITY SHAPE
// ============================================

/**
 * Legacy shape returned by the previous version of this service.
 * Kept as a compatibility alias so existing callers that read
 * `.total` / `.page` / `.totalPages` at the top level keep working.
 *
 * New code should read `.pagination.total` etc.
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  stats?: OrderStats;
}

// ============================================
// SERVICE
// ============================================

export const orderService = {
  // ============================================
  // LIST / READ
  // ============================================

  /**
   * GET /orders
   *
   * Returns the full envelope including the compatibility accessors
   * (`.total`, `.page`, `.totalPages`, `.limit`) so old callers
   * keep working while new code reads `.pagination`.
   */
  async getAllOrders(
    params?: OrderSearchParams,
  ): Promise<OrderListResponse & PaginatedResponse<Order>> {
    const response = await api.get<OrderListResponse>('/orders', {
      params,
    });

    return withCompat(response);
  },

  async getOrderById(id: string): Promise<Order> {
    const response = await api.get<{ data: Order }>(`/orders/${id}`);
    return response.data;
  },

  async getOrderByNumber(orderNumber: string): Promise<Order> {
    const response = await api.get<{ data: Order }>(
      `/orders/number/${orderNumber}`,
    );
    return response.data;
  },

  async getOrdersByCustomer(
    customerId: string,
    params?: { page?: number; limit?: number },
  ): Promise<OrderListResponse & PaginatedResponse<Order>> {
    const response = await api.get<OrderListResponse>(
      `/orders/customer/${customerId}`,
      { params },
    );
    return withCompat(response);
  },

  async getOrdersByStatus(
    status: string,
    params?: { page?: number; limit?: number },
  ): Promise<OrderListResponse & PaginatedResponse<Order>> {
    const response = await api.get<OrderListResponse>(
      `/orders/status/${status}`,
      { params },
    );
    return withCompat(response);
  },

  async getOrdersByDateRange(params: {
    startDate: string;
    endDate: string;
  }): Promise<Order[]> {
    const response = await api.get<{ data: Order[] }>(
      '/orders/date-range',
      { params },
    );
    return response.data;
  },

  // ============================================
  // STATS / DASHBOARD
  // ============================================

  /** GET /orders/stats */
  async getOrderStats(): Promise<OrderStats> {
    const response = await api.get<{ data: OrderStats }>(
      '/orders/stats',
    );
    return response.data;
  },

  /** GET /orders/dashboard */
  async getDashboardOrderData(): Promise<OrderDashboardData> {
    const response = await api.get<{ data: OrderDashboardData }>(
      '/orders/dashboard',
    );
    return response.data;
  },

  /** GET /orders/analytics */
  async getOrderAnalytics(params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<OrderAnalytics> {
    const response = await api.get<{ data: OrderAnalytics }>(
      '/orders/analytics',
      { params },
    );
    return response.data;
  },

  /** GET /orders/fulfillment */
  async getOrderFulfillmentStatus(): Promise<OrderFulfillmentStatus> {
    const response = await api.get<{ data: OrderFulfillmentStatus }>(
      '/orders/fulfillment',
    );
    return response.data;
  },

  // ============================================
  // HISTORY / TIMELINE
  // ============================================

  /** GET /orders/:orderId/history */
  async getOrderHistory(orderId: string): Promise<OrderHistoryEntry[]> {
    const response = await api.get<{
      data: OrderHistoryEntry[];
      count: number;
    }>(`/orders/${orderId}/history`);
    return response.data;
  },

  /** GET /orders/:orderId/timeline */
  async getOrderTimeline(orderId: string): Promise<OrderTimelineEntry[]> {
    const response = await api.get<{
      data: OrderTimelineEntry[];
      count: number;
    }>(`/orders/${orderId}/timeline`);
    return response.data;
  },

  // ============================================
  // WRITE
  // ============================================

  /** POST /orders */
  async createOrder(data: CreateOrderPayload): Promise<Order> {
    const response = await api.post<{ data: Order }>('/orders', data);
    return response.data;
  },

  /** PUT /orders/:id */
  async updateOrder(
    id: string,
    data: UpdateOrderPayload,
  ): Promise<Order> {
    const response = await api.put<{ data: Order }>(`/orders/${id}`, data);
    return response.data;
  },

  /** PATCH /orders/:id/status */
  async updateOrderStatus(
    id: string,
    status: string,
    notes?: string,
  ): Promise<Order> {
    const payload: UpdateOrderStatusPayload = {
      status: status as UpdateOrderStatusPayload['status'],
      ...(notes !== undefined ? { notes } : {}),
    };
    const response = await api.patch<{ data: Order }>(
      `/orders/${id}/status`,
      payload,
    );
    return response.data;
  },

  /** POST /orders/:id/cancel */
  async cancelOrder(id: string, reason: string): Promise<Order> {
    const response = await api.post<{ data: Order }>(
      `/orders/${id}/cancel`,
      { reason },
    );
    return response.data;
  },

  /** POST /orders/:orderId/convert-to-sale */
  async convertOrderToSale(orderId: string): Promise<Sale> {
    const response = await api.post<{ data: Sale }>(
      `/orders/${orderId}/convert-to-sale`,
    );
    return response.data;
  },

  /** PATCH /orders/bulk-status */
  async bulkUpdateStatus(
    payload: BulkUpdateStatusPayload,
  ): Promise<{ updated: number; failed: number }> {
    const response = await api.patch<{
      data: { updated: number; failed: number };
    }>('/orders/bulk-status', payload);
    return response.data;
  },

  /** DELETE /orders/bulk */
  async bulkDeleteOrders(
    payload: BulkDeleteOrdersPayload,
  ): Promise<{ deleted: number }> {
    const response = await api.delete<{ data: { deleted: number } }>(
      '/orders/bulk',
      { data: payload },
    );
    return response.data;
  },

  /** DELETE /orders/:id */
  async deleteOrder(id: string): Promise<{ success: boolean }> {
    const response = await api.delete<{ data: { success: boolean } }>(
      `/orders/${id}`,
    );
    return response.data;
  },

  // ============================================
  // ITEMS
  // ============================================

  /** POST /orders/:orderId/items */
  async addItemToOrder(
    orderId: string,
    item: {
      productId: string;
      variantId?: string;
      quantity: number;
      notes?: string;
    },
  ): Promise<Order> {
    const response = await api.post<{ data: Order }>(
      `/orders/${orderId}/items`,
      item,
    );
    return response.data;
  },

  /** PUT /orders/:orderId/items/:itemId */
  async updateOrderItem(
    orderId: string,
    itemId: string,
    data: {
      quantity: number;
      discount?: number;
      notes?: string;
    },
  ): Promise<Order> {
    const response = await api.put<{ data: Order }>(
      `/orders/${orderId}/items/${itemId}`,
      data,
    );
    return response.data;
  },

  /** DELETE /orders/:orderId/items/:itemId */
  async removeOrderItem(
    orderId: string,
    itemId: string,
  ): Promise<Order> {
    const response = await api.delete<{ data: Order }>(
      `/orders/${orderId}/items/${itemId}`,
    );
    return response.data;
  },

  // ============================================
  // EXPORTS
  // ============================================

  /** GET /orders/export — JSON payload */
  async exportOrdersJson(params: {
    startDate: string;
    endDate: string;
  }): Promise<{
    success: true;
    data: unknown[];
    format: string;
    total: number;
  }> {
    return api.get('/orders/export', {
      params: { ...params, format: 'json' },
    });
  },

  /** GET /orders/export/csv — CSV text */
  async exportOrdersCsv(params: {
    startDate: string;
    endDate: string;
  }): Promise<Blob> {
    return api.get<Blob>('/orders/export/csv', {
      params,
      responseType: 'blob',
    });
  },

  /**
   * GET /orders/export/excel
   *
   * ⚠ The backend route exists but currently returns JSON with a
   * "would be generated here" message. Kept on the service so
   * callers can discover it; treat the result as a placeholder
   * until the backend implements the real xlsx generator.
   */
  async exportOrdersExcel(params: {
    startDate: string;
    endDate: string;
  }): Promise<unknown> {
    return api.get('/orders/export/excel', { params });
  },

  /**
   * GET /orders/export/pdf
   *
   * Same placeholder status as `exportOrdersExcel`.
   */
  async exportOrdersPdf(params: {
    startDate: string;
    endDate: string;
  }): Promise<unknown> {
    return api.get('/orders/export/pdf', { params });
  },
};

// ============================================
// MODULE-LEVEL HELPERS
// ============================================

/**
 * Attach legacy accessors (`total`, `page`, `totalPages`, `limit`)
 * to the modern envelope without duplicating them as enumerable
 * properties.
 */
function withCompat(
  response: OrderListResponse,
): OrderListResponse & PaginatedResponse<Order> {
  const { pagination } = response;

  Object.defineProperties(response, {
    total: {
      get: () => pagination.total,
      enumerable: false,
      configurable: true,
    },
    page: {
      get: () => pagination.page,
      enumerable: false,
      configurable: true,
    },
    totalPages: {
      get: () => pagination.totalPages,
      enumerable: false,
      configurable: true,
    },
    limit: {
      get: () => pagination.limit,
      enumerable: false,
      configurable: true,
    },
  });

  return response as OrderListResponse & PaginatedResponse<Order>;
}

export default orderService;
