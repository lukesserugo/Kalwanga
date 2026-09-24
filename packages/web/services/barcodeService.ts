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

export interface ScanBarcodeResult {
  product: any;
  inventory?: {
    quantity: number;
    reserved: number;
    available: number;
  };
  barcodeInfo: {
    barcode: string;
    barcodeUrl: string;
    qrCodeUrl: string;
  };
  variant?: any;
}

export interface BarcodeValidationResult {
  valid: boolean;
  message?: string;
}

export interface BulkGenerateResult {
  generated: number;
  failed: number;
}

export interface VariantBarcodeInfo extends BarcodeInfo {
  variantName?: string;
  productName?: string;
  variantId?: string;
}

/**
 * Payload for the write-path scan.
 *
 * `scanIdempotencyKey` is the caller-supplied dedupe token. When two
 * transports (USB HID + BLE) fire the same physical scan and drift
 * past the dispatcher's 250 ms debounce, the second request carries
 * the same key and the backend short-circuits with a 409.
 */
export interface RecordScanInput {
  barcode: string;
  businessUnitId: string;
  quantity?: number;
  saleId?: string;
  note?: string;
  scanIdempotencyKey?: string;
}

/**
 * Result of a successful write-path scan. Mirrors the backend's
 * `recordScan` return shape.
 */
export interface RecordScanResult {
  transactionId: string;
  matchType: 'PRODUCT' | 'VARIANT';
  barcode: string;
  productId: string;
  variantId: string | null;
  quantityScanned: number;
  remainingQuantity: number;
}

/**
 * Distinguishes the two 409 meanings returned by the backend.
 *   - 'DUPLICATE_SCAN'      → safe to ignore (idempotency hit)
 *   - 'INSUFFICIENT_STOCK'  → real error, surface to the cashier
 *   - null                  → not a 409, or a 409 the client can't classify
 */
export type RecordScanErrorKind =
  | 'DUPLICATE_SCAN'
  | 'INSUFFICIENT_STOCK'
  | null;

// Helper to check if we're on the client
const isClient = typeof window !== 'undefined';

export const barcodeService = {
  // ============================================
  // PRODUCT BARCODE ROUTES
  // ============================================

  /**
   * Get barcode for a product
   * GET /barcodes/product/:productId
   */
  async getBarcodeByProduct(productId: string): Promise<{ barcode: string; productId: string; generatedAt: Date }> {
    if (!isClient) {
      return {} as any;
    }
    try {
      const response = await api.get<any>(`/barcodes/product/${productId}`);
      return response || { barcode: '', productId, generatedAt: new Date() };
    } catch (error) {
      console.error(`Error fetching barcode for product ${productId}:`, error);
      throw error;
    }
  },

  /**
   * Get full barcode info for a product (with images)
   * GET /barcodes/product/:productId/info
   */
  async getProductBarcodeInfo(productId: string): Promise<BarcodeInfo> {
    if (!isClient) {
      return {} as BarcodeInfo;
    }
    try {
      const response = await api.get<any>(`/barcodes/product/${productId}/info`);
      return response || ({} as BarcodeInfo);
    } catch (error) {
      console.error(`Error fetching barcode info for product ${productId}:`, error);
      throw error;
    }
  },

  /**
   * Get QR code for a product
   * GET /barcodes/product/:productId/qr
   */
  async getProductQRCode(productId: string): Promise<{ qrCodeUrl: string; qrData: any; generatedAt: Date }> {
    if (!isClient) {
      return { qrCodeUrl: '', qrData: null, generatedAt: new Date() };
    }
    try {
      const response = await api.get<any>(`/barcodes/product/${productId}/qr`);
      return response || { qrCodeUrl: '', qrData: null, generatedAt: new Date() };
    } catch (error) {
      console.error(`Error fetching QR code for product ${productId}:`, error);
      throw error;
    }
  },

  /**
   * Get barcode image for a product
   * GET /barcodes/product/:productId/image
   */
  async getBarcodeImage(productId: string): Promise<{ barcodeUrl: string; barcode: string; generatedAt: Date }> {
    if (!isClient) {
      return { barcodeUrl: '', barcode: '', generatedAt: new Date() };
    }
    try {
      const response = await api.get<any>(`/barcodes/product/${productId}/image`);
      return response || { barcodeUrl: '', barcode: '', generatedAt: new Date() };
    } catch (error) {
      console.error(`Error fetching barcode image for product ${productId}:`, error);
      throw error;
    }
  },

  /**
   * Get SVG barcode for a product
   * GET /barcodes/product/:productId/svg
   * Returns string directly, not an object with .data
   */
  async getSVGBarcode(productId: string): Promise<string> {
    if (!isClient) {
      return '';
    }
    try {
      const response = await api.get<string>(`/barcodes/product/${productId}/svg`);
      return response || '';
    } catch (error) {
      console.error(`Error fetching SVG barcode for product ${productId}:`, error);
      throw error;
    }
  },

  /**
   * Get all QR codes for a product
   * GET /barcodes/product/:productId/qr-codes
   */
  async getProductQRCodes(productId: string): Promise<{ data: any[]; count: number }> {
    if (!isClient) {
      return { data: [], count: 0 };
    }
    try {
      const response = await api.get<any>(`/barcodes/product/${productId}/qr-codes`);
      return response || { data: [], count: 0 };
    } catch (error) {
      console.error(`Error fetching QR codes for product ${productId}:`, error);
      throw error;
    }
  },

  // ============================================
  // VARIANT BARCODE ROUTES
  // ============================================

  /**
   * Generate barcode for a product variant
   * POST /barcodes/variant/:variantId
   */
  async generateVariantBarcode(variantId: string): Promise<{ barcode: string; variantId: string }> {
    if (!isClient) {
      throw new Error('Cannot generate variant barcode on server');
    }
    try {
      const response = await api.post<any>(`/barcodes/variant/${variantId}`);
      return response || { barcode: '', variantId };
    } catch (error) {
      console.error(`Error generating barcode for variant ${variantId}:`, error);
      throw error;
    }
  },

  /**
   * Get variant barcode info
   * GET /barcodes/variant/:variantId/info
   */
  async getVariantBarcodeInfo(variantId: string): Promise<VariantBarcodeInfo> {
    if (!isClient) {
      return {} as VariantBarcodeInfo;
    }
    try {
      const response = await api.get<any>(`/barcodes/variant/${variantId}/info`);
      return response || ({} as VariantBarcodeInfo);
    } catch (error) {
      console.error(`Error fetching variant barcode info for ${variantId}:`, error);
      throw error;
    }
  },

  // ============================================
  // BARCODE GENERATION ROUTES
  // ============================================

  /**
   * Generate a barcode for an existing product
   * POST /barcodes/generate
   */
  async generateBarcode(productId: string, type?: string): Promise<{ barcode: string; productId: string }> {
    if (!isClient) {
      throw new Error('Cannot generate barcode on server');
    }
    try {
      const response = await api.post<any>('/barcodes/generate', {
        productId,
        type: type || 'EAN13',
      });
      return response || { barcode: '', productId };
    } catch (error) {
      console.error(`Error generating barcode for product ${productId}:`, error);
      throw error;
    }
  },

  /**
   * Generate a unique barcode (for pre-creation)
   * POST /barcodes/generate-unique
   */
  async generateUniqueBarcode(options?: GenerateBarcodeOptions): Promise<{ barcode: string }> {
    if (!isClient) {
      throw new Error('Cannot generate barcode on server');
    }
    try {
      const response = await api.post<any>('/barcodes/generate-unique', options || {});
      return response || { barcode: '' };
    } catch (error) {
      console.error('Error generating unique barcode:', error);
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
   * Bulk generate barcodes for products without barcodes
   * POST /barcodes/bulk-generate
   */
  async bulkGenerateBarcodes(): Promise<BulkGenerateResult> {
    if (!isClient) {
      throw new Error('Cannot bulk generate barcodes on server');
    }
    try {
      const response = await api.post<any>('/barcodes/bulk-generate');
      return response || { generated: 0, failed: 0 };
    } catch (error) {
      console.error('Error bulk generating barcodes:', error);
      throw error;
    }
  },

  // ============================================
  // BARCODE IMAGE ROUTES
  // ============================================

  /**
   * Generate barcode image from barcode string
   * POST /barcodes/image
   */
  async generateBarcodeImage(barcode: string, format?: 'EAN-13' | 'UPC-A' | 'CODE128'): Promise<{ barcodeUrl: string }> {
    if (!isClient) {
      return { barcodeUrl: '' };
    }
    try {
      const response = await api.post<any>('/barcodes/image', { barcode, format });
      return response || { barcodeUrl: '' };
    } catch (error) {
      console.error('Error generating barcode image:', error);
      // Fallback to external service
      const formatParam = format || 'EAN13';
      return {
        barcodeUrl: `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(barcode)}&code=${formatParam}&dpi=96&datatype=Content`,
      };
    }
  },

  /**
   * Get barcode image by barcode
   * GET /barcodes/image/:barcode
   */
  async getBarcodeImageByCode(barcode: string): Promise<any> {
    if (!isClient) {
      return null;
    }
    try {
      const response = await api.get<any>(`/barcodes/image/${barcode}`);
      return response || null;
    } catch (error) {
      console.error(`Error fetching barcode image ${barcode}:`, error);
      throw error;
    }
  },

  // ============================================
  // QR CODE ROUTES
  // ============================================

  /**
   * Generate QR code from data
   * POST /barcodes/qr
   */
  async generateQRCode(data: Record<string, any>): Promise<{ qrCodeUrl: string; qrData: Record<string, any> }> {
    if (!isClient) {
      return { qrCodeUrl: '', qrData: {} };
    }
    try {
      const response = await api.post<any>('/barcodes/qr', { data });
      return response || { qrCodeUrl: '', qrData: {} };
    } catch (error) {
      console.error('Error generating QR code:', error);
      // Fallback to external service
      const qrData = {
        ...data,
        timestamp: new Date().toISOString(),
      };
      return {
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(JSON.stringify(qrData))}`,
        qrData,
      };
    }
  },

  /**
   * Get QR code by code
   * GET /barcodes/qr/:code
   */
  async getQRCodeByCode(code: string): Promise<any> {
    if (!isClient) {
      return null;
    }
    try {
      const response = await api.get<any>(`/barcodes/qr/${code}`);
      return response || null;
    } catch (error) {
      console.error(`Error fetching QR code ${code}:`, error);
      throw error;
    }
  },

  /**
   * Deactivate QR code
   * PATCH /barcodes/qr/:code/deactivate
   */
  async deactivateQRCode(code: string): Promise<any> {
    if (!isClient) {
      throw new Error('Cannot deactivate QR code on server');
    }
    try {
      const response = await api.patch<any>(`/barcodes/qr/${code}/deactivate`);
      return response || { success: true };
    } catch (error) {
      console.error(`Error deactivating QR code ${code}:`, error);
      throw error;
    }
  },

  /**
   * Get receipt QR code
   * GET /barcodes/receipt/:receiptNumber/qr
   */
  async getReceiptQRCode(receiptNumber: string): Promise<{ qrCodeUrl: string; qrData: any; generatedAt: Date }> {
    if (!isClient) {
      return { qrCodeUrl: '', qrData: null, generatedAt: new Date() };
    }
    try {
      const response = await api.get<any>(`/barcodes/receipt/${receiptNumber}/qr`);
      return response || { qrCodeUrl: '', qrData: null, generatedAt: new Date() };
    } catch (error) {
      console.error(`Error fetching receipt QR code for ${receiptNumber}:`, error);
      throw error;
    }
  },

  // ============================================
  // BARCODE LOOKUP & VALIDATION ROUTES
  // ============================================

  /**
   * Get product by barcode
   * GET /barcodes/lookup/:barcode
   */
  async getProductByBarcode(barcode: string): Promise<any | null> {
    if (!isClient) {
      return null;
    }
    try {
      const response = await api.get<any>(`/barcodes/lookup/${barcode}`);
      return response || null;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return null;
      }
      console.error(`Error fetching product by barcode ${barcode}:`, error);
      throw error;
    }
  },

  /**
   * Validate barcode format
   * GET /barcodes/validate/:barcode
   */
  async validateBarcodeFormat(barcode: string): Promise<{ isValid: boolean; format: string }> {
    if (!isClient) {
      return { isValid: false, format: 'EAN-13' };
    }
    try {
      const response = await api.get<any>(`/barcodes/validate/${barcode}`);
      return response || { isValid: false, format: 'EAN-13' };
    } catch (error) {
      console.error(`Error validating barcode ${barcode}:`, error);
      // Client-side validation fallback
      const isValid = /^\d{13}$/.test(barcode) && this.validateChecksum(barcode);
      return { isValid, format: 'EAN-13' };
    }
  },

  /**
   * Validate barcode with uniqueness check
   * POST /barcodes/validate
   */
  async validateBarcode(barcode: string, excludeProductId?: string): Promise<BarcodeValidationResult> {
    if (!isClient) {
      return { valid: false, message: 'Cannot validate on server' };
    }
    try {
      const response = await api.post<any>('/barcodes/validate', { barcode, excludeProductId });
      return response || { valid: false, message: 'Validation failed' };
    } catch (error) {
      console.error(`Error validating barcode ${barcode}:`, error);
      // Client-side validation fallback
      const isValid = /^\d{13}$/.test(barcode) && this.validateChecksum(barcode);
      return {
        valid: isValid,
        message: isValid ? 'Barcode is valid' : 'Invalid barcode format',
      };
    }
  },

  // ============================================
  // BARCODE ASSOCIATION ROUTES
  // ============================================

  /**
   * Associate a barcode with a product
   * POST /barcodes/associate
   */
  async associateBarcode(productId: string, barcode: string): Promise<{ success: boolean; message: string }> {
    if (!isClient) {
      throw new Error('Cannot associate barcode on server');
    }
    try {
      const response = await api.post<any>('/barcodes/associate', { productId, barcode });
      return response || { success: true, message: 'Barcode associated successfully' };
    } catch (error) {
      console.error(`Error associating barcode with product ${productId}:`, error);
      throw error;
    }
  },

  // ============================================
  // BARCODE SCAN ROUTES
  // ============================================

  /**
   * Scan a barcode and get product info (read-only).
   * POST /barcodes/scan
   *
   * Use this for camera previews, product lookups, and cart
   * previews — it resolves the code to a product/variant but does
   * NOT decrement inventory.
   *
   * `silent: true` suppresses the payload logger in `api.post` so a
   * fast scanner loop doesn't flood the console. Error rejection is
   * unaffected.
   */
  async scanBarcode(barcode: string, businessUnitId?: string): Promise<ScanBarcodeResult> {
    if (!isClient) {
      throw new Error('Cannot scan barcode on server');
    }
    try {
      const response = await api.post<any>(
        '/barcodes/scan',
        { barcode, businessUnitId },
        { silent: true },
      );
      return response;
    } catch (error) {
      console.error(`Error scanning barcode ${barcode}:`, error);
      throw error;
    }
  },

  /**
   * Record a scanner-driven scan (write path).
   * POST /barcodes/record-scan
   *
   * Decrements inventory and writes an InventoryTransaction row
   * atomically. When `scanIdempotencyKey` is supplied, a duplicate
   * request is rejected with 409 before the transaction begins.
   *
   * On a 409, the caller should inspect `classifyRecordScanError(err)`
   * to distinguish "duplicate scan" (safe to swallow) from
   * "insufficient stock" (must be shown to the user).
   *
   * `silent: true` suppresses the payload logger in `api.post` so a
   * fast scanner loop doesn't flood the console. Error rejection is
   * unaffected.
   */
  async recordScan(input: RecordScanInput): Promise<RecordScanResult> {
    if (!isClient) {
      throw new Error('Cannot record scan on server');
    }
    try {
      const response = await api.post<any>(
        '/barcodes/record-scan',
        input,
        { silent: true },
      );
      return response;
    } catch (error) {
      console.error(`Error recording scan for ${input.barcode}:`, error);
      throw error;
    }
  },

  // ============================================
  // CLIENT-SIDE UTILITY METHODS
  // ============================================

  /**
   * Classify a `recordScan` rejection into one of the two known
   * 409 meanings, or `null` if it's something else.
   *
   * Prefers the machine-readable `code` field on the error body
   * when the backend supplies it (recommended), and falls back to
   * message inspection so the client works against either backend
   * version.
   */
  classifyRecordScanError(err: unknown): RecordScanErrorKind {
    const status =
      (err as any)?.response?.status ??
      (err as any)?.status ??
      null;

    if (status !== 409) return null;

    const body = (err as any)?.response?.data ?? {};
    const code = typeof body?.code === 'string' ? body.code : null;
    if (code === 'DUPLICATE_SCAN' || code === 'INSUFFICIENT_STOCK') {
      return code;
    }

    const message = typeof body?.message === 'string' ? body.message : '';
    if (/duplicate scan/i.test(message)) return 'DUPLICATE_SCAN';
    if (/insufficient stock/i.test(message)) return 'INSUFFICIENT_STOCK';
    return null;
  },

  /**
   * Validate barcode checksum (client-side)
   */
  validateChecksum(barcode: string): boolean {
    if (!/^\d{13}$/.test(barcode)) {
      return false;
    }
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(barcode[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(barcode[12]);
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
  },
};
