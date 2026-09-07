// components/barcode/BarcodeDisplayWithInventory.tsx
'use client';

import { useState, useEffect } from 'react';
import { QrCode, Barcode, Copy, Check, Download, Printer, RefreshCw } from 'lucide-react';
import { barcodeService } from '../../services/barcodeService';
import { inventoryService } from '../../services/inventoryService';

interface BarcodeDisplayWithInventoryProps {
  productId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  onBarcodeGenerated?: (barcode: string) => void;
}

export function BarcodeDisplayWithInventory({ 
  productId, 
  productName, 
  sku, 
  unitPrice,
  onBarcodeGenerated 
}: BarcodeDisplayWithInventoryProps) {
  const [barcodeData, setBarcodeData] = useState<{
    barcode: string;
    barcodeUrl: string;
    qrCodeUrl: string;
  } | null>(null);
  const [inventory, setInventory] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (productId) {
      loadBarcodeAndInventory();
    }
  }, [productId]);

  const loadBarcodeAndInventory = async () => {
    try {
      setLoading(true);
      const [barcode, inventoryData] = await Promise.all([
        barcodeService.getBarcodeByProduct(productId),
        inventoryService.getInventory(productId)
      ]);
      setBarcodeData(barcode);
      setInventory(inventoryData);
    } catch (error) {
      console.error('Failed to load barcode and inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBarcode = async () => {
    try {
      setLoading(true);
      const result = await barcodeService.generateBarcode(productId);
      setBarcodeData(result);
      onBarcodeGenerated?.(result.barcode);
      toast.success('Barcode generated successfully');
    } catch (error) {
      toast.error('Failed to generate barcode');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyBarcode = async () => {
    if (!barcodeData?.barcode) return;
    try {
      await navigator.clipboard.writeText(barcodeData.barcode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Barcode copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Barcode - ${productName}</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .container { text-align: center; }
            .barcode-img { max-width: 300px; }
            .qr-img { max-width: 150px; margin-top: 10px; }
            .info { margin-top: 20px; }
            .info p { margin: 5px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>${productName}</h2>
            <img src="${barcodeData?.barcodeUrl}" alt="Barcode" class="barcode-img" />
            ${barcodeData?.qrCodeUrl ? `<img src="${barcodeData.qrCodeUrl}" alt="QR Code" class="qr-img" />` : ''}
            <div class="info">
              <p><strong>SKU:</strong> ${sku}</p>
              <p><strong>Barcode:</strong> ${barcodeData?.barcode}</p>
              <p><strong>Price:</strong> $${unitPrice.toFixed(2)}</p>
              <p><strong>In Stock:</strong> ${inventory?.quantity || 0}</p>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return <div className="animate-pulse">Loading barcode...</div>;
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Product Identification
        </h3>
        <button
          onClick={handleGenerateBarcode}
          disabled={loading}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-1"
        >
          <RefreshCw className="w-4 h-4" />
          Generate
        </button>
      </div>

      {barcodeData ? (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            {/* Barcode */}
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Barcode</p>
              {barcodeData.barcodeUrl ? (
                <img src={barcodeData.barcodeUrl} alt="Barcode" className="h-12 w-auto" />
              ) : (
                <div className="h-12 flex items-center justify-center text-gray-400">No barcode</div>
              )}
              <div className="flex items-center gap-2 justify-center mt-1">
                <code className="text-xs font-mono text-gray-600 dark:text-gray-400">
                  {barcodeData.barcode}
                </code>
                <button
                  onClick={handleCopyBarcode}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* QR Code */}
            {barcodeData.qrCodeUrl && (
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">QR Code</p>
                <img src={barcodeData.qrCodeUrl} alt="QR Code" className="w-16 h-16 object-contain" />
              </div>
            )}
          </div>

          {/* Inventory Information */}
          {inventory && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Quantity</p>
                <p className="font-medium text-gray-900 dark:text-white">{inventory.quantity || 0}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Min Stock</p>
                <p className="font-medium text-gray-900 dark:text-white">{inventory.minStock || 5}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Max Stock</p>
                <p className="font-medium text-gray-900 dark:text-white">{inventory.maxStock || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Location</p>
                <p className="font-medium text-gray-900 dark:text-white">{inventory.location || 'Default'}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => window.open(barcodeData.barcodeUrl, '_blank')}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <Barcode className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400">No barcode generated yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">Generate a barcode for this product</p>
        </div>
      )}
    </div>
  );
}
