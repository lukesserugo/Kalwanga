// D:\Projects\Kalwanga\packages\web\components\barcode\BarcodeScanner.tsx

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scan,
  Search,
  X,
  Loader2,
  Camera,
  AlertCircle,
  CheckCircle,
  Package,
} from 'lucide-react';
import { useBarcode } from '../../hooks/useBarcode';
import { toast } from '../../utils/toast-manager';

interface BarcodeScannerProps {
  onScan?: (result: any) => void;
  onProductFound?: (product: any) => void;
  onError?: (error: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  resultClassName?: string;
  showResult?: boolean;
  compact?: boolean;
}

export function BarcodeScanner({
  onScan,
  onProductFound,
  onError,
  autoFocus = true,
  placeholder = 'Enter or scan barcode...',
  className = '',
  inputClassName = '',
  buttonClassName = '',
  resultClassName = '',
  showResult = true,
  compact = false,
}: BarcodeScannerProps) {
  const [barcode, setBarcode] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { loading, product, error, lookupProduct, reset } = useBarcode();

  // Auto-focus input on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [autoFocus]);

  const handleScan = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      const trimmedBarcode = barcode.trim();
      if (!trimmedBarcode) {
        toast.warning('Please enter or scan a barcode');
        return;
      }

      const result = await lookupProduct(trimmedBarcode);

      if (result) {
        onScan?.(result);
        onProductFound?.(result);
      } else {
        onError?.('Product not found');
      }
    },
    [barcode, lookupProduct, onScan, onProductFound, onError]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleScan();
      }
      if (e.key === 'Escape') {
        setBarcode('');
        reset();
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
    },
    [handleScan, reset]
  );

  const handleClear = useCallback(() => {
    setBarcode('');
    reset();
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [reset]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.toUpperCase();
      setBarcode(value);

      // Auto-scan if barcode is complete (13 digits for EAN-13)
      if (value.length === 13 && /^\d{13}$/.test(value)) {
        handleScan();
      }
    },
    [handleScan]
  );

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex-1 relative">
          <Scan className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={barcode}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            className={`w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono tabular-nums ${inputClassName}`}
            disabled={loading}
          />
          {barcode && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus-ring rounded-full p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => handleScan()}
          disabled={loading || !barcode.trim()}
          className={`px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all focus-ring ${buttonClassName}`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Scan className="w-4 h-4" />
          )}
          Scan
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Scanner Input */}
      <div className="card-brand !p-4">
        <form onSubmit={handleScan} className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={barcode}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              className={`w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono tabular-nums transition-shadow ${inputClassName}`}
              disabled={loading}
            />
            {barcode && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus-ring rounded-full p-1 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !barcode.trim()}
            className={`px-6 py-3 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all focus-ring ${buttonClassName}`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Scan className="w-4 h-4" />
            )}
            {loading ? 'Searching...' : 'Scan'}
          </button>
        </form>

        <div className="mt-3 flex items-center gap-4 text-2xs text-gray-500 dark:text-gray-400">
          <span>💡 Enter barcode or use scanner</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Press Enter to search</span>
          {barcode.length === 13 && /^\d{13}$/.test(barcode) && (
            <span className="text-success-600 dark:text-success-400">
              ✓ Auto-scanning...
            </span>
          )}
        </div>
      </div>

      {/* Loading State */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-center py-8"
          >
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">
              Searching for product...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error State */}
      <AnimatePresence>
        {error && !loading && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-2xl p-4 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-danger-700 dark:text-danger-300">{error}</p>
              <p className="text-sm text-danger-500 dark:text-danger-400 mt-1">
                Barcode: <span className="font-mono tabular-nums">{barcode}</span>
              </p>
            </div>
            <button
              onClick={handleClear}
              className="px-3 py-1 bg-danger-100 dark:bg-danger-800/30 text-danger-700 dark:text-danger-300 rounded-lg hover:bg-danger-200 dark:hover:bg-danger-800/50 transition-colors text-sm focus-ring"
            >
              Try Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {showResult && product && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-success-200 dark:border-success-800 overflow-hidden ${resultClassName}`}
          >
            <div className="bg-success-50 dark:bg-success-900/20 px-4 py-2 border-b border-success-200 dark:border-success-800 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-success-500" />
              <span className="text-success-700 dark:text-success-300 font-medium">
                Product Found
              </span>
            </div>

            <div className="p-4">
              <div className="flex items-center gap-4">
                {/* Product Image */}
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Package className="w-8 h-8 text-gray-300 dark:text-gray-500" />
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                    {product.name}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-gray-500 dark:text-gray-400 font-mono">
                      SKU: {product.sku}
                    </span>
                    {product.barcode && (
                      <span className="text-gray-400 font-mono text-2xs tabular-nums">
                        {product.barcode}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-2xs font-medium ${
                        product.isActive
                          ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                          : 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
                      }`}
                    >
                      {product.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white tabular-nums">
                    ${product.unitPrice?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-2">
                <button
                  onClick={() => onProductFound?.(product)}
                  className="px-3 py-1.5 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all text-sm focus-ring"
                >
                  View Details
                </button>
                <button
                  onClick={handleClear}
                  className="btn-secondary focus-ring text-sm"
                >
                  Scan Another
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
