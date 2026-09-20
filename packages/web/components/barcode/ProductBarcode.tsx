// D:\Projects\Kalwanga\packages\web\components\barcode\ProductBarcode.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  Printer,
  RefreshCw,
  Loader2,
  Check,
  X,
  Copy,
} from 'lucide-react';
import { barcodeService } from '../../services/barcodeService';
import { toast } from '../../utils/toast-manager';

interface ProductBarcodeProps {
  productId: string;
  productName?: string;
  productSku?: string;
  onClose?: () => void;
  className?: string;
}

export function ProductBarcode({
  productId,
  productName,
  productSku,
  onClose,
  className = '',
}: ProductBarcodeProps) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [barcode, setBarcode] = useState<string | null>(null);
  const [barcodeUrl, setBarcodeUrl] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    if (productId) {
      loadBarcode();
    }
  }, [productId]);

  const loadBarcode = async () => {
    try {
      setLoading(true);
      setError(null);

      const [barcodeData, qrCodeData] = await Promise.all([
        barcodeService.getProductBarcode(productId),
        barcodeService.getProductQRCode(productId),
      ]);

      setBarcode(barcodeData.barcode);
      setQrCodeUrl(qrCodeData.qrCodeUrl);

      // Load barcode image
      const imageData = await barcodeService.getBarcodeImage(productId);
      setBarcodeUrl(imageData.barcodeUrl);
    } catch (error: any) {
      console.error('Failed to load barcode:', error);
      setError(error?.message || 'Failed to load barcode');
      toast.error('Failed to load barcode');
    } finally {
      setLoading(false);
      setImageLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      await barcodeService.generateBarcode(productId);
      toast.success('Barcode generated successfully');
      await loadBarcode();
    } catch (error: any) {
      console.error('Failed to generate barcode:', error);
      toast.error(error?.message || 'Failed to generate barcode');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!barcode) return;
    try {
      await navigator.clipboard.writeText(barcode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Barcode copied to clipboard');
    } catch {
      toast.error('Failed to copy barcode');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!barcodeUrl) return;
    try {
      const response = await fetch(barcodeUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `barcode_${productId}_${barcode}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Barcode downloaded');
    } catch (error) {
      console.error('Failed to download barcode:', error);
      toast.error('Failed to download barcode');
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">
          Loading barcode...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
        <div className="text-danger-500 mb-3">⚠️ {error}</div>
        <button
          onClick={loadBarcode}
          className="px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all flex items-center gap-2 focus-ring"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`card-brand shadow-card-hover ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Product Barcode
          </h3>
          {productName && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {productName}
            </p>
          )}
          {productSku && (
            <p className="text-2xs text-gray-400 dark:text-gray-500 font-mono">
              SKU: {productSku}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Barcode Display */}
      <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-4">
        {imageLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          </div>
        ) : barcodeUrl ? (
          <div className="flex flex-col items-center">
            <img
              src={barcodeUrl}
              alt={`Barcode for ${productName || productId}`}
              className="max-w-full h-auto"
              onLoad={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
            />
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm font-mono text-gray-700 dark:text-gray-300 tabular-nums">
                {barcode}
              </span>
              <button
                onClick={handleCopy}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors focus-ring"
                title="Copy barcode"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-success-500" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              No barcode available
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="mt-3 px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg disabled:opacity-50 flex items-center gap-2 mx-auto transition-all focus-ring"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Generate Barcode
            </button>
          </div>
        )}
      </div>

      {/* QR Code Display */}
      {qrCodeUrl && (
        <div className="flex flex-col items-center mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            QR Code
          </h4>
          <img
            src={qrCodeUrl}
            alt={`QR Code for ${productName || productId}`}
            className="w-32 h-32 object-contain border border-gray-200 dark:border-gray-600 rounded-lg"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button onClick={handlePrint} className="btn-secondary focus-ring">
          <Printer className="w-4 h-4" />
          Print
        </button>
        <button
          onClick={handleDownload}
          disabled={!barcodeUrl}
          className="btn-secondary focus-ring disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Download
        </button>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg disabled:opacity-50 flex items-center gap-2 text-sm transition-all focus-ring"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Regenerate
        </button>
      </div>
    </motion.div>
  );
}
