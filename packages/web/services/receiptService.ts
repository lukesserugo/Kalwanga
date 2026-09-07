// D:\Projects\Kalwanga\packages\web\services\receiptService.ts
import { api } from './api';

export const receiptService = {
  /**
   * Generate receipt - calls GET /receipts/generate/:saleId
   */
  async generateReceipt(saleId: string): Promise<any> {
    const response = await api.get<any>(`/receipts/generate/${saleId}`);
    return response;
  },

  /**
   * Get receipt by ID - calls GET /receipts/:id
   */
  async getReceiptById(id: string): Promise<any> {
    const response = await api.get<any>(`/receipts/${id}`);
    return response;
  },

  /**
   * Record print - calls POST /receipts/:id/print
   */
  async recordPrint(id: string): Promise<any> {
    const response = await api.post<any>(`/receipts/${id}/print`);
    return response;
  },

  /**
   * Send receipt email - calls POST /receipts/:id/email
   */
  async sendReceiptEmail(id: string, email: string): Promise<any> {
    const response = await api.post<any>(`/receipts/${id}/email`, { email });
    return response;
  },

  /**
   * Download receipt PDF - calls GET /receipts/:id/pdf
   */
  async downloadReceiptPDF(id: string): Promise<Blob> {
    const response = await api.download(`/receipts/${id}/pdf`);
    return response;
  },

  /**
   * Print receipt - calls POST /receipts/:id/print-receipt
   */
  async printReceipt(id: string): Promise<any> {
    const response = await api.post<any>(`/receipts/${id}/print-receipt`);
    return response;
  },
};
