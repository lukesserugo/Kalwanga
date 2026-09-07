// D:\Projects\Kalwanga\packages\web\components\products\ProductImportExport.tsx
'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Upload, Download, FileSpreadsheet, X, Check, AlertCircle,
  Loader2, FileText, File, Table, RefreshCw,
  Settings, ChevronDown, Filter, Search
} from 'lucide-react';
import { productService } from '../../services/productService';
import { toast } from '../../utils/toast-manager';
import { usePermission } from '../../hooks/usePermission';
import { PermissionResource } from '../../types/enums';

interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
  warnings?: Array<{ row: number; message: string }>;
}

// Type for export format
type ExportFormat = 'csv' | 'excel' | 'json';

export function ProductImportExport() {
  const { canManage, canExport } = usePermission();
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [exportOptions, setExportOptions] = useState({
    includeVariants: true,
    includeInventory: true,
    includeCategories: true,
    includeImages: false,
  });
  const [importOptions, setImportOptions] = useState({
    updateExisting: true,
    skipDuplicates: false,
    validateOnly: false,
  });
  const [exporting, setExporting] = useState(false);

  const canImportProducts = canManage(PermissionResource.PRODUCT) || canManage(PermissionResource.INVENTORY);
  const canExportProducts = canExport() || canManage(PermissionResource.PRODUCT);

  const handleFileChange = (selectedFile: File) => {
    setFile(selectedFile);
    setResult(null);
    setPreviewData([]);
    setShowPreview(false);
    if (selectedFile) {
      previewFile(selectedFile);
    }
  };

  const previewFile = (selectedFile: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
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
      const result = await productService.importProducts(file);
      
      // Ensure all errors have a row number
      const errorsWithRow = result.errors.map((err: any) => ({
        row: err.row ?? 0,
        message: err.message || 'Unknown error'
      }));
      
      setResult({
        success: result.errors.length === 0,
        total: (result.results?.length || 0) + result.errors.length,
        imported: result.results?.length || 0,
        failed: result.errors.length,
        errors: errorsWithRow,
      });
      
      if (result.results?.length > 0) {
        toast.success(`Imported ${result.results.length} products successfully`);
      }
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} products failed to import`);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to import products');
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

  const handleExport = async () => {
    setExporting(true);
    try {
      // Map json to csv for the service call
      const exportFormatForService = exportFormat === 'json' ? 'csv' : exportFormat;
      const blob = await productService.exportProducts(exportFormatForService);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileExtension = exportFormat === 'excel' ? 'xlsx' : exportFormat;
      link.download = `products_export.${fileExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`Products exported as ${exportFormat.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export products');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
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
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('import')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'import'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
          }`}
        >
          <Upload className="w-4 h-4" />
          Import
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'export'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
          }`}
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      <div className="p-6">
        {/* Import Tab */}
        {activeTab === 'import' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Import Products</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Bulk import products from CSV or Excel file
              </p>
            </div>

            {/* Template Download */}
            <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <FileText className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-gray-600 dark:text-gray-300">Don't have a template?</span>
              <button
                onClick={handleDownloadTemplate}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Download Template
              </button>
            </div>

            {/* File Drop Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 
                file ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
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
                      <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={() => setFile(null)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                  {showPreview && previewData.length > 0 && (
                    <div className="w-full mt-3">
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-left mb-2">
                        Preview (first {previewData.length} rows):
                      </p>
                      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                              {Object.keys(previewData[0] || {}).map((key) => (
                                <th key={key} className="px-3 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                  {key}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.map((row, idx) => (
                              <tr key={idx} className="border-t border-gray-100 dark:border-gray-700">
                                {Object.values(row).map((val: any, i) => (
                                  <td key={i} className="px-3 py-1 text-gray-700 dark:text-gray-300 max-w-xs truncate">
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
                    <label className="text-blue-600 dark:text-blue-400 hover:text-blue-700 cursor-pointer">
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
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                    Supported formats: CSV, Excel (.xlsx, .xls)
                  </p>
                </>
              )}
            </div>

            {/* Import Options */}
            {file && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Import Options</h4>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={importOptions.updateExisting}
                      onChange={(e) => setImportOptions({ ...importOptions, updateExisting: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    Update existing items
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={importOptions.skipDuplicates}
                      onChange={(e) => setImportOptions({ ...importOptions, skipDuplicates: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    Skip duplicates
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
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

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setPreviewData([]);
                  setShowPreview(false);
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!file || loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {loading ? 'Importing...' : importOptions.validateOnly ? 'Validate' : 'Import'}
              </button>
            </div>

            {/* Results */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-lg ${
                  result.success ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  {result.success ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {result.success ? 'Import completed' : 'Import failed'}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {result.imported} imported, {result.failed} failed out of {result.total} total
                    </p>
                  </div>
                  <button
                    onClick={() => setResult(null)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                {result.errors.length > 0 && (
                  <div className="mt-3 max-h-40 overflow-y-auto">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">Errors:</p>
                    {result.errors.map((err, idx) => (
                      <p key={idx} className="text-sm text-red-600 dark:text-red-400">
                        Row {err.row}: {err.message}
                      </p>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Export Products</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Export your products to CSV, Excel, or JSON format
              </p>
            </div>

            {/* Export Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Export Format
              </label>
              <div className="flex gap-2">
                {(['csv', 'excel', 'json'] as const).map((format) => (
                  <button
                    key={format}
                    onClick={() => setExportFormat(format)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      exportFormat === format
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Export Options */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Export Options</h4>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeVariants}
                    onChange={(e) => setExportOptions({ ...exportOptions, includeVariants: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  Include Variants
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeInventory}
                    onChange={(e) => setExportOptions({ ...exportOptions, includeInventory: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  Include Inventory
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeCategories}
                    onChange={(e) => setExportOptions({ ...exportOptions, includeCategories: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  Include Categories
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeImages}
                    onChange={(e) => setExportOptions({ ...exportOptions, includeImages: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  Include Images (URLs)
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {exporting ? 'Exporting...' : 'Export Products'}
              </button>
            </div>

            {/* Export Preview */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Export will include: {[
                  exportOptions.includeVariants && 'Variants',
                  exportOptions.includeInventory && 'Inventory',
                  exportOptions.includeCategories && 'Categories',
                  exportOptions.includeImages && 'Images',
                ].filter(Boolean).join(', ') || 'No options selected'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Format: <span className="font-medium">{exportFormat.toUpperCase()}</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
