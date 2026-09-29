// components/barcode/BarcodeDisplayWithInventory.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  QrCode,
  Barcode,
  Copy,
  Check,
  Download,
  Printer,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

import { barcodeService } from '../../services/barcodeService';
import type { BarcodeInfo } from '../../services/barcodeService';
import { inventoryService } from '../../services/inventoryService';
import { toast } from '../../utils/toast-manager';

// ============================================
// TYPES
// ============================================

interface BarcodeDisplayWithInventoryProps {
  productId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  /**
   * Business unit for the inventory lookup. Optional — when omitted,
   * the `api` client uses the one in localStorage.
   */
  businessUnitId?: string;
  onBarcodeGenerated?: (barcode: string) => void;
}

/**
 * The subset of the inventory row this component renders. Matches
 * the shape `barcodeService.scanBarcode` returns, so the two data
 * paths can't drift.
 */
interface InventorySummary {
  quantity: number;
  minStock?: number;
  maxStock?: number | null;
  location?: string | null;
}

// ============================================
// HELPERS
// ============================================

/**
 * Escape a value before it's interpolated into the print window's
 * `document.write` HTML. Product names come from the DB and could
 * contain markup; the print window treats its argument as HTML, so
 * an unescaped `<script>` would execute.
 */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

// ============================================
// COMPONENT
// ============================================

export function BarcodeDisplayWithInventory({
  productId,
  productName,
  sku,
  unitPrice,
  businessUnitId,
  onBarcodeGenerated,
}: BarcodeDisplayWithInventoryProps) {
  const [barcodeData, setBarcodeData] = useState<BarcodeInfo | null>(null);
  const [inventory, setInventory] = useState<InventorySummary | null>(null);

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /**
   * Guards against React 18 StrictMode's double-invoke in dev, and
   * against a stale fetch resolving after the component has
   * unmounted or after `productId` has changed.
   */
  const fetchRequestId = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ============================================
  // LOAD
  // ============================================

  /**
   * Fetch the barcode info and the inventory row in parallel.
   *
   * `barcodeService.getProductBarcodeInfo` is the endpoint that
   * returns `{ barcode, barcodeUrl, qrCodeUrl, … }`. The sibling
   * `getBarcodeByProduct` returns only `{ barcode, productId }` and
   * would leave the images undefined.
   */
  const loadBarcodeAndInventory = useCallback(async () => {
    const requestId = ++fetchRequestId.current;
    setLoading(true);
    setError(null);

    try {
      // `getProductBarcodeInfo` generates on read when the product
      // has no barcode yet, so a fresh product is covered.
      const info = await barcodeService.getProductBarcodeInfo(productId);

      // Inventory is a separate resource. Wrap it in its own
      // try/catch: a missing inventory row should not blank out the
      // barcode panel.
      let inv: InventorySummary | null = null;
      try {
        const invRaw = await inventoryService.getInventoryByProduct(
          productId,
          businessUnitId,
        );
        if (invRaw) {
          inv = {
            quantity: Number(invRaw.quantity ?? 0),
            minStock:
              typeof invRaw.reorderPoint === 'number'
                ? invRaw.reorderPoint
                : typeof invRaw.minStock === 'number'
                ? invRaw.minStock
                : undefined,
            maxStock:
              typeof invRaw.maxStock === 'number'
                ? invRaw.maxStock
                : null,
            location:
              typeof invRaw.location === 'string'
                ? invRaw.location
                : null,
          };
        }
      } catch (invErr) {
        // Non-fatal. Log so it's visible in the console, but don't
        // surface a toast — the operator can still see and print
        // the barcode.
        console.warn(
          '[BarcodeDisplay] inventory lookup failed:',
          extractErrorMessage(invErr, 'unknown'),
        );
      }

      // Drop stale responses.
      if (requestId !== fetchRequestId.current) return;
      if (!mountedRef.current) return;

      setBarcodeData(info);
      setInventory(inv);
    } catch (err) {
      if (requestId !== fetchRequestId.current) return;
      if (!mountedRef.current) return;

      const message = extractErrorMessage(err, 'Failed to load barcode');
      console.error('[BarcodeDisplay] load failed:', message);
      setError(message);
    } finally {
      if (requestId === fetchRequestId.current && mountedRef.current) {
        setLoading(false);
      }
    }
  }, [productId, businessUnitId]);

  useEffect(() => {
    if (!productId) return;
    void loadBarcodeAndInventory();
  }, [productId, loadBarcodeAndInventory]);

  // ============================================
  // GENERATE
  // ============================================

  /**
   * Force-generate (or re-generate) the product's barcode, then
   * re-fetch the info so the response carries the `barcodeUrl` /
   * `qrCodeUrl` the panel needs.
   *
   * `barcodeService.generateBarcode` returns only `{ barcode,
   * productId }` — using its return value directly would leave the
   * images undefined.
   */
  const handleGenerateBarcode = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    setError(null);

    try {
      const result = await barcodeService.generateBarcode(productId);

      // Re-fetch the info so we get the images alongside the code.
      const info = await barcodeService.getProductBarcodeInfo(productId);

      if (!mountedRef.current) return;

      setBarcodeData(info);
      onBarcodeGenerated?.(result.barcode);
      toast.success('Barcode generated');
    } catch (err) {
      if (!mountedRef.current) return;

      const message = extractErrorMessage(err, 'Failed to generate barcode');
      console.error('[BarcodeDisplay] generate failed:', message);
      setError(message);
      toast.error(message);
    } finally {
      if (mountedRef.current) setGenerating(false);
    }
  }, [productId, generating, onBarcodeGenerated]);

  // ============================================
  // COPY
  // ============================================

  const handleCopyBarcode = useCallback(async () => {
    if (!barcodeData?.barcode) return;

    try {
      await navigator.clipboard.writeText(barcodeData.barcode);
      setCopied(true);
      setTimeout(() => {
        if (mountedRef.current) setCopied(false);
      }, 2000);
      toast.success('Barcode copied');
    } catch (err) {
      console.error('[BarcodeDisplay] copy failed:', err);
      toast.error('Failed to copy barcode');
    }
  }, [barcodeData?.barcode]);

  // ============================================
  // PRINT
  // ============================================

  /**
   * Open a print-ready window with the barcode, QR, and a few
   * identifying fields.
   *
   * Every interpolated value goes through `escapeHtml` — the print
   * window's `document.write` treats its argument as HTML, so an
   * unescaped product name containing `<script>` would execute.
   */
  const handlePrint = useCallback(() => {
    if (!barcodeData) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked — allow pop-ups to print');
      return;
    }

    const safeName = escapeHtml(productName);
    const safeSku = escapeHtml(sku);
    const safeBarcode = escapeHtml(barcodeData.barcode);
    const safePrice = escapeHtml(unitPrice.toFixed(2));
    const safeQuantity = escapeHtml(inventory?.quantity ?? 0);
    const safeBarcodeUrl = escapeHtml(barcodeData.barcodeUrl);
    const safeQrUrl = barcodeData.qrCodeUrl
      ? escapeHtml(barcodeData.qrCodeUrl)
      : '';

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Barcode - ${safeName}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
            }
            .container { text-align: center; }
            .barcode-img { max-width: 300px; }
            .qr-img { max-width: 150px; margin-top: 10px; }
            .info { margin-top: 20px; }
            .info p { margin: 5px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>${safeName}</h2>
            <img src="${safeBarcodeUrl}" alt="Barcode" class="barcode-img" />
            ${
              safeQrUrl
                ? `<img src="${safeQrUrl}" alt="QR Code" class="qr-img" />`
                : ''
            }
            <div class="info">
              <p><strong>SKU:</strong> ${safeSku}</p>
              <p><strong>Barcode:</strong> ${safeBarcode}</p>
              <p><strong>Price:</strong> $${safePrice}</p>
              <p><strong>In Stock:</strong> ${safeQuantity}</p>
            </div>
          </div>
          <script>
            window.onload = function () { window.print(); };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [barcodeData, productName, sku, unitPrice, inventory?.quantity]);

  // ============================================
  // RENDER
  // ============================================

  // The card stays mounted while `loading` — only the barcode area
  // shows a skeleton. The Generate button stays clickable (and
  // shows a spinner while `generating`).
  const showBarcodeSkeleton = loading && !barcodeData;

  return (
    <div className="card-brand !p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Product Identification
        </h3>
        <button
          type="button"
          onClick={handleGenerateBarcode}
          disabled={generating || loading}
          className="px-3 py-1 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg text-sm flex items-center gap-1 transition-all focus-ring disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`}
          />
          {generating ? 'Generating…' : 'Generate'}
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-300">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {showBarcodeSkeleton ? (
        <div className="space-y-3">
          <div className="h-12 w-48 mx-auto rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
          <div className="h-4 w-32 mx-auto rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
        </div>
      ) : barcodeData ? (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            {/* Barcode */}
            <div className="text-center">
              <p className="text-2xs text-gray-500 dark:text-gray-400 mb-1">
                Barcode
              </p>
              {barcodeData.barcodeUrl ? (
                <img
                  src={barcodeData.barcodeUrl}
                  alt={`Barcode for ${productName}`}
                  className="h-12 w-auto"
                />
              ) : (
                <div className="h-12 flex items-center justify-center text-gray-400 text-xs">
                  No barcode image
                </div>
              )}
              <div className="flex items-center gap-2 justify-center mt-1">
                <code className="text-2xs font-mono text-gray-600 dark:text-gray-400 tabular-nums">
                  {barcodeData.barcode}
                </code>
                <button
                  type="button"
                  onClick={handleCopyBarcode}
                  className="p-1 hover:bg-orange-50 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                  aria-label="Copy barcode"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-success-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>

            {/* QR Code */}
            {barcodeData.qrCodeUrl && (
              <div className="text-center">
                <p className="text-2xs text-gray-500 dark:text-gray-400 mb-1">
                  QR Code
                </p>
                <img
                  src={barcodeData.qrCodeUrl}
                  alt={`QR code for ${productName}`}
                  className="w-16 h-16 object-contain"
                />
              </div>
            )}
          </div>

          {/* Inventory Information */}
          {inventory && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
              <div>
                <p className="text-2xs text-gray-500 dark:text-gray-400">
                  Quantity
                </p>
                <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                  {inventory.quantity}
                </p>
              </div>
              <div>
                <p className="text-2xs text-gray-500 dark:text-gray-400">
                  Min Stock
                </p>
                <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                  {inventory.minStock ?? 5}
                </p>
              </div>
              <div>
                <p className="text-2xs text-gray-500 dark:text-gray-400">
                  Max Stock
                </p>
                <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                  {inventory.maxStock ?? 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-2xs text-gray-500 dark:text-gray-400">
                  Location
                </p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {inventory.location || 'Default'}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() =>
                window.open(barcodeData.barcodeUrl, '_blank', 'noopener')
              }
              className="btn-secondary focus-ring text-sm"
              disabled={!barcodeData.barcodeUrl}
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="btn-secondary focus-ring text-sm"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <Barcode className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400">
            No barcode generated yet
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Generate a barcode for this product
          </p>
        </div>
      )}
    </div>
  );
}

export default BarcodeDisplayWithInventory;
