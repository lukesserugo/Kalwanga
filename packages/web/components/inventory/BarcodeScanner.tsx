// packages/web/components/scanner/BarcodeScanner.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scan,
  X,
  Package,
  Loader2,
  Check,
  AlertCircle,
  ShoppingCart,
  Eye,
  Lock,
} from 'lucide-react';

import { toast } from '../../utils/toast-manager';
import { barcodeService } from '../../services/barcodeService';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency } from '../../utils/formatters';

// ============================================
// TYPES
// ============================================

/**
 * Canonical product/variant result this component passes to `onScan`.
 *
 * ⚠ Some fields are `undefined` on every code path because the
 *   canonical scan endpoint (`POST /barcodes/scan`) doesn't return
 *   them. If a consumer needs `image`, `category`, `description`,
 *   or `supplier`, it must fetch the full product via
 *   `productService.getProductById(id)` after receiving this.
 */
interface ScanResult {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  price: number;
  stock: number;
  reserved?: number;
  available?: number;
  unit?: string;
  /** Populated only when a full product lookup was done; else undefined. */
  category?: string;
  location?: string;
  /** Not returned by the scan endpoint; undefined unless enriched. */
  image?: string;
  description?: string;
  supplier?: string;
  /** Not returned by the scan endpoint. */
  createdAt?: string;
  updatedAt?: string;

  /**
   * Present when the scanned code matched a `ProductVariant` rather
   * than a `Product`. Consumers that need to distinguish (POS pricing,
   * cart line identity) should read this.
   */
  variant?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    attributes: Record<string, unknown>;
  } | null;

  /** `'PRODUCT'` or `'VARIANT'` — which column matched. */
  matchType: 'PRODUCT' | 'VARIANT';
}

interface BarcodeScannerProps {
  onScan: (product: ScanResult) => void;
  onClose: () => void;
  isOpen: boolean;
  /**
   * Called when a scan cannot complete — a network error, a
   * "product not found" result, or a validation failure. Consumers
   * use this to log failed scans or show a global error toast.
   *
   * ⚠ Not called for "user cancelled" or "empty input".
   */
  onError?: (error: Error) => void;
  /** Focus the input when the modal opens. Default `true`. */
  autoFocus?: boolean;
  /**
   * Delay (ms) between a successful scan and the auto-select in
   * scanning mode. Default 5000. Set to 0 to select immediately.
   */
  scanTimeout?: number;
  className?: string;
}

// ============================================
// CONSTANTS
// ============================================

const HISTORY_KEY = 'barcode_scanner_history';
const MAX_HISTORY = 20;

// ============================================
// HELPERS
// ============================================

function extractErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  const anyErr = error as any;
  const data = anyErr?.response?.data;

  if (data) {
    if (typeof data.error === 'string') return data.error;
    if (data.error?.message) return String(data.error.message);
    if (data.message) return String(data.message);
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors
        .map((e: any) => `${e.field ?? 'field'}: ${e.message ?? 'invalid'}`)
        .join(', ');
    }
  }

  if (anyErr?.message) return String(anyErr.message);
  return fallback;
}

/**
 * Normalize whatever the backend emits into the `ScanResult` shape
 * this component renders.
 *
 * `barcodeService.scanBarcode` is the canonical source — see the
 * backend `BarcodeService.scanBarcode`. It returns product + optional
 * variant + optional inventory, but NOT the full product row
 * (no images, no category name, no description, no supplier).
 * Fields the endpoint doesn't return are left `undefined` and the
 * UI hides them.
 */
function normalizeScanResponse(raw: any): ScanResult | null {
  if (!raw || typeof raw !== 'object') return null;

  const product = raw.product ?? {};
  const variant = raw.variant ?? null;
  const inventory = raw.inventory ?? null;

  const matchType: 'PRODUCT' | 'VARIANT' =
    raw.matchType === 'VARIANT' ? 'VARIANT' : 'PRODUCT';

  // Prefer variant fields when the scan matched a variant — the
  // variant's name, sku, and price are what the operator needs.
  const name = variant?.name ?? product.name ?? 'Unknown product';
  const sku = variant?.sku ?? product.sku ?? 'N/A';
  const price = Number(
    variant?.price ?? product.unitPrice ?? 0,
  );

  const stock = Number(inventory?.quantity ?? 0);
  const reserved = Number(inventory?.reserved ?? 0);
  const available = Number(
    typeof inventory?.available === 'number'
      ? inventory.available
      : stock - reserved,
  );

  const id = product.id ?? variant?.id ?? '';

  return {
    id: String(id),
    name,
    sku,
    barcode: String(raw.barcode ?? ''),
    price,
    stock,
    reserved,
    available,
    unit: 'each',
    matchType,
    variant: variant
      ? {
          id: String(variant.id ?? ''),
          name: String(variant.name ?? ''),
          sku: String(variant.sku ?? ''),
          price: Number(variant.price ?? 0),
          attributes:
            variant.attributes && typeof variant.attributes === 'object'
              ? variant.attributes
              : {},
        }
      : null,
    // Fields the scan endpoint doesn't return — left undefined.
    category: undefined,
    location: undefined,
    image: undefined,
    description: undefined,
    supplier: undefined,
    createdAt: undefined,
    updatedAt: undefined,
  };
}

function loadHistoryFromStorage(): ScanResult[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_HISTORY);
  } catch (error) {
    console.warn('[BarcodeScanner] failed to load history:', error);
    return [];
  }
}

function persistHistory(history: ScanResult[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.warn('[BarcodeScanner] failed to save history:', error);
  }
}

// ============================================
// COMPONENT
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
  const { isAuthenticated } = useAuth();

  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isScanningMode, setIsScanningMode] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const scanRequestIdRef = useRef(0);

  // ── Lifecycle ─────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load history once on mount. Cross-tab sync isn't handled — a
  // second tab's scans won't appear here until this component
  // remounts. Add a `storage` event listener if that matters.
  useEffect(() => {
    setScanHistory(loadHistoryFromStorage());
  }, []);

  // Focus the input when the modal opens.
  useEffect(() => {
    if (!isOpen || !autoFocus) return;
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, [isOpen, autoFocus]);

  /**
   * Clear the auto-select timer whenever the modal closes. The modal
   * content stays mounted when `isOpen` is false, so this is the only
   * place the timeout gets cleaned up.
   */
  useEffect(() => {
    if (isOpen) return;
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
  }, [isOpen]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
    };
  }, []);

  // ── History helpers ───────────────────────────────────────

  const saveToHistory = useCallback((item: ScanResult) => {
    setScanHistory((prev) => {
      const without = prev.filter((p) => p.barcode !== item.barcode);
      const next = [item, ...without].slice(0, MAX_HISTORY);
      persistHistory(next);
      return next;
    });
  }, []);

  const handleClearHistory = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!window.confirm('Clear scan history?')) return;
    setScanHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* ignore */
    }
    toast.success('History cleared');
  }, []);

  const handleHistoryItemClick = useCallback((item: ScanResult) => {
    setBarcode(item.barcode);
    setProduct(item);
    setError(null);
    setShowHistory(false);
  }, []);

  // ── Scan ──────────────────────────────────────────────────

  const handleScan = useCallback(async () => {
    const value = barcode.trim();

    if (!value) {
      setError('Please enter a barcode');
      toast.warning('Please enter or scan a barcode');
      inputRef.current?.focus();
      return;
    }

    // Cancel any pending auto-select from a previous scan.
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }

    const requestId = ++scanRequestIdRef.current;

    setLoading(true);
    setError(null);
    setProduct(null);

    try {
      // ⚠ Canonical scan endpoint — replaces the previous
      //    `inventoryService.getInventoryByBarcode` call, which
      //    resolved to a non-existent method.
      const response = await barcodeService.scanBarcode(value);

      if (requestId !== scanRequestIdRef.current) return;
      if (!mountedRef.current) return;

      const result = normalizeScanResponse(response);

      if (!result) {
        const message = 'Product not found with this barcode';
        setError(message);
        toast.error(message);
        onError?.(new Error(message));
        return;
      }

      setProduct(result);
      saveToHistory(result);
      toast.success(`Found: ${result.name}`);

      if (isScanningMode) {
        // Auto-select after `scanTimeout` ms. Capture `result` in
        // the closure so we don't rely on `product` state, which is
        // still the previous value at this point.
        if (scanTimeout > 0) {
          scanTimeoutRef.current = setTimeout(() => {
            scanTimeoutRef.current = null;
            onScan(result);
            onClose();
          }, scanTimeout);
        } else {
          onScan(result);
          onClose();
        }
      }
    } catch (err) {
      if (requestId !== scanRequestIdRef.current) return;
      if (!mountedRef.current) return;

      const message = extractErrorMessage(err, 'Failed to scan barcode');
      console.error('[BarcodeScanner] scan failed:', message);
      setError(message);
      toast.error(message);
      onError?.(err instanceof Error ? err : new Error(message));
    } finally {
      if (requestId === scanRequestIdRef.current && mountedRef.current) {
        setLoading(false);
      }
    }
  }, [barcode, isScanningMode, scanTimeout, onScan, onClose, onError, saveToHistory]);

  // ── Input handlers ────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void handleScan();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleScan, onClose],
  );

  const handleClear = useCallback(() => {
    // Invalidate any in-flight scan so its response is discarded.
    scanRequestIdRef.current++;

    setBarcode('');
    setProduct(null);
    setError(null);
    setLoading(false);

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }

    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSelect = useCallback(() => {
    if (!product) return;
    onScan(product);
    onClose();
  }, [product, onScan, onClose]);

  const handlePasteFromClipboard = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      toast.error('Clipboard not available');
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      // Strip whitespace and control characters — the same
      // normalization `barcodeService` applies server-side.
      const cleaned = text.replace(/[\r\n\t\s]+/g, '').trim();

      if (!cleaned) {
        toast.error('Clipboard is empty');
        return;
      }

      setBarcode(cleaned);
      setError(null);
      toast.success('Barcode pasted');
      inputRef.current?.focus();
    } catch (err) {
      console.warn('[BarcodeScanner] clipboard read failed:', err);
      toast.error('Could not read clipboard');
    }
  }, []);

  // ── Derived ───────────────────────────────────────────────

  const stockStatus = useMemo(() => {
    if (!product) return null;
    const available = product.available ?? product.stock ?? 0;
    if (available <= 0) {
      return {
        label: 'Out of Stock',
        color: 'text-danger-600 dark:text-danger-400',
      };
    }
    if (available <= 5) {
      return {
        label: 'Low Stock',
        color: 'text-warning-600 dark:text-warning-400',
      };
    }
    return {
      label: 'In Stock',
      color: 'text-success-600 dark:text-success-400',
    };
  }, [product]);

  // ── Render: not open ──────────────────────────────────────

  if (!isOpen) return null;

  // ── Render: not authenticated ─────────────────────────────

  if (!isAuthenticated) {
    return (
      <div
        className="fixed inset-0 z-modal flex items-center justify-center p-4 animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scanner-login-title"
      >
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={`relative card-brand shadow-card-hover max-w-md w-full ${className}`}
        >
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-gray-400" />
            </div>
            <h3
              id="scanner-login-title"
              className="text-lg font-bold text-gray-900 dark:text-white"
            >
              Please Log In
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              You need to be logged in to scan items
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all focus-ring"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Render: main scanner ──────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scanner-title"
    >
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`relative card-brand shadow-card-hover max-w-md w-full max-h-[90vh] overflow-y-auto custom-scrollbar ${className}`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
          aria-label="Close scanner"
        >
          <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-brand-100 dark:bg-brand-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
            <Scan className="w-8 h-8 text-brand-500 dark:text-brand-400" />
          </div>
          <h3
            id="scanner-title"
            className="text-lg font-bold text-gray-900 dark:text-white"
          >
            Barcode Scanner
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isScanningMode
              ? 'Scanning mode active — auto-select on scan'
              : 'Enter or scan a barcode to find a product'}
          </p>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsScanningMode((v) => !v)}
              aria-pressed={isScanningMode}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors focus-ring ${
                isScanningMode
                  ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-600'
              }`}
            >
              {isScanningMode ? '✓ Scanning Mode' : 'Scanning Mode'}
            </button>
          </div>

          {scanHistory.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              aria-expanded={showHistory}
              className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 transition-colors focus-ring rounded"
            >
              {showHistory ? 'Hide History' : `History (${scanHistory.length})`}
            </button>
          )}
        </div>

        <AnimatePresence>
          {showHistory && scanHistory.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700 p-2 max-h-40 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-2 px-2">
                  <span className="text-2xs font-medium text-gray-500 dark:text-gray-400">
                    Recent Scans
                  </span>
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="text-2xs text-danger-600 dark:text-danger-400 hover:text-danger-800 dark:hover:text-danger-300 focus-ring rounded"
                  >
                    Clear
                  </button>
                </div>
                {scanHistory.map((item, index) => (
                  <button
                    type="button"
                    key={`${item.barcode}-${index}`}
                    onClick={() => handleHistoryItemClick(item)}
                    className="w-full text-left px-2 py-1.5 hover:bg-orange-50 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm flex items-center justify-between focus-ring"
                  >
                    <span className="text-gray-700 dark:text-gray-300 truncate">
                      {item.name}
                    </span>
                    <span className="text-2xs text-gray-400 font-mono">
                      {item.barcode}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                aria-label="Barcode input"
                aria-invalid={error ? 'true' : 'false'}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:outline-none bg-white dark:bg-gray-700 dark:text-white transition-colors ${
                  error
                    ? 'border-danger-500 dark:border-danger-500 focus:ring-danger-500'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-brand-500'
                }`}
                autoFocus={autoFocus}
                disabled={loading}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 animate-spin text-brand-500" />
              )}
              {barcode && !loading && (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Clear barcode"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-orange-50 dark:hover:bg-gray-600 rounded-lg transition-colors focus-ring"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleScan()}
              disabled={loading || !barcode.trim()}
              aria-label="Scan barcode"
              className="px-4 py-3 bg-brand-gradient text-white rounded-xl shadow-brand hover:shadow-brand-lg disabled:opacity-50 transition-all flex items-center gap-2 focus-ring"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Scan className="w-5 h-5" />
              )}
            </button>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
              className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-3 flex items-start gap-2 animate-slide-down"
            >
              <AlertCircle className="w-4 h-4 text-danger-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-danger-700 dark:text-danger-300">
                {error}
              </p>
            </motion.div>
          )}

          <AnimatePresence>
            {product && stockStatus && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-xl p-4"
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
                    {product.variant && (
                      <p className="text-2xs text-brand-600 dark:text-brand-400">
                        Variant matched
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-mono">SKU: {product.sku}</span>
                      {product.category && (
                        <>
                          <span className="text-gray-400">•</span>
                          <span>{product.category}</span>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm">
                      <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                        {formatCurrency(product.price)}
                      </span>
                      <span className={stockStatus.color}>
                        {stockStatus.label}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 tabular-nums">
                        {product.available ?? product.stock}{' '}
                        {product.unit || 'units'}
                      </span>
                    </div>
                    {product.location && (
                      <p className="text-2xs text-gray-400 mt-1">
                        Location: {product.location}
                      </p>
                    )}
                    {product.description && (
                      <p className="text-2xs text-gray-400 mt-1 truncate">
                        {product.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-success-200 dark:border-success-800">
                  <button
                    type="button"
                    onClick={handleSelect}
                    className="flex-1 px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all flex items-center justify-center gap-2 text-sm focus-ring"
                  >
                    <Check className="w-4 h-4" />
                    Select &amp; Close
                  </button>
                  <button
                    type="button"
                    onClick={() => onScan(product)}
                    className="px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors flex items-center justify-center gap-2 text-sm focus-ring"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Add (keep open)
                  </button>
                  <a
                    href={`/admin/inventory/${product.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors focus-ring"
                    title="View Product"
                    aria-label={`View ${product.name} in a new tab`}
                  >
                    <Eye className="w-4 h-4 text-gray-500" />
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-2xs text-gray-400 dark:text-gray-500">
                Quick actions:
              </span>
              <button
                type="button"
                onClick={() => void handlePasteFromClipboard()}
                className="px-2 py-1 text-2xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors focus-ring"
              >
                Paste
              </button>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors focus-ring rounded"
            >
              Clear
            </button>
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary focus-ring"
            >
              Cancel
            </button>
            {product && (
              <button
                type="button"
                onClick={handleSelect}
                className="px-6 py-2 bg-brand-gradient text-white rounded-xl shadow-brand hover:shadow-brand-lg transition-all flex items-center gap-2 focus-ring"
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
// HOOK
// ============================================

/**
 * Convenience wrapper for consumers that just want the open/close
 * state and the last scan result. Pair with `<BarcodeScanner>`:
 *
 *   const scanner = useBarcodeScanner();
 *   // …
 *   <BarcodeScanner
 *     isOpen={scanner.isOpen}
 *     onClose={scanner.closeScanner}
 *     onScan={scanner.handleScan}
 *   />
 */
export function useBarcodeScanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [scanResult, setScanResult] = useState<unknown>(null);

  const openScanner = useCallback(() => {
    setIsOpen(true);
    setScanResult(null);
  }, []);

  const closeScanner = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleScan = useCallback((product: unknown) => {
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

export default BarcodeScanner;
