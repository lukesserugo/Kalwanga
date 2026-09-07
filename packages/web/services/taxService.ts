// D:\Projects\Kalwanga\packages\web\services\taxService.ts
import { api } from './api';

export const taxService = {
  /**
   * Get tax summary - calls GET /tax/summary
   */
  async getTaxSummary(businessUnitId: string, period: string): Promise<any> {
    const response = await api.get<any>('/tax/summary', { params: { businessUnitId, period } });
    return response;
  },

  /**
   * Get tax records - calls GET /tax/records
   */
  async getTaxRecords(params?: { businessUnitId?: string; period?: string }): Promise<any[]> {
    const response = await api.get<any[]>('/tax/records', { params });
    return response;
  },

  /**
   * Get filing status - calls GET /tax/filing-status
   */
  async getFilingStatus(businessUnitId: string): Promise<any[]> {
    const response = await api.get<any[]>('/tax/filing-status', { params: { businessUnitId } });
    return response;
  },

  /**
   * File tax return - calls POST /tax/file
   */
  async fileTaxReturn(data: { businessUnitId: string; period: string }): Promise<any> {
    const response = await api.post<any>('/tax/file', data);
    return response;
  },

  /**
   * Calculate tax - calls POST /tax/calculate
   */
  async calculateTax(data: { amount: number; taxRate: number; taxType?: string }): Promise<{ taxAmount: number; totalAmount: number }> {
    const response = await api.post<{ taxAmount: number; totalAmount: number }>('/tax/calculate', data);
    return response;
  },
};
