'use client';

// D:\Projects\Kalwanga\packages\web\components\products\ProductImportExport.tsx

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  Download,
  FileSpreadsheet,
  X,
  Check,
  AlertCircle,
  Loader2,
  FileText,
  Info,
} from 'lucide-react';
import { productService } from '../../services/productService';
import { toast } from '../../utils/toast-manager';
import { usePermission } from '../../hooks/usePermission';
import { PermissionResource } from '../../types/enums';

// ============================================
// BACKEND CONTRACT
// ============================================
//
// Export  — GET /products/export
//   Query: ?format=csv | anything-else
//   - `csv`  → raw text/csv response. Fixed columns:
//              ID, Name, SKU, Barcode, Unit Price, Cost Price,
//              Category, Supplier, Stock, Variants, Status, Created At.
//   - Any other format value → JSON body
//              { success, data, total, exportedAt }.
//   No other query params are read. Include-flags, category filters,
//   etc. are silently ignored by the controller.
//
// Import  — POST /products/import
//   Body: multipart/form-data with a `file` field.
//   Current response (controller returns this unconditionally):
//     { success: true, message, data: { businessUnitId, userId,
//                                       imported: 0, failed: 0, total: 0 } }
//   Server-side CSV/Excel parsing is not yet implemented — no rows are
//   read and no products are created.
//
// Template — GET /products/import/template
//   Returns a CSV with these headers only:
//     Name, SKU, Barcode, Description, Unit Price, Cost Price,
//     Category, Supplier, Min Stock, Max Stock, Weight (kg),
//     Tax Rate (%), Status (Active/Inactive), Digital (Yes/No),
//     Featured (Yes/No), Tags (comma separated)

// ============================================
// TYPES
// ============================================

type ExportFormat = 'csv' | 'json';

interface ImportResponseData {
  businessUnitId?: string;
  userId?: string;
  imported: number;
  failed: number;
  total: number;
}

interface ImportResult {
  success: boolean;
  message?: string;
  data?: ImportResponseData;
}

// ============================================
// CONSTANTS
// ============================================

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ACCEPTED_EXTENSIONS = ['.csv'];
const ACCEPTED_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel', // legacy CSV mime used by some browsers
  'text/plain', // some browsers report CSV as text/plain
]);

const EXPORT_FORMATS: ExportFormat[] = ['csv', 'json'];

const EXPORT_COLUMNS_HELP =
  'CSV includes: ID, Name, SKU, Barcode, Unit Price, Cost Price, ' +
  'Category, Supplier, Stock, Variants, Status, Created At.';

// ============================================
// FILE VALIDATION
// ============================================

/**
 * Accept `.csv` by extension OR by MIME type. Some OSes (Windows) don't
 * set the MIME for `.csv` at all, so extension-based acceptance is
 * required. Reject everything else, including `.xlsx` — the backend
 * doesn't parse Excel.
 */
function isAcceptableFile(file: File): { ok: true } | { ok: false; reason: string } {
  const name = file.name.toLowerCase();

  const hasValidExtension = ACCEPTED_EXTENSIONS.some((ext) =>
    name.endsWith(ext),
  );

  const mime = (file.type || '').toLowerCase();
  const hasValidMime =
    mime === '' || // no MIME set — fall through to extension check
    ACCEPTED_MIME_TYPES.has(mime) ||
    mime.startsWith('text/');

  // Require the extension. A file named `data.txt` with `text/plain`
  // MIME would otherwise sneak through.
  if (!hasValidExtension) {
    return {
      ok: false,
      reason: `"${file.name}" is not a CSV file. Only .csv files are accepted.`,
    };
  }

  if (!hasValidMime && mime !== '') {
    return {
      ok: false,
      reason: `"${file.name}" has an unsupported file type (${mime}).`,
    };
  }

  if (file.size === 0) {
    return { ok: false, reason: `"${file.name}" is empty.` };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      reason: `"${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB limit (${(
        file.size /
        1024 /
        1024
      ).toFixed(1)}MB).`,
    };
  }

  return { ok: true };
}

// ============================================
// COMPONENT
// ============================================

export function ProductImportExport() {
  const { canView, canManage } = usePermission();
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [exporting, setExporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // Route gates:
  //   POST /products/import  → requireInventoryPermission('inventory:create')
  //   GET  /products/export  → requireInventoryPermission('inventory:view')
  //   GET  /products/import/template → requireInventoryPermission('inventory:view')
  // We approximate those with PRODUCT resource permissions.
  const canImportProducts = canManage(PermissionResource.PRODUCT);
  const canExportProducts =
    canView(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);

  // ============================================
  // FILE SELECTION
  // ============================================

  const handleFileChange = useCallback((selectedFile: File) => {
    const check = isAcceptableFile(selectedFile);
    if (!check.ok) {
      toast.error(check.reason);
      return;
    }
    setFile(selectedFile);
    setResult(null);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const dropped = e.dataTransfer.files?.[0];
      if (!dropped) return;

      const check = isAcceptableFile(dropped);
      if (!check.ok) {
        toast.error(check.reason);
        return;
      }

      handleFileChange(dropped);
    },
    [handleFileChange],
  );

  const resetFile = useCallback(() => {
    setFile(null);
    setResult(null);
  }, []);

  // ============================================
  // IMPORT
  // ============================================

  const handleImport = useCallback(async () => {
    if (!file) return;

    setLoading(true);
    try {
      // The frontend service returns whatever the backend responds with.
      // Today that is a zeroed placeholder — the server does not yet
      // parse the file. When the backend starts populating these fields,
      // no change is needed here.
      const response: any = await productService.importProducts(file);

      // Handle both shapes the backend might return:
      //   { success, message, data: {...} }   ← current
      //   { imported, failed, total }         ← hypothetical future
      const payload = response?.data ?? response ?? {};
      const normalizedData: ImportResponseData = {
        businessUnitId: payload.businessUnitId,
        userId: payload.userId,
        imported: Number(payload.imported) || 0,
        failed: Number(payload.failed) || 0,
        total: Number(payload.total) || 0,
      };

      const success = response?.success !== false;

      setResult({
        success,
        message: response?.message,
        data: normalizedData,
      });

      if (!success) {
        toast.error(response?.message || 'Import failed');
      } else if (normalizedData.imported > 0) {
        toast.success(
          `Imported ${normalizedData.imported} product${
            normalizedData.imported === 1 ? '' : 's'
          }`,
        );
        // Clear the file so the user doesn't accidentally re-import.
        setFile(null);
      } else if (normalizedData.failed > 0) {
        toast.warning(
          `${normalizedData.failed} product${
            normalizedData.failed === 1 ? '' : 's'
          } failed to import`,
        );
        // Keep the file so the user can retry.
      } else {
        // Backend acknowledged but didn't parse anything. The yellow
        // banner above the drop zone tells the user why. We clear the
        // file because re-uploading the same payload is a no-op.
        toast.info(
          'Import acknowledged. No products were created (backend parsing pending).',
        );
        setFile(null);
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to import products';
      toast.error(message);
      setResult({
        success: false,
        message,
        data: { imported: 0, failed: 1, total: 1 },
      });
    } finally {
      setLoading(false);
    }
  }, [file]);

  // ============================================
  // EXPORT
  // ============================================

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      // Pass the chosen format through unchanged. `csv` produces a raw
      // CSV file; anything else is JSON.
      const blob = await productService.exportProducts(
        exportFormat as any,
      );

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
      const filename = `products_${timestamp}.${exportFormat}`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(
        `Products exported as ${exportFormat.toUpperCase()}`,
      );
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to export products');
    } finally {
      setExporting(false);
    }
  }, [exportFormat]);

  // ============================================
  // TEMPLATE
  // ============================================

  const handleDownloadTemplate = useCallback(async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await productService.downloadImportTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'product_import_template.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded successfully');
    } catch (err) {
      console.error('Template download failed:', err);
      toast.error('Failed to download template');
    } finally {
      setDownloadingTemplate(false);
    }
  }, []);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="card-brand shadow-soft overflow-hidden p-0 animate-fade-in">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setActiveTab('import')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition duration-250 focus-ring ${
            activeTab === 'import'
              ? 'border-b-2 border-brand-600 text-brand-600 dark:text-brand-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Upload className="w-4 h-4" />
          Import
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('export')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition duration-250 focus-ring ${
            activeTab === 'export'
              ? 'border-b-2 border-brand-600 text-brand-600 dark:text-brand-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      <div className="p-6">
        {/* ==================== IMPORT TAB ==================== */}
        {activeTab === 'import' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Import Products
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Bulk import products from a CSV file
              </p>
            </div>

            {/* Not-yet-implemented banner */}
            <div className="flex items-start gap-2 p-3 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-xl animate-slide-down">
              <Info className="w-4 h-4 text-warning-600 dark:text-warning-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-warning-800 dark:text-warning-300">
                Server-side import is not yet implemented. Uploads are
                accepted and acknowledged but no products will be
                created. Use the template to prepare your data for when
                the endpoint is live.
              </p>
            </div>

            {/* Template Download */}
            <div className="flex flex-wrap items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
              <FileText className="w-5 h-5 text-brand-500 dark:text-brand-400" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Need a template?
              </span>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate || !canExportProducts}
                className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition duration-250 focus-ring rounded"
                title={
                  canExportProducts
                    ? undefined
                    : "You don't have permission to download the template"
                }
              >
                {downloadingTemplate ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {downloadingTemplate
                  ? 'Downloading...'
                  : 'Download CSV Template'}
              </button>
            </div>

            {/* File Drop Area */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition duration-250 ${
                dragActive
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                  : file
                  ? 'border-success-500 bg-success-50 dark:bg-success-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet className="w-10 h-10 text-success-500" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900 dark:text-white break-all">
                      {file.name}
                    </p>
                    <p className="text-sm tabular-nums text-gray-500 dark:text-gray-400">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetFile}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition duration-250 focus-ring"
                    aria-label="Remove file"
                  >
                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    Drag and drop your file here, or{' '}
                    <label className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 cursor-pointer transition duration-250 focus-ring rounded">
                      browse
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFileChange(f);
                          // Reset so selecting the same file twice fires
                          // change again.
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                    Supported format: CSV
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Max {MAX_FILE_SIZE_MB}MB per file
                  </p>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={resetFile}
                disabled={!file}
                className="btn-secondary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={!file || loading || !canImportProducts}
                className="btn-brand disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  canImportProducts
                    ? undefined
                    : "You don't have permission to import products"
                }
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {loading ? 'Importing...' : 'Import'}
              </button>
            </div>

            {/* Results */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl ${
                  result.success
                    ? 'bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800'
                    : 'bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.success ? (
                    <Check className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {result.success
                        ? 'Import acknowledged'
                        : 'Import failed'}
                    </p>
                    {result.message && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 break-words">
                        {result.message}
                      </p>
                    )}
                    {result.data && (
                      <p className="text-sm tabular-nums text-gray-600 dark:text-gray-300 mt-1">
                        {result.data.imported} imported,{' '}
                        {result.data.failed} failed out of{' '}
                        {result.data.total} total
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setResult(null)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition duration-250 focus-ring"
                    aria-label="Dismiss result"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* ==================== EXPORT TAB ==================== */}
        {activeTab === 'export' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Export Products
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Export your products to CSV or JSON
              </p>
            </div>

            {/* Export Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Export Format
              </label>
              <div className="flex flex-wrap gap-2">
                {EXPORT_FORMATS.map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => setExportFormat(format)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition duration-250 focus-ring ${
                      exportFormat === format
                        ? 'bg-brand-gradient text-white shadow-brand'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {exportFormat === 'csv'
                  ? EXPORT_COLUMNS_HELP
                  : 'JSON returns { success, data: [...], total, exportedAt }.'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || !canExportProducts}
                className="btn-brand disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  canExportProducts
                    ? undefined
                    : "You don't have permission to export products"
                }
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {exporting ? 'Exporting...' : 'Export Products'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductImportExport;
