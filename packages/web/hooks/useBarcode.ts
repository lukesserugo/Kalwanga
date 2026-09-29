// D:\Projects\Kalwanga\packages\web\hooks\useBarcode.ts

import { useState, useCallback } from 'react';
import { barcodeService } from '../services/barcodeService';
import { toast } from '../utils/toast-manager';

interface BarcodeState {
  barcode: string | null;
  barcodeUrl: string | null;
  qrCodeUrl: string | null;
  qrData: any | null;
  product: any | null;
  loading: boolean;
  generating: boolean;
  error: string | null;
}

interface BarcodeActions {
  generateBarcode: (productId: string) => Promise<string | null>;
  getBarcode: (productId: string) => Promise<string | null>;
  getQRCode: (productId: string) => Promise<string | null>;
  getFullBarcode: (productId: string) => Promise<any>;
  lookupProduct: (barcode: string) => Promise<any>;
  validateBarcode: (barcode: string) => Promise<boolean>;
  downloadBarcode: (productId: string) => Promise<void>;
  printBarcode: (productId: string) => void;
  reset: () => void;
}

const initialState: BarcodeState = {
  barcode: null,
  barcodeUrl: null,
  qrCodeUrl: null,
  qrData: null,
  product: null,
  loading: false,
  generating: false,
  error: null,
};

export function useBarcode(): BarcodeState & BarcodeActions {
  const [state, setState] = useState<BarcodeState>(initialState);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const generateBarcode = useCallback(
    async (productId: string): Promise<string | null> => {
      try {
        setState(prev => ({ ...prev, generating: true, error: null }));
        const result = await barcodeService.generateBarcode(productId);
        setState(prev => ({
          ...prev,
          barcode: result.barcode,
          generating: false,
        }));
        toast.success('Barcode generated successfully');
        return result.barcode;
      } catch (error: any) {
        const message = error?.message || 'Failed to generate barcode';
        setState(prev => ({ ...prev, error: message, generating: false }));
        toast.error(message);
        return null;
      }
    },
    [],
  );

  // Service method is `getBarcodeByProduct` (not `getProductBarcode`).
  const getBarcode = useCallback(
    async (productId: string): Promise<string | null> => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const result = await barcodeService.getBarcodeByProduct(productId);
        setState(prev => ({
          ...prev,
          barcode: result.barcode,
          loading: false,
        }));
        return result.barcode;
      } catch (error: any) {
        const message = error?.message || 'Failed to get barcode';
        setState(prev => ({ ...prev, error: message, loading: false }));
        toast.error(message);
        return null;
      }
    },
    [],
  );

  const getQRCode = useCallback(
    async (productId: string): Promise<string | null> => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const result = await barcodeService.getProductQRCode(productId);
        setState(prev => ({
          ...prev,
          qrCodeUrl: result.qrCodeUrl,
          qrData: result.qrData,
          loading: false,
        }));
        return result.qrCodeUrl;
      } catch (error: any) {
        const message = error?.message || 'Failed to get QR code';
        setState(prev => ({ ...prev, error: message, loading: false }));
        toast.error(message);
        return null;
      }
    },
    [],
  );

  // Service method is `getProductBarcodeInfo`. It returns `BarcodeInfo`
  // — a flat shape with `barcode`, `barcodeUrl`, `qrCodeUrl`,
  // `productId`, `productName`, `sku`, `price`. It does NOT carry
  // `productSku` / `unitPrice` / `imageUrl`; the previous version of
  // this hook invented those fields and read them off the response.
  const getFullBarcode = useCallback(
    async (productId: string): Promise<any> => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const result = await barcodeService.getProductBarcodeInfo(productId);
        setState(prev => ({
          ...prev,
          barcode: result.barcode,
          barcodeUrl: result.barcodeUrl,
          qrCodeUrl: result.qrCodeUrl,
          product: {
            id: result.productId,
            name: result.productName,
            sku: result.sku,
            unitPrice: result.price,
          },
          loading: false,
        }));
        return result;
      } catch (error: any) {
        const message = error?.message || 'Failed to get barcode details';
        setState(prev => ({ ...prev, error: message, loading: false }));
        toast.error(message);
        return null;
      }
    },
    [],
  );

  // Service method is `getProductByBarcode`. It returns the Product
  // row directly (or `null` on 404, since the service swallows that
  // case).
  const lookupProduct = useCallback(
    async (barcode: string): Promise<any> => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const result = await barcodeService.getProductByBarcode(barcode);

        if (!result) {
          const message = 'Product not found for this barcode';
          setState(prev => ({ ...prev, error: message, loading: false }));
          toast.error(message);
          return null;
        }

        setState(prev => ({
          ...prev,
          product: result,
          loading: false,
        }));
        toast.success('Product found!');
        return result;
      } catch (error: any) {
        const message =
          error?.message || 'Product not found for this barcode';
        setState(prev => ({ ...prev, error: message, loading: false }));
        toast.error(message);
        return null;
      }
    },
    [],
  );

  // `validateBarcode` returns `{ valid, message? }` — the field is
  // `valid`, not `isValid`.
  const validateBarcode = useCallback(
    async (barcode: string): Promise<boolean> => {
      try {
        const result = await barcodeService.validateBarcode(barcode);
        return result.valid;
      } catch (error) {
        console.error('Failed to validate barcode:', error);
        return false;
      }
    },
    [],
  );

  const downloadBarcode = useCallback(
    async (productId: string): Promise<void> => {
      try {
        const data = await barcodeService.getBarcodeImage(productId);
        const response = await fetch(data.barcodeUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `barcode_${productId}_${data.barcode}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success('Barcode downloaded');
      } catch (error: any) {
        const message = error?.message || 'Failed to download barcode';
        toast.error(message);
      }
    },
    [],
  );

  const printBarcode = useCallback((productId: string): void => {
    window.open(`/admin/barcodes/print/${productId}`, '_blank');
  }, []);

  return {
    ...state,
    generateBarcode,
    getBarcode,
    getQRCode,
    getFullBarcode,
    lookupProduct,
    validateBarcode,
    downloadBarcode,
    printBarcode,
    reset,
  };
}
