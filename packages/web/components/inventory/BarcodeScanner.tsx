// D:\Projects\Kalwanga\packages\web\components\inventory\BarcodeScanner.tsx

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scan, X, Package, Loader2, Check, AlertCircle,
  Camera, Image as ImageIcon, Barcode, QrCode,
  Copy, Printer, Download, RefreshCw, ZoomIn,
  ZoomOut, RotateCw, Focus, Sun, Moon,
  ShoppingCart, Plus, Minus, Eye, Edit,
  Lock,  // ✅ ADDED: Missing import
} from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { inventoryService } from '../../services/inventoryService';
import { barcodeService } from '../../services/barcodeService';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency, formatDate } from '../../utils/formatters';

// ============================================
// TYPES
// ============================================

interface ProductResult {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  price: number;
  stock: number;
  reserved?: number;
  available?: number;
  unit?: string;
  category?: string;
  location?: string;
  image?: string;
  description?: string;
  supplier?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface BarcodeScannerProps {
  onScan: (product: any) => void;
  onClose: () => void;
  isOpen: boolean;
  onError?: (error: Error) => void;
  autoFocus?: boolean;
  scanTimeout?: number;
  className?: string;
}

// ============================================
// CONSTANTS
// ============================================

const HISTORY_KEY = 'barcode_scanner_history';
const MAX_HISTORY = 20;

// ============================================
// MAIN COMPONENT
// ============================================

export function BarcodeScanner({
  onScan,
  onClose,
  isOpen,
  onError,
  autoFocus = true,
  scanTimeout = 5000,
  className = '',
}: BarcodeScannerProps) {
  const { user, isAuthenticated } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<ProductResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<ProductResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isScanningMode, setIsScanningMode] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load scan history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        const history = JSON.parse(stored);
        if (Array.isArray(history)) {
          setScanHistory(history.slice(0, MAX_HISTORY));
        }
      }
    } catch (e) {
      console.warn('Failed to load scan history:', e);
    }
  }, []);

  // Focus input on open
  useEffect(() => {
    if (isOpen && autoFocus) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen, autoFocus]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  const saveToHistory = (product: ProductResult) => {
    try {
      const existing = scanHistory.filter(p => p.barcode !== product.barcode);
      const newHistory = [product, ...existing].slice(0, MAX_HISTORY);
      setScanHistory(newHistory);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    } catch (e) {
      console.warn('Failed to save scan history:', e);
    }
  };

  const handleScan = useCallback(async () => {
    const barcodeValue = barcode.trim();
    if (!barcodeValue) {
      toast.warning('Please enter or scan a barcode');
      setError('Please enter a barcode');
      return;
    }

    setLoading(true);
    setError(null);
    setProduct(null);

    try {
      // Try to find product by barcode
      const result = await inventoryService.getInventoryByBarcode(barcodeValue);
      
      if (result) {
        // Map the result to ProductResult
        const productResult: ProductResult = {
          id: result.id || '',
          name: result.name || result.product?.name || 'Unknown Product',
          sku: result.sku || result.product?.sku || 'N/A',
          barcode: result.barcode || barcodeValue,
          price: result.unitPrice || result.price || result.product?.unitPrice || 0,
          stock: result.quantity || result.stock || 0,
          reserved: result.reserved || 0,
          available: (result.quantity || result.stock || 0) - (result.reserved || 0),
          unit: result.unit || 'each',
          category: result.category || result.product?.category?.name,
          location: result.location || 'Warehouse',
          image: result.images?.[0] || result.product?.images?.[0],
          description: result.description || result.product?.description,
          supplier: result.supplier || result.product?.supplier?.name,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
        };
        
        setProduct(productResult);
        saveToHistory(productResult);
        toast.success(`Product found: ${productResult.name}`);
        
        // Auto-select after a delay if in scanning mode
        if (isScanningMode) {
          scanTimeoutRef.current = setTimeout(() => {
            handleSelect();
          }, scanTimeout);
        }
      } else {
        setError('No product found with this barcode');
        toast.error('Product not found');
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      const errorMsg = err?.message || 'Failed to scan barcode';
      setError(errorMsg);
      toast.error(errorMsg);
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  }, [barcode, isScanningMode, scanTimeout, onError]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScan();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [handleScan, onClose]);

  const handleSelect = useCallback(() => {
    if (product) {
      onScan(product);
      onClose();
    }
  }, [product, onScan, onClose]);

  const handleClear = useCallback(() => {
    setBarcode('');
    setProduct(null);
    setError(null);
    setLoading(false);
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  const handleHistoryItemClick = useCallback((item: ProductResult) => {
    setBarcode(item.barcode);
    setProduct(item);
    setError(null);
    setShowHistory(false);
  }, []);

  const handleClearHistory = useCallback(() => {
    if (confirm('Clear scan history?')) {
      setScanHistory([]);
      localStorage.removeItem(HISTORY_KEY);
      toast.success('History cleared');
    }
  }, []);

  const getStockStatus = (product: ProductResult) => {
    const available = product.available || product.stock || 0;
    if (available <= 0) {
      return { label: 'Out of Stock', color: 'text-red-600 dark:text-red-400' };
    }
    if (available <= 5) {
      return { label: 'Low Stock', color: 'text-yellow-600 dark:text-yellow-400' };
    }
    return { label: 'In Stock', color: 'text-green-600 dark:text-green-400' };
  };

  if (!isOpen) return null;

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 ${className}`}
        >
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Please Login</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">You need to be logged in to scan items</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto ${className}`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Close scanner"
        >
          <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
            <Scan className="w-8 h-8 text-blue-500 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Barcode Scanner</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isScanningMode ? 'Scanning mode active - auto-select on scan' : 'Enter or scan a barcode to find a product'}
          </p>
        </div>

        {/* Scanner Mode Toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsScanningMode(!isScanningMode)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                isScanningMode
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {isScanningMode ? '✓ Scanning Mode' : 'Scanning Mode'}
            </button>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
          
          {scanHistory.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
            >
              {showHistory ? 'Hide History' : `History (${scanHistory.length})`}
            </button>
          )}
        </div>

        {/* Scan History */}
        <AnimatePresence>
          {showHistory && scanHistory.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700 p-2 max-h-40 overflow-y-auto">
                <div className="flex items-center justify-between mb-2 px-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Recent Scans</span>
                  <button
                    onClick={handleClearHistory}
                    className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                  >
                    Clear
                  </button>
                </div>
                {scanHistory.map((item, index) => (
                  <button
                    key={`${item.barcode}-${index}`}
                    onClick={() => handleHistoryItemClick(item)}
                    className="w-full text-left px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm flex items-center justify-between"
                  >
                    <span className="text-gray-700 dark:text-gray-300 truncate">{item.name}</span>
                    <span className="text-xs text-gray-400 font-mono">{item.barcode}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={barcode}
                onChange={(e) => {
                  setBarcode(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Enter barcode or scan..."
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:outline-none dark:bg-gray-700 dark:text-white transition-colors ${
                  error
                    ? 'border-red-500 dark:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                }`}
                autoFocus={autoFocus}
                disabled={loading}
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 animate-spin text-blue-500" />
              )}
              {barcode && !loading && (
                <button
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
            <button
              onClick={handleScan}
              disabled={loading || !barcode.trim()}
              className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Scan className="w-5 h-5" />}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </motion.div>
          )}

          {/* Product Result */}
          <AnimatePresence>
            {product && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {product.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-mono">SKU: {product.sku}</span>
                      {product.category && (
                        <span className="text-gray-400">• {product.category}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(product.price)}
                      </span>
                      <span className={getStockStatus(product).color}>
                        {getStockStatus(product).label}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {product.available !== undefined ? product.available : product.stock} {product.unit || 'units'}
                      </span>
                    </div>
                    {product.location && (
                      <p className="text-xs text-gray-400 mt-1">Location: {product.location}</p>
                    )}
                    {product.description && (
                      <p className="text-xs text-gray-400 mt-1 truncate">{product.description}</p>
                    )}
                  </div>
                </div>

                {/* Product Actions */}
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                  <button
                    onClick={handleSelect}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Check className="w-4 h-4" />
                    Select Product
                  </button>
                  <button
                    onClick={() => {
                      onScan(product);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Add to Order
                  </button>
                  <button
                    onClick={() => {
                      if (product.id) {
                        window.open(`/admin/inventory/${product.id}`, '_blank');
                      }
                    }}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    title="View Product"
                  >
                    <Eye className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-gray-500">Quick actions:</span>
              <button
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.readText()
                      .then(text => {
                        if (text) {
                          setBarcode(text);
                          toast.success('Barcode pasted');
                        }
                      })
                      .catch(() => toast.error('Failed to read clipboard'));
                  }
                }}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Paste
              </button>
              <button
                onClick={() => {
                  // Simulate barcode generation for demo
                  const demoBarcode = `INV${Date.now().toString().slice(-8)}`;
                  setBarcode(demoBarcode);
                  toast.info('Demo barcode generated');
                }}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Demo
              </button>
            </div>
            <button
              onClick={handleClear}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Clear
            </button>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            {product && (
              <button
                onClick={handleSelect}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Select Product
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================
// HOOKS
// ============================================

export function useBarcodeScanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

  const openScanner = useCallback(() => {
    setIsOpen(true);
    setScanResult(null);
  }, []);

  const closeScanner = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleScan = useCallback((product: any) => {
    setScanResult(product);
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    scanResult,
    openScanner,
    closeScanner,
    handleScan,
  };
}

// ============================================
// EXPORT
// ============================================

export default BarcodeScanner;
