// D:\Projects\Kalwanga\packages\web\services\analyticsService.ts
import { api } from './api';

export const analyticsService = {
  /**
   * Get sales trends - calls GET /analytics/sales-trends
   */
  async getSalesTrends(businessUnitId: string, days: number = 30): Promise<any> {
    const response = await api.get<any>('/analytics/sales-trends', { params: { businessUnitId, days } });
    return response;
  },

  /**
   * Get top products - calls GET /analytics/top-products
   */
  async getTopProducts(businessUnitId: string, limit: number = 10, days: number = 30): Promise<any> {
    const response = await api.get<any>('/analytics/top-products', { params: { businessUnitId, limit, days } });
    return response;
  },

  /**
   * Get customer insights - calls GET /analytics/customer-insights
   */
  async getCustomerInsights(businessUnitId: string): Promise<any> {
    const response = await api.get<any>('/analytics/customer-insights', { params: { businessUnitId } });
    return response;
  },

  /**
   * Get inventory analytics - calls GET /analytics/inventory
   */
  async getInventoryAnalytics(businessUnitId: string): Promise<any> {
    const response = await api.get<any>('/analytics/inventory', { params: { businessUnitId } });
    return response;
  },

  /**
   * Get sales summary - calls GET /analytics/sales-summary
   */
  async getSalesSummary(params: { businessUnitId: string; period?: 'day' | 'week' | 'month' | 'year' }): Promise<any> {
    const response = await api.get<any>('/analytics/sales-summary', { params });
    return response;
  },

  /**
   * Get revenue by category - calls GET /analytics/revenue-by-category
   */
  async getRevenueByCategory(params: { businessUnitId: string; days: number }): Promise<any> {
    const response = await api.get<any>('/analytics/revenue-by-category', { params });
    return response;
  },
};
