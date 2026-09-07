// D:\Projects\Kalwanga\packages\web\services\customerService.ts
import { api } from './api';
import { Customer, CustomerSearchParams } from '../types';

// Define PaginatedResponse locally since it's not exported from types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export const customerService = {
  /**
   * Get all customers - calls GET /customers
   */
  async getAllCustomers(params?: CustomerSearchParams): Promise<PaginatedResponse<Customer>> {
    const response = await api.get<PaginatedResponse<Customer>>('/customers', { params });
    return response;
  },

  /**
   * Get customer by ID - calls GET /customers/:id
   */
  async getCustomerById(id: string): Promise<Customer> {
    const response = await api.get<Customer>(`/customers/${id}`);
    return response;
  },

  /**
   * Create customer - calls POST /customers
   */
  async createCustomer(data: Partial<Customer>): Promise<Customer> {
    const response = await api.post<Customer>('/customers', data);
    return response;
  },

  /**
   * Update customer - calls PUT /customers/:id
   */
  async updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
    const response = await api.put<Customer>(`/customers/${id}`, data);
    return response;
  },

  /**
   * Delete customer - calls DELETE /customers/:id
   */
  async deleteCustomer(id: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`/customers/${id}`);
    return response;
  },

  /**
   * Add loyalty points - calls POST /customers/:id/loyalty
   */
  async addLoyaltyPoints(customerId: string, points: number): Promise<Customer> {
    const response = await api.post<Customer>(`/customers/${customerId}/loyalty`, { points });
    return response;
  },

  /**
   * Redeem loyalty points - calls POST /customers/:id/redeem
   */
  async redeemLoyaltyPoints(customerId: string, points: number): Promise<Customer> {
    const response = await api.post<Customer>(`/customers/${customerId}/redeem`, { points });
    return response;
  },

  /**
   * Get customer stats - calls GET /customers/:id/stats
   */
  async getCustomerStats(id: string): Promise<{
    totalOrders: number;
    totalSpent: number;
    averageOrder: number;
    lastPurchase: string | null;
  }> {
    const response = await api.get<{
      totalOrders: number;
      totalSpent: number;
      averageOrder: number;
      lastPurchase: string | null;
    }>(`/customers/${id}/stats`);
    return response;
  },

  /**
   * Search customers - calls GET /customers/search
   */
  async searchCustomers(params: { query: string; limit?: number }): Promise<Customer[]> {
    const response = await api.get<Customer[]>('/customers/search', { params });
    return response;
  },

  /**
   * Bulk import customers - calls POST /customers/import
   */
  async importCustomers(file: File): Promise<{ results: Customer[]; errors: any[] }> {
    const response = await api.upload<{ results: Customer[]; errors: any[] }>('/customers/import', file);
    return response;
  },

  /**
   * Export customers - calls GET /customers/export
   */
  async exportCustomers(format: 'csv' | 'excel' = 'csv'): Promise<Blob> {
    const response = await api.download(`/customers/export?format=${format}`);
    return response;
  },
};
