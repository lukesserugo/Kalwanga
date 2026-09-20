// D:\Projects\Kalwanga\packages\web\components\inventory\InventoryScan.tsx

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scan,
  Search,
  Package,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Edit,
  RefreshCcw,
  Eye,
  Barcode,
  Clock,
  X,
} from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import { inventoryService } from '../../services/inventoryService';
import { toast } from '../../utils/toast-manager';
import { formatCurrency } from '../../utils/formatters';

// ============================================
// TYPES
// ============================================

export interface ScannedItem {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  stock: number;
  reserved: number;
  available: number;
  price: number;
  costPrice?: number;
  category?: string;
  supplier?: string;
  location?: string;
  images?: string[];
  reorderPoint?: number;
  unit?: string;
  isActive?: boolean;
  updatedAt?: string;
}

export interface ScanHistoryEntry {
  id: string;
  code: string;
  success: boolean;
  message?: string;
  timestamp: string;
  item?: ScannedItem;
}

export interface InventoryScanProps {
  /**
   * Business unit scope for lookups. When omitted, the component reads
   * `selectedBusinessUnitId` / `businessUnitId` from localStorage —
   * the same keys the inventory dashboard writes.
   */
  businessUnitId?: string;

  /** Minimum length before a scan fires. Defaults to 4. */
  minCodeLength?: number;

  /** Debounce window in ms for hardware scanners. Defaults to 150. */
  scanDebounceMs?: number;

  /** Maximum entries kept in the history list. Defaults to 20. */
  historyLimit?: number;

  /**
   * Called after a successful lookup. Useful for parent components
   * that want to react to a scan (e.g. add the item to a cart).
   */
  onScanSuccess?: (item: ScannedItem) => void;

  /** Called when a lookup fails or returns no item. */
  onScanError?: (code: string, message: string) => void;

  /**
   * When true, hides the internal "View / Edit / Adjust" buttons so
   * the parent can supply its own actions. Defaults to false.
   */
  hideDefaultActions?: boolean;

  /**
   * When true, hides the scan history list. Defaults to false.
   */
  hideHistory?: boolean;

  /** Optional className for the outer wrapper. */
  className?: string;
}

// ============================================
// COMPONENT
// ============================================

export function InventoryScan({
  businessUnitId: businessUnitIdProp,
  minCodeLength = 4,
  scanDebounceMs = 150,
  historyLimit = 20,
  onScanSuccess,
  onScanError,
  hideDefaultActions = false,
  hideHistory = false,
  className = '',
}: InventoryScanProps) {
  const router = useRouter();
  const {
    canViewInventory,
    canAdjustInventory,
    isLoading: permissionsLoading,
  } = usePermission();

  const [barcode, setBarcode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<ScannedItem | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const [storedBusinessUnitId, setStoredBusinessUnitId] = useState<string>('');

  const inputRef = useRef<HTMLInputElement>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ────────────────────────────────────────────────────────────
  // Effective business unit ID
  //
  // Caller-supplied takes precedence. Otherwise we fall back to
  // localStorage, which is where the inventory dashboard persists
  // the user's current selection.
  // ────────────────────────────────────────────────────────────
  const businessUnitId = businessUnitIdProp || storedBusinessUnitId;

  // ────────────────────────────────────────────────────────────
  // Read the stored business unit on mount, and again whenever
  // storage changes (another tab may have switched it).
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (businessUnitIdProp) return; // caller owns it

    const read = () => {
      try {
        const stored =
          localStorage.getItem('selectedBusinessUnitId') ||
          localStorage.getItem('businessUnitId');
        if (
          stored &&
          stored !== 'default' &&
          stored !== 'null' &&
          stored !== 'undefined'
        ) {
          setStoredBusinessUnitId(stored);
        } else {
          setStoredBusinessUnitId('');
        }
      } catch {
        /* storage unavailable */
      }
    };

    read();

    const onStorage = (e: StorageEvent) => {
      if (
        e.key === 'selectedBusinessUnitId' ||
        e.key === 'businessUnitId'
      ) {
        read();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [businessUnitIdProp]);

  // ────────────────────────────────────────────────────────────
  // Autofocus the input on mount and after every scan
  // ────────────────────────────────────────────────────────────
  const focusInput = useCallback(() => {
    // requestAnimationFrame so we focus after React commits
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  // ────────────────────────────────────────────────────────────
  // Refocus whenever the user clicks anywhere on the page.
  //
  // Hardware scanners type into whatever has focus, and clicks are
  // common on a page like this. Without this, the scanner goes
  // nowhere after the first stray click.
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleClick = () => focusInput();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [focusInput]);

  // ============================================
  // SCAN LOGIC
  // ============================================

  const handleScan = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;

      if (!businessUnitId) {
        const message =
          'No business unit selected. Please choose one first.';
        setScanError(message);
        toast.error(message);
        onScanError?.(trimmed, message);
        return;
      }

      setScanning(true);
      setScanError(null);

      try {
        // Try barcode first, then SKU. Both are scoped to the
        // current business unit.
        let item: any = null;

        try {
          item = await inventoryService.getInventoryByBarcode(
            trimmed,
            businessUnitId
          );
        } catch {
          // 404 is expected when the code isn't a barcode. Fall
          // through to SKU.
        }

        if (!item) {
          try {
            item = await inventoryService.getInventoryBySku(
              trimmed,
              businessUnitId
            );
          } catch {
            // Same — 404 means it's not a SKU either.
          }
        }

        if (!item) {
          const message = `No item found for "${trimmed}"`;
          setScanError(message);
          setLastScanned(null);
          setHistory((prev) =>
            [
              {
                id: `${Date.now()}-${trimmed}`,
                code: trimmed,
                success: false,
                message,
                timestamp: new Date().toISOString(),
              },
              ...prev,
            ].slice(0, historyLimit)
          );
          toast.error(message);
          onScanError?.(trimmed, message);
          return;
        }

        // Normalise whatever shape the API returned.
        const scanned: ScannedItem = {
          id: item.id,
          name: item.name || item.product?.name || 'Unknown item',
          sku: item.sku || item.product?.sku || 'N/A',
          barcode: item.barcode ?? null,
          stock: item.stock ?? item.quantity ?? 0,
          reserved: item.reserved ?? 0,
          available:
            item.available ??
            (item.stock ?? item.quantity ?? 0) - (item.reserved ?? 0),
          price: item.price ?? item.unitPrice ?? 0,
          costPrice: item.costPrice ?? item.product?.costPrice ?? 0,
          category:
            typeof item.category === 'string'
              ? item.category
              : item.category?.name ?? item.product?.category?.name,
          supplier:
            typeof item.supplier === 'string'
              ? item.supplier
              : item.supplier?.name ?? item.product?.supplier?.name,
          location: item.location,
          images: item.images ?? item.product?.images ?? [],
          reorderPoint: item.reorderPoint ?? item.minStock ?? 5,
          unit: item.unit ?? 'each',
          isActive: item.isActive !== false,
          updatedAt: item.updatedAt,
        };

        setLastScanned(scanned);
        setHistory((prev) =>
          [
            {
              id: `${Date.now()}-${trimmed}`,
              code: trimmed,
              success: true,
              timestamp: new Date().toISOString(),
              item: scanned,
            },
            ...prev,
          ].slice(0, historyLimit)
        );

        toast.success(`Found: ${scanned.name}`);
        onScanSuccess?.(scanned);
      } catch (error: any) {
        const message =
          error?.response?.data?.message ||
          error?.message ||
          'Scan failed';
        setScanError(message);
        setLastScanned(null);
        setHistory((prev) =>
          [
            {
              id: `${Date.now()}-${trimmed}`,
              code: trimmed,
              success: false,
              message,
              timestamp: new Date().toISOString(),
            },
            ...prev,
          ].slice(0, historyLimit)
        );
        toast.error(message);
        onScanError?.(trimmed, message);
      } finally {
        setScanning(false);
        setBarcode('');
        focusInput();
      }
    },
    [
      businessUnitId,
      focusInput,
      historyLimit,
      onScanSuccess,
      onScanError,
    ]
  );

  // ────────────────────────────────────────────────────────────
  // Hardware scanners type the code fast, then send Enter. The
  // debounce keeps us from firing on every keystroke.
  // ────────────────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBarcode(value);

    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = setTimeout(() => {
      const trimmed = value.trim();
      if (trimmed.length >= minCodeLength) {
        handleScan(trimmed);
      }
    }, scanDebounceMs);
  };

  // ────────────────────────────────────────────────────────────
  // Manual Enter: same as scan, but immediate.
  // ────────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      const value = barcode.trim();
      if (value) handleScan(value);
    }
    if (e.key === 'Escape') {
      setBarcode('');
      setScanError(null);
    }
  };

  // Cleanup the debounce timer on unmount.
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, []);

  // ============================================
  // ACTION HANDLERS
  // ============================================

  const handleViewItem = () => {
    if (lastScanned) router.push(`/admin/inventory/${lastScanned.id}`);
  };

  const handleEditItem = () => {
    if (lastScanned)
      router.push(`/admin/inventory/${lastScanned.id}/edit`);
  };

  const handleAdjustItem = () => {
    if (lastScanned)
      router.push(`/admin/inventory/${lastScanned.id}/edit?action=adjust`);
  };

  const handlePrintBarcode = () => {
    if (lastScanned)
      router.push(`/admin/inventory/${lastScanned.id}/barcode`);
  };

  const handleViewItemById = (id: string) => {
    router.push(`/admin/inventory/${id}`);
  };

  const handleRescan = (code: string) => {
    setBarcode(code);
    handleScan(code);
  };

  const clearHistory = () => {
    setHistory([]);
    toast.success('History cleared');
  };

  // ============================================
  // PERMISSION GATE
  // ============================================

  if (permissionsLoading) {
    return (
      <div
        className={`flex flex-col items-center justify-center min-h-[40vh] ${className}`}
      >
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Checking permissions…
        </p>
      </div>
    );
  }

  if (!canViewInventory()) {
    return (
      <div
        className={`flex flex-col items-center justify-center min-h-[40vh] p-8 ${className}`}
      >
        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md text-sm">
          You don't have permission to scan inventory.
        </p>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className={`space-y-6 ${className}`}>
      {!businessUnitId && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800 dark:text-yellow-200">
            <p className="font-medium">No business unit selected</p>
            <p className="mt-1">
              Go to the inventory dashboard and pick a business unit before
              scanning.
            </p>
          </div>
        </div>
      )}

      {/* Scan input */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={barcode}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Scan barcode or type SKU…"
              disabled={scanning || !businessUnitId}
              className="w-full pl-12 pr-12 py-4 text-lg bg-gray-50 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-50"
              autoComplete="off"
              autoFocus
              spellCheck={false}
            />
            {scanning && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              </div>
            )}
          </div>

          <p className="mt-2 text-xs text-center text-gray-400 dark:text-gray-500">
            Hardware scanners work automatically. Press Enter to submit
            manually. Press Escape to clear.
          </p>
        </div>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {scanError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3"
          >
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                {scanError}
              </p>
            </div>
            <button
              onClick={() => setScanError(null)}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-800/50 rounded transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4 text-red-600 dark:text-red-400" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result card */}
      <AnimatePresence mode="wait">
        {lastScanned && (
          <motion.div
            key={lastScanned.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {/* Result header */}
            <div className="bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800 px-6 py-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="font-medium text-green-800 dark:text-green-200">
                Item found
              </span>
            </div>

            <div className="p-6">
              <div className="flex flex-col sm:flex-row gap-6">
                {/* Image */}
                <div className="w-full sm:w-32 h-32 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                  {lastScanned.images && lastScanned.images.length > 0 ? (
                    <img
                      src={lastScanned.images[0]}
                      alt={lastScanned.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-12 h-12 text-gray-400" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 space-y-3">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {lastScanned.name}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      SKU: {lastScanned.sku}
                      {lastScanned.barcode && (
                        <> · Barcode: {lastScanned.barcode}</>
                      )}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">
                        Stock
                      </p>
                      <p
                        className={`font-bold text-lg ${
                          lastScanned.stock === 0
                            ? 'text-red-600 dark:text-red-400'
                            : lastScanned.stock <=
                              (lastScanned.reorderPoint ?? 5)
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-green-600 dark:text-green-400'
                        }`}
                      >
                        {lastScanned.stock}
                      </p>
                      <p className="text-xs text-gray-400">
                        {lastScanned.reserved > 0
                          ? `${lastScanned.available} available`
                          : 'all available'}
                      </p>
                    </div>

                    <div>
                      <p className="text-gray-500 dark:text-gray-400">
                        Price
                      </p>
                      <p className="font-bold text-lg text-gray-900 dark:text-white">
                        {formatCurrency(lastScanned.price)}
                      </p>
                    </div>

                    <div>
                      <p className="text-gray-500 dark:text-gray-400">
                        Category
                      </p>
                      <p className="text-gray-900 dark:text-white truncate">
                        {lastScanned.category || '—'}
                      </p>
                    </div>

                    <div>
                      <p className="text-gray-500 dark:text-gray-400">
                        Location
                      </p>
                      <p className="text-gray-900 dark:text-white truncate">
                        {lastScanned.location || '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {!hideDefaultActions && (
                <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleViewItem}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                  <button
                    onClick={handleEditItem}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors text-sm"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  {canAdjustInventory() && (
                    <button
                      onClick={handleAdjustItem}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-2 transition-colors text-sm"
                    >
                      <RefreshCcw className="w-4 h-4" />
                      Adjust Stock
                    </button>
                  )}
                  {lastScanned.barcode && (
                    <button
                      onClick={handlePrintBarcode}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors text-sm"
                    >
                      <Barcode className="w-4 h-4" />
                      Print Barcode
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scan history */}
      {!hideHistory && history.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <h3 className="font-medium text-gray-900 dark:text-white">
                Scan History
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({history.length})
              </span>
            </div>
            <button
              onClick={clearHistory}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="px-6 py-3 flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {entry.success ? (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {entry.item?.name || entry.code}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {entry.success ? (
                        <>
                          {entry.code} · Stock: {entry.item?.stock}
                        </>
                      ) : (
                        entry.message || 'Not found'
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-gray-400">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  {entry.item && (
                    <button
                      onClick={() => handleViewItemById(entry.item!.id)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      title="View item"
                    >
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                  <button
                    onClick={() => handleRescan(entry.code)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                    title="Rescan"
                  >
                    <RefreshCw className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hideHistory && history.length === 0 && !lastScanned && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Scan className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Ready to scan
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
            Use a barcode scanner or type a SKU into the field above. Scanned
            items will appear here with their stock information.
          </p>
        </div>
      )}
    </div>
  );
}

export default InventoryScan;
