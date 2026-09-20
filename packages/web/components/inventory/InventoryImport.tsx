'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, FileSpreadsheet, X, Check, AlertCircle, Loader2,
  Download, FileText, File, FileUp, Table,
} from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { toast } from '../../utils/toast-manager';

interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
  warnings?: Array<{ row: number; message: string }>;
}

export function InventoryImport() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importOptions, setImportOptions] = useState({
    updateExisting: true,
    skipDuplicates: false,
    validateOnly: false,
  });

  const handleFileChange = (selectedFile: File) => {
    setFile(selectedFile);
    setResult(null);
    setPreviewData([]);
    setShowPreview(false);

    if (selectedFile) {
      previewFile(selectedFile);
    }
  };

  const previewFile = async (selectedFile: File) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n');
          const headers = lines[0]?.split(',').map((h) => h.trim()) || [];
          const data = lines.slice(1, 11).map((line) => {
            const values = line.split(',').map((v) => v.trim());
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => {
              obj[h] = values[i] || '';
            });
            return obj;
          });
          setPreviewData(data);
          setShowPreview(true);
        } catch (error) {
          console.error('Failed to preview file:', error);
        }
      };
      reader.readAsText(selectedFile);
    } catch (error) {
      console.error('Failed to preview file:', error);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n');
          const headers = lines[0]?.split(',').map((h) => h.trim()) || [];

          const items = lines
            .slice(1)
            .filter((line) => line.trim())
            .map((line) => {
              const values = line.split(',').map((v) => v.trim());
              const obj: Record<string, any> = {};
              headers.forEach((h, i) => {
                if (
                  h === 'quantity' ||
                  h === 'price' ||
                  h === 'reorderPoint'
                ) {
                  obj[h] = parseFloat(values[i]) || 0;
                } else {
                  obj[h] = values[i] || '';
                }
              });
              return {
                name: obj.name || '',
                sku:
                  obj.sku ||
                  `SKU-${Date.now()}-${Math.random()
                    .toString(36)
                    .substr(2, 5)}`,
                quantity: obj.quantity || 0,
                unitPrice: obj.price || 0,
                category: obj.category || '',
                location: obj.location || 'Warehouse',
                supplier: obj.supplier || '',
                minStock: obj.reorderPoint || 5,
                notes: obj.notes || '',
              };
            });

          const results = [];
          const errors = [];

          for (let i = 0; i < items.length; i++) {
            try {
              const item = items[i];
              if (!item.name) {
                errors.push({ row: i + 2, message: 'Name is required' });
                continue;
              }
              const result = await inventoryService.createItem({
                name: item.name,
                sku: item.sku,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                minStock: item.minStock,
                category: item.category,
                location: item.location,
                supplier: item.supplier,
                notes: item.notes,
              });
              results.push(result);
            } catch (error: any) {
              errors.push({
                row: i + 2,
                message:
                  error?.response?.data?.message ||
                  error?.message ||
                  'Import failed',
              });
            }
          }

          const importResult: ImportResult = {
            success: errors.length < items.length,
            total: items.length,
            imported: results.length,
            failed: errors.length,
            errors: errors,
          };

          setResult(importResult);

          if (importResult.imported > 0) {
            toast.success(
              `Imported ${importResult.imported} items successfully`
            );
          }
          if (importResult.failed > 0) {
            toast.warning(`${importResult.failed} items failed to import`);
          }
          if (importResult.imported === 0 && importResult.failed > 0) {
            toast.error('Import failed - no items were imported');
          }
        } catch (error: any) {
          console.error('Import error:', error);
          toast.error(error?.message || 'Failed to import inventory');
          setResult({
            success: false,
            total: 0,
            imported: 0,
            failed: 1,
            errors: [{ row: 0, message: error?.message || 'Import failed' }],
          });
        } finally {
          setLoading(false);
        }
      };
      reader.readAsText(file);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to import inventory');
      setResult({
        success: false,
        total: 0,
        imported: 0,
        failed: 1,
        errors: [{ row: 0, message: error?.message || 'Import failed' }],
      });
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const headers = [
        'name',
        'sku',
        'quantity',
        'price',
        'category',
        'location',
        'supplier',
        'reorderPoint',
        'notes',
      ];
      const sampleRow = [
        'Sample Product',
        'SKU001',
        '10',
        '99.99',
        'Electronics',
        'Warehouse',
        'Supplier A',
        '5',
        'Sample notes',
      ];

      const csvContent = [
        headers.join(','),
        sampleRow.join(','),
        ',,,',
        ',,,',
        'Required columns: name, quantity, price',
        'Optional: sku, category, location, supplier, reorderPoint, notes',
        'Note: SKU will be auto-generated if not provided',
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'inventory_import_template.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded successfully');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="card-brand !p-0 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Import Inventory
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Upload a CSV or Excel file to bulk import inventory items
              </p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="btn-secondary focus-ring"
            >
              <Download className="w-4 h-4" />
              Template
            </button>
          </div>
        </div>

        <div className="p-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                : file
                ? 'border-success-500 bg-success-50 dark:bg-success-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-10 h-10 text-success-500" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {file.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="p-1 hover:bg-orange-50 dark:hover:bg-gray-700 rounded focus-ring"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                {showPreview && previewData.length > 0 && (
                  <div className="w-full mt-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-left mb-2 tabular-nums">
                      Preview (first {previewData.length} rows):
                    </p>
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="min-w-full text-sm border border-gray-200 dark:border-gray-600">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                          <tr>
                            {Object.keys(previewData[0] || {}).map((key) => (
                              <th
                                key={key}
                                className="px-3 py-1 text-left text-2xs font-medium text-gray-500 dark:text-gray-400"
                              >
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.map((row, idx) => (
                            <tr
                              key={idx}
                              className="border-t border-gray-100 dark:border-gray-700"
                            >
                              {Object.values(row).map((val: any, i) => (
                                <td
                                  key={i}
                                  className="px-3 py-1 text-gray-700 dark:text-gray-300 max-w-xs truncate tabular-nums"
                                >
                                  {val || '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  Drag and drop your file here, or{' '}
                  <label className="text-brand-600 hover:text-brand-700 dark:text-brand-400 cursor-pointer focus-ring rounded">
                    browse
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleFileChange(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Supported formats: CSV, Excel (.xlsx, .xls)
                </p>
                <div className="flex items-center gap-4 mt-3 text-2xs text-gray-400">
                  <span>Required columns: name, quantity, price</span>
                  <span>|</span>
                  <span>
                    Optional: sku, category, location, supplier, reorderPoint
                  </span>
                </div>
              </>
            )}
          </div>

          {file && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Import Options
              </h4>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={importOptions.updateExisting}
                    onChange={(e) =>
                      setImportOptions({
                        ...importOptions,
                        updateExisting: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 focus:outline-none"
                  />
                  Update existing items
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={importOptions.skipDuplicates}
                    onChange={(e) =>
                      setImportOptions({
                        ...importOptions,
                        skipDuplicates: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 focus:outline-none"
                  />
                  Skip duplicates
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={importOptions.validateOnly}
                    onChange={(e) =>
                      setImportOptions({
                        ...importOptions,
                        validateOnly: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 focus:outline-none"
                  />
                  Validate only (dry run)
                </label>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {file && <span>Ready to import: {file.name}</span>}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setPreviewData([]);
                  setShowPreview(false);
                }}
                className="btn-secondary focus-ring"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!file || loading}
                className="px-6 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg disabled:opacity-50 flex items-center gap-2 transition-all focus-ring"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {loading
                  ? 'Importing...'
                  : importOptions.validateOnly
                  ? 'Validate'
                  : 'Import'}
              </button>
            </div>
          </div>

          {result && (
            <div
              className={`mt-6 p-4 rounded-lg ${
                result.success
                  ? 'bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800'
                  : 'bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800'
              }`}
            >
              <div className="flex items-center gap-3">
                {result.success ? (
                  <Check className="w-5 h-5 text-success-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-danger-500" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {result.success ? 'Import completed' : 'Import failed'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                    {result.imported} imported, {result.failed} failed out of{' '}
                    {result.total} total
                  </p>
                </div>
                <button
                  onClick={() => setResult(null)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded focus-ring"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {result.errors.length > 0 && (
                <div className="mt-3 max-h-40 overflow-y-auto custom-scrollbar">
                  <p className="text-sm font-medium text-danger-600 dark:text-danger-400">
                    Errors:
                  </p>
                  {result.errors.map((err, idx) => (
                    <p
                      key={idx}
                      className="text-sm text-danger-600 dark:text-danger-400 tabular-nums"
                    >
                      Row {err.row}: {err.message}
                    </p>
                  ))}
                </div>
              )}

              {result.warnings && result.warnings.length > 0 && (
                <div className="mt-3 max-h-40 overflow-y-auto custom-scrollbar">
                  <p className="text-sm font-medium text-warning-600 dark:text-warning-400">
                    Warnings:
                  </p>
                  {result.warnings.map((warn, idx) => (
                    <p
                      key={idx}
                      className="text-sm text-warning-600 dark:text-warning-400 tabular-nums"
                    >
                      Row {warn.row}: {warn.message}
                    </p>
                  ))}
                </div>
              )}

              {result.success && (
                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white dark:bg-gray-800 p-2 rounded border border-success-200 dark:border-success-800">
                    <p className="text-2xs text-gray-500 dark:text-gray-400">
                      Total
                    </p>
                    <p className="text-lg font-bold text-gray-700 dark:text-gray-300 tabular-nums">
                      {result.total}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-2 rounded border border-success-200 dark:border-success-800">
                    <p className="text-2xs text-gray-500 dark:text-gray-400">
                      Imported
                    </p>
                    <p className="text-lg font-bold text-success-600 dark:text-success-400 tabular-nums">
                      {result.imported}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-2 rounded border border-danger-200 dark:border-danger-800">
                    <p className="text-2xs text-gray-500 dark:text-gray-400">
                      Failed
                    </p>
                    <p className="text-lg font-bold text-danger-600 dark:text-danger-400 tabular-nums">
                      {result.failed}
                    </p>
                  </div>
                </div>
              )}

              {result.success && result.imported > 0 && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => router.push('/inventory')}
                    className="text-sm text-brand-600 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300 focus-ring rounded"
                  >
                    View inventory →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Need help?
        </h4>
        <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
          <li>• Download the template to see the required format</li>
          <li>
            • Required columns:{' '}
            <span className="font-mono">name</span>,{' '}
            <span className="font-mono">quantity</span>,{' '}
            <span className="font-mono">price</span>
          </li>
          <li>
            • Optional columns: <span className="font-mono">sku</span>,{' '}
            <span className="font-mono">category</span>,{' '}
            <span className="font-mono">location</span>,{' '}
            <span className="font-mono">supplier</span>,{' '}
            <span className="font-mono">reorderPoint</span>
          </li>
          <li>• SKU will be auto-generated if not provided</li>
          <li>• Maximum file size: 5MB</li>
          <li>• Maximum rows: 1000 per import</li>
        </ul>
      </div>
    </div>
  );
}

export default InventoryImport;
