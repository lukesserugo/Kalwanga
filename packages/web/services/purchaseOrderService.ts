// D:\Projects\Kalwanga\packages\web\services\purchaseOrderService.ts

import { api } from './api';

// ============================================
// CANONICAL TYPE IMPORTS
// ============================================
//
// Import from the module that OWNS the type, not through the barrel.
// The barrel `../types/index.ts` re-exports these, but reaching them
// through it adds an indirection that hides exactly which file is the
// source of truth. Import from the owner.

import type {
  PurchaseOrder,
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  ReceivePurchaseOrderDto,
  PurchaseOrderStatus,
} from '../types/purchaseOrder';

// ============================================
// LOCAL RESPONSE SHAPE
// ============================================
//
// ⚠️ This is the ONLY local type this service needs. It describes the
//    envelope the backend returns for paginated list endpoints. It is
//    not a domain model — the domain model `PurchaseOrder` comes from
//    `../types/purchaseOrder`.

export interface PaginatedPurchaseOrderResponse {
  data: PurchaseOrder[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

// ============================================
// SERVICE
// ============================================

export const purchaseOrderService = {
  /**
   * Get all purchase orders.
   * GET /purchase-orders
   */
  async getAllPurchaseOrders(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: PurchaseOrderStatus | string;
    supplierId?: string;
    businessUnitId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedPurchaseOrderResponse> {
    const response = await api.get<PaginatedPurchaseOrderResponse>(
      '/purchase-orders',
      { params }
    );
    return response;
  },

  /**
   * Get purchase order by ID.
   * GET /purchase-orders/:id
   */
  async getPurchaseOrderById(id: string): Promise<PurchaseOrder> {
    const response = await api.get<PurchaseOrder>(`/purchase-orders/${id}`);
    return response;
  },

  /**
   * Create purchase order.
   * POST /purchase-orders
   */
  async createPurchaseOrder(
    data: CreatePurchaseOrderDto
  ): Promise<PurchaseOrder> {
    const response = await api.post<PurchaseOrder>(
      '/purchase-orders',
      data
    );
    return response;
  },

  /**
   * Update purchase order.
   * PUT /purchase-orders/:id
   */
  async updatePurchaseOrder(
    id: string,
    data: UpdatePurchaseOrderDto
  ): Promise<PurchaseOrder> {
    const response = await api.put<PurchaseOrder>(
      `/purchase-orders/${id}`,
      data
    );
    return response;
  },

  /**
   * Cancel purchase order.
   * POST /purchase-orders/:id/cancel
   */
  async cancelPurchaseOrder(
    id: string,
    reason: string
  ): Promise<PurchaseOrder> {
    const response = await api.post<PurchaseOrder>(
      `/purchase-orders/${id}/cancel`,
      { reason }
    );
    return response;
  },

  /**
   * Receive purchase order.
   * POST /purchase-orders/:id/receive
   */
  async receivePurchaseOrder(
    id: string,
    items: Array<{ itemId: string; quantity: number }>
  ): Promise<PurchaseOrder> {
    const body: ReceivePurchaseOrderDto = { receivedQuantities: items };
    const response = await api.post<PurchaseOrder>(
      `/purchase-orders/${id}/receive`,
      body
    );
    return response;
  },

  /**
   * Search purchase orders.
   * GET /purchase-orders/search
   */
  async searchPurchaseOrders(params: {
    query: string;
    limit?: number;
  }): Promise<PurchaseOrder[]> {
    const response = await api.get<PurchaseOrder[]>(
      '/purchase-orders/search',
      { params }
    );
    return response;
  },

  /**
   * Delete purchase order.
   * DELETE /purchase-orders/:id
   */
  async deletePurchaseOrder(id: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(
      `/purchase-orders/${id}`
    );
    return response;
  },

  /**
   * Get purchase orders by supplier.
   * GET /purchase-orders/supplier/:supplierId
   */
  async getPurchaseOrdersBySupplier(
    supplierId: string,
    params?: {
      status?: PurchaseOrderStatus | string;
      page?: number;
      limit?: number;
    }
  ): Promise<PaginatedPurchaseOrderResponse> {
    const response = await api.get<PaginatedPurchaseOrderResponse>(
      `/purchase-orders/supplier/${supplierId}`,
      { params }
    );
    return response;
  },

  /**
   * Get purchase order summary.
   * GET /purchase-orders/summary
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
    }>('/purchase-orders/summary', { params: { businessUnitId } });
    return response;
  },
};

export default purchaseOrderService;
