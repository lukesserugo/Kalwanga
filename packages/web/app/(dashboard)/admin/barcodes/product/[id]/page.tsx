// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\barcodes\product\[id]\page.tsx

'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useBarcode } from '../../../../../../hooks/useBarcode';
import { BarcodeDisplay } from '../../../../../../components/barcode/BarcodeDisplay';

export default function ProductBarcodePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { loading, product, getFullBarcode } = useBarcode();

  useEffect(() => {
    if (id) {
      getFullBarcode(id);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/admin/barcodes')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Barcode Details</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            View and manage barcode for this product
          </p>
        </div>
      </div>

      <BarcodeDisplay
        productId={id}
        productName={product?.name}
        productSku={product?.sku}
        showQRCode={true}
        showActions={true}
      />
    </div>
  );
}
