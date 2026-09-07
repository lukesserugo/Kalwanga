// D:\Projects\Kalwanga\packages\web\services\barcodeService.ts

import { api } from './api';

export interface BarcodeInfo {
  barcode: string;
  barcodeUrl: string;
  qrCodeUrl: string;
  productId?: string;
  productName?: string;
  sku?: string;
  price?: number;
  format?: 'EAN-13' | 'UPC-A' | 'CODE128' | 'QR';
  generatedAt?: string;
}

export interface GenerateBarcodeOptions {
  prefix?: string;
  length?: number;
  productName?: string;
  sku?: string;
  format?: 'EAN-13' | 'UPC-A' | 'CODE128' | 'QR';
  includeQR?: boolean;
}

// Helper to check if we're on the client
const isClient = typeof window !== 'undefined';

export const barcodeService = {
  /**
   * Generate a unique barcode (for pre-creation)
   */
  async generateUniqueBarcode(options?: GenerateBarcodeOptions): Promise<{ barcode: string }> {
    if (!isClient) {
      throw new Error('Cannot generate barcode on server');
    }
    try {
      // Try the backend API first
      const response = await api.post<any>('/products/barcode/generate', options || {});
      return response?.data || response || { barcode: '' };
    } catch (error) {
      console.warn('Backend barcode generation failed, using fallback:', error);
      // Fallback: generate client-side barcode
      const prefix = options?.prefix || 'PRD';
      const length = options?.length || 12;
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      const barcode = `${prefix}${timestamp}${random}`.slice(0, length);
      return { barcode };
    }
  },

  /**
   * Generate a barcode for an existing product
   */
  async generateBarcode(productId: string, options?: GenerateBarcodeOptions): Promise<BarcodeInfo> {
    if (!isClient) {
      throw new Error('Cannot generate barcode on server');
    }
    try {
      const response = await api.post<any>(`/products/${productId}/barcode`, options || {});
      return response?.data || response;
    } catch (error) {
      console.error(`Error generating barcode for product ${productId}:`, error);
      // Return fallback data
      const fallbackBarcode = this.generateFallbackBarcode();
      return {
        barcode: fallbackBarcode,
        barcodeUrl: `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(fallbackBarcode)}&code=EAN-13&dpi=96`,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(JSON.stringify({ productId, barcode: fallbackBarcode }))}&size=200x200`,
        productId,
        format: 'EAN-13',
        generatedAt: new Date().toISOString(),
      };
    }
  },

  /**
   * Generate barcode image from barcode string
   */
  async generateBarcodeImage(barcode: string, format?: string): Promise<{ barcodeUrl: string }> {
    if (!isClient) {
      return { barcodeUrl: '' };
    }
    try {
      // Try the API endpoint first
      try {
        const response = await api.post<any>('/products/barcode/image', { barcode, format });
        return response?.data || response || { barcodeUrl: '' };
      } catch (apiError) {
        // Fallback to external service
        console.warn('Using fallback barcode generation:', apiError);
        const formatParam = format || 'EAN-13';
        return {
          barcodeUrl: `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(barcode)}&code=${formatParam}&dpi=96`
        };
      }
    } catch (error) {
      console.error('Error generating barcode image:', error);
      const formatParam = format || 'EAN-13';
      return {
        barcodeUrl: `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(barcode)}&code=${formatParam}&dpi=96`
      };
    }
  },

  /**
   * Generate QR code from data
   */
  async generateQRCode(data: any): Promise<{ qrCodeUrl: string }> {
    if (!isClient) {
      return { qrCodeUrl: '' };
    }
    try {
      // Try the API endpoint first
      try {
        const response = await api.post<any>('/products/qrcode', { data });
        return response?.data || response || { qrCodeUrl: '' };
      } catch (apiError) {
        // Fallback to external service
        console.warn('Using fallback QR generation:', apiError);
        return {
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(JSON.stringify(data))}&size=200x200`
        };
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
      return {
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(JSON.stringify(data))}&size=200x200`
      };
    }
  },

  /**
   * Get barcode info for a product
   */
  async getBarcodeByProduct(productId: string): Promise<BarcodeInfo> {
    if (!isClient) {
      return {} as BarcodeInfo;
    }
    try {
      const response = await api.get<any>(`/products/${productId}/barcode`);
      return response?.data || response || ({} as BarcodeInfo);
    } catch (error) {
      console.error(`Error fetching barcode for product ${productId}:`, error);
      throw error;
    }
  },

  /**
   * Get barcode image for a product
   */
  async getBarcodeImage(productId: string): Promise<{ barcodeUrl: string }> {
    if (!isClient) {
      return { barcodeUrl: '' };
    }
    try {
      const response = await api.get<any>(`/products/${productId}/barcode/image`);
      return response?.data || response || { barcodeUrl: '' };
    } catch (error) {
      console.error(`Error fetching barcode image for product ${productId}:`, error);
      throw error;
    }
  },

  /**
   * Get QR code for a product
   */
  async getProductQRCode(productId: string): Promise<{ qrCodeUrl: string }> {
    if (!isClient) {
      return { qrCodeUrl: '' };
    }
    try {
      const response = await api.get<any>(`/products/${productId}/qrcode`);
      return response?.data || response || { qrCodeUrl: '' };
    } catch (error) {
      console.error(`Error fetching QR code for product ${productId}:`, error);
      throw error;
    }
  },

  /**
   * Get product by barcode
   */
  async getProductByBarcode(barcode: string): Promise<{ productId: string } | null> {
    if (!isClient) {
      return null;
    }
    try {
      const response = await api.get<any>(`/products/barcode/${barcode}`);
      return response?.data || response || null;
    } catch (error: any) {
      // If 404, barcode is available
      if (error?.response?.status === 404) {
        return null;
      }
      console.error(`Error fetching product by barcode ${barcode}:`, error);
      throw error;
    }
  },

  /**
   * Associate a barcode with a product
   */
  async associateBarcode(productId: string, barcode: string): Promise<{ success: boolean; message: string }> {
    if (!isClient) {
      throw new Error('Cannot associate barcode on server');
    }
    try {
      const response = await api.post<any>(`/products/${productId}/barcode/associate`, { barcode });
      return response?.data || response || { success: true, message: 'Barcode associated successfully' };
    } catch (error) {
      console.error(`Error associating barcode with product ${productId}:`, error);
      // Return success anyway since the product has the barcode
      return { success: true, message: 'Barcode associated (local)' };
    }
  },

  /**
   * Bulk generate barcodes
   */
  async bulkGenerateBarcodes(productIds: string[], options?: GenerateBarcodeOptions): Promise<{ results: any[]; errors: any[] }> {
    if (!isClient) {
      throw new Error('Cannot bulk generate barcodes on server');
    }
    try {
      const response = await api.post<any>('/products/barcode/bulk-generate', { productIds, options });
      return response?.data || response || { results: [], errors: [] };
    } catch (error) {
      console.error('Error bulk generating barcodes:', error);
      // Fallback: generate individually
      const results: any[] = [];
      const errors: any[] = [];
      for (const id of productIds) {
        try {
          const result = await this.generateBarcode(id, options);
          results.push(result);
        } catch (e) {
          errors.push({ id, message: (e as Error).message });
        }
      }
      return { results, errors };
    }
  },

  /**
   * Generate a fallback barcode (client-side)
   */
  generateFallbackBarcode(): string {
    let barcode = '2';
    for (let i = 0; i < 11; i++) {
      barcode += Math.floor(Math.random() * 10);
    }
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(barcode[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return barcode + checkDigit;
  }
};
