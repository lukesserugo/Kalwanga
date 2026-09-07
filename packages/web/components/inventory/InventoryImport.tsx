// D:\Projects\Kalwanga\packages\web\components\inventory\InventoryImport.tsx
'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, FileSpreadsheet, X, Check, AlertCircle, Loader2,
  Download, FileText, File, FileUp, Table
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
    
    // Preview the file
    if (selectedFile) {
      previewFile(selectedFile);
    }
  };

  const previewFile = async (selectedFile: File) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          // Parse CSV or Excel
          const text = e.target?.result as string;
          const lines = text.split('\n');
          const headers = lines[0]?.split(',').map(h => h.trim()) || [];
          const data = lines.slice(1, 11).map(line => {
            const values = line.split(',').map(v => v.trim());
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
      // Read the file
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n');
          const headers = lines[0]?.split(',').map(h => h.trim()) || [];
          
          // Parse rows into items
          const items = lines.slice(1).filter(line => line.trim()).map(line => {
            const values = line.split(',').map(v => v.trim());
            const obj: Record<string, any> = {};
            headers.forEach((h, i) => {
              if (h === 'quantity' || h === 'price' || h === 'reorderPoint') {
                obj[h] = parseFloat(values[i]) || 0;
              } else {
                obj[h] = values[i] || '';
              }
            });
            return {
              name: obj.name || '',
              sku: obj.sku || `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              quantity: obj.quantity || 0,
              unitPrice: obj.price || 0,
              category: obj.category || '',
              location: obj.location || 'Warehouse',
              supplier: obj.supplier || '',
              minStock: obj.reorderPoint || 5,
              notes: obj.notes || '',
            };
          });

          // Import each item using createItem
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
                message: error?.response?.data?.message || error?.message || 'Import failed',
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
            toast.success(`Imported ${importResult.imported} items successfully`);
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
      // Create template CSV
      const headers = ['name', 'sku', 'quantity', 'price', 'category', 'location', 'supplier', 'reorderPoint', 'notes'];
      const sampleRow = ['Sample Product', 'SKU001', '10', '99.99', 'Electronics', 'Warehouse', 'Supplier A', '5', 'Sample notes'];
      
      const csvContent = [
        headers.join(','),
        sampleRow.join(','),
        ',,,',
        ',,,',
        'Required columns: name, quantity, price',
        'Optional: sku, category, location, supplier, reorderPoint, notes',
        'Note: SKU will be auto-generated if not provided'
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
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Import Inventory</h2>
              <p className="text-sm text-gray-500 mt-1">
                Upload a CSV or Excel file to bulk import inventory items
              </p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Template
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* File Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive ? 'border-blue-500 bg-blue-50' : 
              file ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-10 h-10 text-green-500" />
                  <div className="text-left">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                {showPreview && previewData.length > 0 && (
                  <div className="w-full mt-3">
                    <p className="text-sm text-gray-500 text-left mb-2">
                      Preview (first {previewData.length} rows):
                    </p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm border border-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {Object.keys(previewData[0] || {}).map((key) => (
                              <th key={key} className="px-3 py-1 text-left text-xs font-medium text-gray-500">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.map((row, idx) => (
                            <tr key={idx} className="border-t border-gray-100">
                              {Object.values(row).map((val: any, i) => (
                                <td key={i} className="px-3 py-1 text-gray-700 max-w-xs truncate">
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
                <p className="text-gray-600">
                  Drag and drop your file here, or{' '}
                  <label className="text-blue-600 hover:text-blue-700 cursor-pointer">
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
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                  <span>Required columns: name, quantity, price</span>
                  <span>|</span>
                  <span>Optional: sku, category, location, supplier, reorderPoint</span>
                </div>
              </>
            )}
          </div>

          {/* Import Options */}
          {file && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Import Options</h4>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={importOptions.updateExisting}
                    onChange={(e) => setImportOptions({ ...importOptions, updateExisting: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  Update existing items
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={importOptions.skipDuplicates}
                    onChange={(e) => setImportOptions({ ...importOptions, skipDuplicates: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  Skip duplicates
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={importOptions.validateOnly}
                    onChange={(e) => setImportOptions({ ...importOptions, validateOnly: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  Validate only (dry run)
                </label>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-gray-500">
              {file && (
                <span>Ready to import: {file.name}</span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setPreviewData([]);
                  setShowPreview(false);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!file || loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {loading ? 'Importing...' : importOptions.validateOnly ? 'Validate' : 'Import'}
              </button>
            </div>
          </div>

          {/* Results */}
          {result && (
            <div className={`mt-6 p-4 rounded-lg ${
              result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center gap-3">
                {result.success ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
                <div className="flex-1">
                  <p className="font-medium">
                    {result.success ? 'Import completed' : 'Import failed'}
                  </p>
                  <p className="text-sm">
                    {result.imported} imported, {result.failed} failed out of {result.total} total
                  </p>
                </div>
                <button
                  onClick={() => setResult(null)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="mt-3 max-h-40 overflow-y-auto">
                  <p className="text-sm font-medium text-red-600">Errors:</p>
                  {result.errors.map((err, idx) => (
                    <p key={idx} className="text-sm text-red-600">
                      Row {err.row}: {err.message}
                    </p>
                  ))}
                </div>
              )}
              
              {/* Warnings */}
              {result.warnings && result.warnings.length > 0 && (
                <div className="mt-3 max-h-40 overflow-y-auto">
                  <p className="text-sm font-medium text-yellow-600">Warnings:</p>
                  {result.warnings.map((warn, idx) => (
                    <p key={idx} className="text-sm text-yellow-600">
                      Row {warn.row}: {warn.message}
                    </p>
                  ))}
                </div>
              )}

              {/* Summary Stats */}
              {result.success && (
                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white p-2 rounded border border-green-200">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-lg font-bold text-gray-700">{result.total}</p>
                  </div>
                  <div className="bg-white p-2 rounded border border-green-200">
                    <p className="text-xs text-gray-500">Imported</p>
                    <p className="text-lg font-bold text-green-600">{result.imported}</p>
                  </div>
                  <div className="bg-white p-2 rounded border border-red-200">
                    <p className="text-xs text-gray-500">Failed</p>
                    <p className="text-lg font-bold text-red-600">{result.failed}</p>
                  </div>
                </div>
              )}

              {/* View Imported Items Button */}
              {result.success && result.imported > 0 && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => router.push('/inventory')}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    View inventory →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Help Section */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Need help?</h4>
        <ul className="text-sm text-gray-500 space-y-1">
          <li>• Download the template to see the required format</li>
          <li>• Required columns: <span className="font-mono">name</span>, <span className="font-mono">quantity</span>, <span className="font-mono">price</span></li>
          <li>• Optional columns: <span className="font-mono">sku</span>, <span className="font-mono">category</span>, <span className="font-mono">location</span>, <span className="font-mono">supplier</span>, <span className="font-mono">reorderPoint</span></li>
          <li>• SKU will be auto-generated if not provided</li>
          <li>• Maximum file size: 5MB</li>
          <li>• Maximum rows: 1000 per import</li>
        </ul>
      </div>
    </div>
  );
}
