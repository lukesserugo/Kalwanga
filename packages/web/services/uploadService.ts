// D:\Projects\Kalwanga\packages\web\services\uploadService.ts
import { api } from './api';

export const uploadService = {
  /**
   * Upload single file - calls POST /upload
   */
  async uploadFile(file: File, type: string = 'product'): Promise<{ url: string; filename: string }> {
    const response = await api.upload<{ url: string; filename: string }>('/upload', file, 'file', { type });
    return response;
  },

  /**
   * Upload multiple files - calls POST /upload/multiple
   */
  async uploadMultipleFiles(files: File[], type: string = 'product'): Promise<Array<{ url: string; filename: string }>> {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('type', type);
    
    const response = await api.post<Array<{ url: string; filename: string }>>('/upload/multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response;
  },

  /**
   * Upload product image - calls POST /upload/product-image
   */
  async uploadProductImage(file: File, productId?: string): Promise<{ url: string; filename: string }> {
    const response = await api.upload<{ url: string; filename: string }>('/upload/product-image', file, 'image', { productId });
    return response;
  },

  /**
   * Upload receipt image - calls POST /upload/receipt
   */
  async uploadReceipt(file: File): Promise<{ url: string; filename: string }> {
    const response = await api.upload<{ url: string; filename: string }>('/upload/receipt', file);
    return response;
  },

  /**
   * Delete file - calls DELETE /upload/:filename
   */
  async deleteFile(filename: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`/upload/${encodeURIComponent(filename)}`);
    return response;
  },

  /**
   * Get file URL - calls GET /upload/:filename
   */
  getFileUrl(filename: string): string {
    const baseUrl = process.env.REACT_APP_API_URL || '/api';
    return `${baseUrl}/upload/${encodeURIComponent(filename)}`;
  },
};
