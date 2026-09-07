// D:\Projects\Kalwanga\packages\web\components\barcode\BarcodeDisplay.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Printer, RefreshCw, Loader2, Check, Copy, QrCode, Barcode } from 'lucide-react';
import { useBarcode } from '../../hooks/useBarcode';
import { toast } from '../../utils/toast-manager';

interface BarcodeDisplayProps {
  productId: string;
  productName?: string;
  productSku?: string;
  autoLoad?: boolean;
  showQRCode?: boolean;
  showActions?: boolean;
  onClose?: () => void;
  className?: string;
  variant?: 'default' | 'compact' | 'minimal';
}

export function BarcodeDisplay({
  productId,
  productName,
  productSku,
  autoLoad = true,
  showQRCode = true,
  showActions = true,
  onClose,
  className = '',
  variant = 'default',
}: BarcodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const {
    barcode,
    barcodeUrl,
    qrCodeUrl,
    loading,
    generating,
    error,
    getBarcode,
    getQRCode,
    getFullBarcode,
    generateBarcode,
    downloadBarcode,
    printBarcode,
    reset,
  } = useBarcode();

  useEffect(() => {
    if (autoLoad && productId) {
      loadBarcodeData();
    }
    return () => reset();
  }, [productId, autoLoad]);

  const loadBarcodeData = async () => {
    if (showQRCode) {
      await getFullBarcode(productId);
    } else {
      await getBarcode(productId);
      if (showQRCode) {
        await getQRCode(productId);
      }
    }
  };

  const handleCopy = async () => {
    if (!barcode) return;
    try {
      await navigator.clipboard.writeText(barcode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Barcode copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleGenerate = async () => {
    await generateBarcode(productId);
    await loadBarcodeData();
  };

  const handleDownload = async () => {
    await downloadBarcode(productId);
  };

  const handlePrint = () => {
    printBarcode(productId);
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading barcode...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
        <div className="text-red-500 mb-3">⚠️ {error}</div>
        <button
          onClick={loadBarcodeData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        {barcode ? (
          <div className="flex items-center gap-2">
            <Barcode className="w-4 h-4 text-gray-400" />
            <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{barcode}</span>
            <button
              onClick={handleCopy}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-gray-400" />}
            </button>
          </div>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Generate
          </button>
        )}
        {showQRCode && qrCodeUrl && (
          <button
            onClick={() => window.open(qrCodeUrl, '_blank')}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="View QR Code"
          >
            <QrCode className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Barcode</span>
          <div className="flex items-center gap-1">
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>
        </div>
        
        {barcodeUrl ? (
          <div className="flex flex-col items-center">
            <img
              src={barcodeUrl}
              alt={`Barcode for ${productName || productId}`}
              className="max-w-full h-auto"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(false)}
            />
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-mono text-gray-600 dark:text-gray-400">{barcode}</span>
              <button
                onClick={handleCopy}
                className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-gray-400" />}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-4 text-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 transition-colors"
          >
            {generating ? (
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-400">Generate Barcode</span>
            )}
          </button>
        )}
        
        {showQRCode && qrCodeUrl && (
          <div className="mt-2 flex items-center justify-center">
            <img src={qrCodeUrl} alt="QR Code" className="w-16 h-16 object-contain" />
          </div>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Product Barcode</h3>
          {productName && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{productName}</p>
          )}
          {productSku && (
            <p className="text-xs text-gray-400 dark:text-gray-500">SKU: {productSku}</p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* Barcode Display */}
      <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-4">
        {barcodeUrl ? (
          <div className="flex flex-col items-center">
            <img
              src={barcodeUrl}
              alt={`Barcode for ${productName || productId}`}
              className="max-w-full h-auto"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(false)}
            />
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{barcode}</span>
              <button
                onClick={handleCopy}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                title="Copy barcode"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">No barcode available</p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Generate Barcode
            </button>
          </div>
        )}
      </div>

      {/* QR Code Display */}
      {showQRCode && qrCodeUrl && (
        <div className="flex flex-col items-center mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">QR Code</h4>
          <img
            src={qrCodeUrl}
            alt={`QR Code for ${productName || productId}`}
            className="w-32 h-32 object-contain border border-gray-200 dark:border-gray-600 rounded-lg"
          />
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handlePrint}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={handleDownload}
            disabled={!barcodeUrl}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Regenerate
          </button>
        </div>
      )}
    </motion.div>
  );
}

// Add missing imports
import { X } from 'lucide-react';
