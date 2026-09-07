// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\barcodes\print\[id]\page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { barcodeService } from '../../../../../../services/barcodeService';
import { productService } from '../../../../../../services/productService';
import { Loader2 } from 'lucide-react';

export default function BarcodePrintPage() {
  const params = useParams();
  const id = params?.id as string;
  const [loading, setLoading] = useState(true);
  const [barcodeUrl, setBarcodeUrl] = useState<string | null>(null);
  const [product, setProduct] = useState<any>(null);

  useEffect(() => {
    if (id) {
      loadBarcode();
    }
  }, [id]);

  const loadBarcode = async () => {
    try {
      setLoading(true);
      const [productData, barcodeData] = await Promise.all([
        productService.getProductById(id),
        barcodeService.getBarcodeImage(id),
      ]);
      setProduct(productData);
      setBarcodeUrl(barcodeData.barcodeUrl);
    } catch (error) {
      console.error('Failed to load barcode:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto print when loaded
  useEffect(() => {
    if (barcodeUrl && !loading) {
      window.print();
    }
  }, [barcodeUrl, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-8 print:p-0">
      <div className="text-center print:block">
        {barcodeUrl && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-8 print:border-none">
            <img
              src={barcodeUrl}
              alt={`Barcode for ${product?.name || ''}`}
              className="max-w-full h-auto"
            />
            {product && (
              <div className="mt-4">
                <p className="text-xl font-bold">{product.name}</p>
                <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                <p className="text-lg font-semibold">${product.unitPrice?.toFixed(2)}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
