// D:\Projects\Kalwanga\packages\web\types\barcode.ts

export interface Barcode {
  id: string;
  productId: string;
  variantId?: string;
  barcode: string;
  format: string;
  imageUrl?: string;
  isActive: boolean;
  scans: number;
  lastScanned?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QRCode {
  id: string;
  code: string;
  data: any;
  type: string;
  imageUrl?: string;
  isActive: boolean;
  scans: number;
  lastScanned?: string;
  expiresAt?: string;
  productId?: string;
  variantId?: string;
  saleId?: string;
  receiptId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BarcodeGenerationRequest {
  productId: string;
  variantId?: string;
  format?: 'EAN13' | 'CODE128' | 'QR';
  quantity?: number;
}

export interface BarcodeBatchGenerationRequest {
  productIds: string[];
  format?: 'EAN13' | 'CODE128' | 'QR';
}

export interface BarcodeScanResult {
  barcode: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    unitPrice: number;
    inventory?: {
      quantity: number;
      available: number;
    };
  };
  variant?: {
    id: string;
    name: string;
    sku: string;
    price: number;
  };
  scannedAt: string;
}

export interface QRCodeGenerationResponse {
  qrCodeUrl: string;
  qrData: any;
  generatedAt: string;
}

export interface BarcodeGenerationResponse {
  barcode: string;
  productId: string;
  variantId?: string;
  imageUrl?: string;
  generatedAt: string;
}
