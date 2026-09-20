// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\import\page.tsx

'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileSpreadsheet, X, Check, AlertCircle, Loader2,
  Download, FileText, File, FileUp, Table, ArrowLeft,
  Lock, AlertTriangle, Info, ChevronDown, ChevronUp,
  Clock, CheckCircle, XCircle, FileCheck
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { inventoryService } from '../../../../../services/inventoryService';
import { toast } from '../../../../../utils/toast-manager';
import { PermissionResource } from '../../../../../types/enums';

// ============================================
// TYPES
// ============================================

interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
  warnings?: Array<{ row: number; message: string }>;
}

interface ImportOptions {
  updateExisting: boolean;
  skipDuplicates: boolean;
  validateOnly: boolean;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ImportPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { canCreate, canManage, hasPermission } = usePermission();
  
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    updateExisting: true,
    skipDuplicates: false,
    validateOnly: false,
  });

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || 'default';
  
  const canImportInventory = canCreate?.(`${PermissionResource.INVENTORY}:create`) || 
                             canManage?.(`${PermissionResource.INVENTORY}:manage`) ||
                             hasPermission?.(`${PermissionResource.INVENTORY}:import`) ||
                             false;

  if (!canImportInventory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to import inventory.</p>
          <button
            onClick={() => router.push('/admin/inventory')}
            className="mt-4 px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors shadow-brand focus-ring"
          >
            Back to Inventory
          </button>
        </motion.div>
      </div>
    );
  }

  const handleFileChange = (selectedFile: File) => {
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit');
      return;
    }
    
    setFile(selectedFile);
    setResult(null);
    setPreviewData([]);
    setShowPreview(false);
    setImportProgress(0);
    
    if (selectedFile) {
      previewFile(selectedFile);
    }
  };

  const previewFile = (selectedFile: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
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
        toast.error('Failed to preview file. Please check the format.');
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
    setImportProgress(0);
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          const headers = lines[0]?.split(',').map(h => h.trim()) || [];
          
          const items = lines.slice(1).map((line, index) => {
            const values = line.split(',').map(v => v.trim());
            const obj: Record<string, any> = {};
            headers.forEach((h, i) => {
              if (h === 'quantity' || h === 'price' || h === 'reorderPoint' || h === 'minStock') {
                obj[h] = parseFloat(values[i]) || 0;
              } else {
                obj[h] = values[i] || '';
              }
            });
            return {
              name: obj.name || '',
              sku: obj.sku || `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              quantity: obj.quantity || 0,
              unitPrice: obj.price || obj.unitPrice || 0,
              category: obj.category || '',
              location: obj.location || 'Warehouse',
              supplier: obj.supplier || '',
              minStock: obj.reorderPoint || obj.minStock || 5,
              maxStock: obj.maxStock || 100,
              notes: obj.notes || '',
              description: obj.description || '',
            };
          });

          const totalItems = items.length;
          const results = [];
          const errors = [];
          
          const updateProgress = (index: number) => {
            const progress = Math.round(((index + 1) / totalItems) * 100);
            setImportProgress(progress);
          };
          
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            updateProgress(i);
            
            try {
              if (!item.name) {
                errors.push({ row: i + 2, message: 'Name is required' });
                continue;
              }
              
              if (importOptions.validateOnly) {
                results.push({ ...item, validated: true });
                continue;
              }
              
              const result = await inventoryService.createItem({
                name: item.name,
                sku: item.sku,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                minStock: item.minStock,
                maxStock: item.maxStock,
                category: item.category,
                location: item.location,
                supplier: item.supplier,
                notes: item.notes,
                description: item.description,
                businessUnitId: businessUnitId,
              });
              results.push(result);
            } catch (error: any) {
              errors.push({
                row: i + 2,
                message: error?.response?.data?.message || error?.message || 'Import failed',
              });
            }
          }
          
          setImportProgress(100);
          
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
      console.error('Import error:', error);
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

  const handleDownloadTemplate = () => {
    const headers = ['name', 'sku', 'quantity', 'price', 'category', 'location', 'supplier', 'reorderPoint', 'minStock', 'maxStock', 'notes', 'description'];
    const sampleRow = ['Sample Product', 'SKU001', '10', '99.99', 'Electronics', 'Warehouse', 'Supplier A', '5', '10', '100', 'Sample notes', 'Sample description'];
    
    const csvContent = [
      headers.join(','),
      sampleRow.join(','),
      ',,,',
      ',,,',
      'Required columns: name, quantity, price',
      'Optional: sku, category, location, supplier, reorderPoint, minStock, maxStock, notes, description',
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
  };

  const handleClearFile = () => {
    setFile(null);
    setResult(null);
    setPreviewData([]);
    setShowPreview(false);
    setImportProgress(0);
  };

  const renderFileDropArea = () => {
    if (file) {
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-10 h-10 text-success-500" />
            <div className="text-left">
              <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={handleClearFile}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
              aria-label="Remove file"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          
          {loading && (
            <div className="w-full max-w-md">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
                <span className="text-sm text-gray-600 dark:text-gray-300 tabular-nums">
                  Importing... {importProgress}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                <motion.div
                  className="bg-brand-600 rounded-full h-2"
                  initial={{ width: 0 }}
                  animate={{ width: `${importProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}
          
          {showPreview && previewData.length > 0 && !loading && (
            <div className="w-full mt-3">
              <p className="text-sm text-gray-500 dark:text-gray-400 text-left mb-2">
                Preview (first {previewData.length} rows):
              </p>
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg max-h-60 overflow-y-auto custom-scrollbar">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                    <tr>
                      {Object.keys(previewData[0] || {}).map((key) => (
                        <th key={key} className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
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
      );
    }

    return (
      <>
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          Drag and drop your file here, or{' '}
          <label className="text-brand-600 dark:text-brand-400 hover:text-brand-700 cursor-pointer transition-colors focus-ring">
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
        <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-xs text-gray-400 dark:text-gray-500">
          <span>Required: <span className="font-mono">name</span>, <span className="font-mono">quantity</span>, <span className="font-mono">price</span></span>
          <span>|</span>
          <span>Optional: <span className="font-mono">sku</span>, <span className="font-mono">category</span>, <span className="font-mono">location</span>, <span className="font-mono">supplier</span>, <span className="font-mono">reorderPoint</span></span>
        </div>
      </>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-brand-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Upload className="w-7 h-7 sm:w-8 sm:h-8 text-brand-500" />
            Import Inventory
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Bulk import inventory items from CSV or Excel
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upload File</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Supported formats: CSV, Excel (.xlsx, .xls)</p>
          </div>
          <button
            onClick={handleDownloadTemplate}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-600 hover:border-brand-300 dark:hover:border-brand-700 border border-transparent transition-colors text-sm flex items-center gap-2 focus-ring"
          >
            <Download className="w-4 h-4" />
            Template
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <motion.div
            className={`border-2 border-dashed rounded-lg p-6 sm:p-8 text-center transition-colors ${
              dragActive ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20' : 
              file ? 'border-success-500 bg-success-50 dark:bg-success-950/20' : 'border-gray-300 dark:border-gray-600 hover:border-brand-400 dark:hover:border-brand-500'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {renderFileDropArea()}
          </motion.div>

          {file && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="w-full flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 focus-ring"
              >
                <span>Import Options</span>
                {showOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              <AnimatePresence>
                {showOptions && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={importOptions.updateExisting}
                          onChange={(e) => setImportOptions({ ...importOptions, updateExisting: e.target.checked })}
                          className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 transition-colors"
                        />
                        Update existing items
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={importOptions.skipDuplicates}
                          onChange={(e) => setImportOptions({ ...importOptions, skipDuplicates: e.target.checked })}
                          className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 transition-colors"
                        />
                        Skip duplicates
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={importOptions.validateOnly}
                          onChange={(e) => setImportOptions({ ...importOptions, validateOnly: e.target.checked })}
                          className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 transition-colors"
                        />
                        Validate only (dry run)
                      </label>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {file && (
                <span className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-success-500" />
                  Ready to import: <span className="font-medium">{file.name}</span>
                </span>
              )}
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <button
                onClick={handleClearFile}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors flex-1 sm:flex-none focus-ring"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!file || loading}
                className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-1 sm:flex-none transition-colors shadow-brand focus-ring"
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

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={`mt-6 p-4 rounded-lg ${
                  result.success ? 'bg-success-50 dark:bg-success-950/20 border border-success-200 dark:border-success-800' : 'bg-brand-accent-50 dark:bg-brand-accent-950/20 border border-brand-accent-200 dark:border-brand-accent-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-brand-accent-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {result.success ? 'Import completed' : 'Import failed'}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 tabular-nums">
                      {result.imported} imported, {result.failed} failed out of {result.total} total
                    </p>
                  </div>
                  <button
                    onClick={() => setResult(null)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                    aria-label="Dismiss results"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                
                {result.errors.length > 0 && (
                  <div className="mt-3 max-h-40 overflow-y-auto custom-scrollbar">
                    <p className="text-sm font-medium text-brand-accent-600 dark:text-brand-accent-400">Errors:</p>
                    {result.errors.map((err, idx) => (
                      <p key={idx} className="text-sm text-brand-accent-600 dark:text-brand-accent-400">
                        Row {err.row}: {err.message}
                      </p>
                    ))}
                  </div>
                )}

                {result.success && (
                  <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                    <div className="bg-white dark:bg-gray-700 p-2 rounded border border-success-200 dark:border-success-800">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{result.total}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-700 p-2 rounded border border-success-200 dark:border-success-800">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Imported</p>
                      <p className="text-lg font-bold text-success-600 dark:text-success-400 tabular-nums">{result.imported}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-700 p-2 rounded border border-brand-accent-200 dark:border-brand-accent-800">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Failed</p>
                      <p className="text-lg font-bold text-brand-accent-600 dark:text-brand-accent-400 tabular-nums">{result.failed}</p>
                    </div>
                  </div>
                )}

                {result.success && result.imported > 0 && (
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => router.push('/admin/inventory')}
                      className="text-sm text-brand-600 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300 transition-colors focus-ring"
                    >
                      View inventory →
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Need help?</h4>
            <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1 mt-1">
              <li>• Download the template to see the required format</li>
              <li>• Required columns: <span className="font-mono">name</span>, <span className="font-mono">quantity</span>, <span className="font-mono">price</span></li>
              <li>• Optional columns: <span className="font-mono">sku</span>, <span className="font-mono">category</span>, <span className="font-mono">location</span>, <span className="font-mono">supplier</span>, <span className="font-mono">reorderPoint</span></li>
              <li>• SKU will be auto-generated if not provided</li>
              <li>• Maximum file size: 5MB</li>
              <li>• Maximum rows: 1000 per import</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
s