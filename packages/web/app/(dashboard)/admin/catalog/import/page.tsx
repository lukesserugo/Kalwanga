// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\catalog\import\page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProductImportExport } from '../../../../../components/products/ProductImportExport';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { Lock, ArrowLeft, Loader2, AlertCircle, Info } from 'lucide-react';
import { toast } from '../../../../../utils/toast-manager';

export default function ImportProductsPage() {
  const router = useRouter();
  const { canManage, canCreate, isLoading: permissionLoading } = usePermission();
  const [isClient, setIsClient] = useState(false);
  
  // Check permissions
  const canImport = canManage(PermissionResource.PRODUCT) || canCreate(PermissionResource.PRODUCT);

  // Set isClient to true once component mounts
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Loading state
  if (permissionLoading || !isClient) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Permission denied
  if (!canImport) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to import products. Please contact your administrator.
        </p>
        <button
          onClick={() => router.push('/admin/catalog')}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Catalog
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin/catalog')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Back to catalog"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import Products</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Bulk import products from CSV or Excel file
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/admin/catalog')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium">Import Guidelines</p>
          <ul className="mt-1 space-y-1 list-disc list-inside">
            <li>Supported formats: CSV, Excel (.xlsx, .xls)</li>
            <li>Maximum file size: 10MB</li>
            <li>Required columns: Name, SKU, Unit Price</li>
            <li>Optional columns: Description, Category, Supplier, Stock, etc.</li>
            <li>Download the template below to get started</li>
          </ul>
        </div>
      </div>

      {/* Import Component */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <ProductImportExport />
      </div>

      {/* Help Section */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Need Help?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600 dark:text-gray-400">
              <span className="font-medium">📄 Template:</span> Download the import template to see the required format.
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">
              <span className="font-medium">📋 Example:</span> Check the example data in the template for guidance.
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">
              <span className="font-medium">⚠️ Errors:</span> Any errors will be shown after import. You can download the error report.
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">
              <span className="font-medium">🔄 Duplicates:</span> Products with existing SKUs will be skipped or updated based on your selection.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
