import { api } from './api';
import { PurchaseOrder } from '../types';

// Define PaginatedResponse locally since it's not exported from types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export const purchaseOrderService = {
  /**
   * Get all purchase orders - calls GET /api/purchase-orders
   */
  async getAllPurchaseOrders(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    supplierId?: string;
    businessUnitId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<PurchaseOrder>> {
    const response = await api.get<PaginatedResponse<PurchaseOrder>>('/api/purchase-orders', { params });
    return response;
  },

  /**
   * Get purchase order by ID - calls GET /api/purchase-orders/:id
   */
  async getPurchaseOrderById(id: string): Promise<PurchaseOrder> {
    const response = await api.get<PurchaseOrder>(`/api/purchase-orders/${id}`);
    return response;
  },

  /**
   * Create purchase order - calls POST /api/purchase-orders
   */
  async createPurchaseOrder(data: {
    supplierId: string;
    items: Array<{ productId: string; variantId?: string; quantity: number; unitPrice: number }>;
    notes?: string;
    expectedDelivery?: string;
    businessUnitId: string;
  }): Promise<PurchaseOrder> {
    const response = await api.post<PurchaseOrder>('/api/purchase-orders', data);
    return response;
  },

  /**
   * Update purchase order - calls PUT /api/purchase-orders/:id
   */
  async updatePurchaseOrder(id: string, data: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    const response = await api.put<PurchaseOrder>(`/api/purchase-orders/${id}`, data);
    return response;
  },

  /**
   * Cancel purchase order - calls POST /api/purchase-orders/:id/cancel
   */
  async cancelPurchaseOrder(id: string, reason: string): Promise<PurchaseOrder> {
    const response = await api.post<PurchaseOrder>(`/api/purchase-orders/${id}/cancel`, { reason });
    return response;
  },

  /**
   * Receive purchase order - calls POST /api/purchase-orders/:id/receive
   */
  async receivePurchaseOrder(id: string, items: Array<{ itemId: string; quantity: number }>): Promise<PurchaseOrder> {
    const response = await api.post<PurchaseOrder>(`/api/purchase-orders/${id}/receive`, { receivedQuantities: items });
    return response;
  },

  /**
   * Search purchase orders - calls GET /api/purchase-orders/search
   */
  async searchPurchaseOrders(params: { query: string; limit?: number }): Promise<PurchaseOrder[]> {
    const response = await api.get<PurchaseOrder[]>('/api/purchase-orders/search', { params });
    return response;
  },

  /**
   * Delete purchase order - calls DELETE /api/purchase-orders/:id
   */
  async deletePurchaseOrder(id: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`/api/purchase-orders/${id}`);
    return response;
  },

  /**
   * Get purchase orders by supplier - calls GET /api/purchase-orders/supplier/:supplierId
   */
  async getPurchaseOrdersBySupplier(supplierId: string, params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<PurchaseOrder>> {
    const response = await api.get<PaginatedResponse<PurchaseOrder>>(`/api/purchase-orders/supplier/${supplierId}`, { params });
    return response;
  },

  /**
   * Get purchase order summary - calls GET /api/purchase-orders/summary
   */
  async getPurchaseOrderSummary(businessUnitId: string): Promise<{
    totalOrders: number;
    pendingOrders: number;
    receivedOrders: number;
    cancelledOrders: number;
    totalValue: number;
  }> {
    const response = await api.get<{
      totalOrders: number;
      pendingOrders: number;
      receivedOrders: number;
      cancelledOrders: number;
      totalValue: number;
    }>('/api/purchase-orders/summary', { params: { businessUnitId } });
    return response;
  }
};

export default purchaseOrderService;
