// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\catalog\export\page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProductImportExport } from '../../../../../components/products/ProductImportExport';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { Lock, ArrowLeft, Download, FileSpreadsheet, FileJson, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from '../../../../../utils/toast-manager';

export default function ExportProductsPage() {
  const router = useRouter();
  const { canExport, canManage, isLoading: permissionLoading } = usePermission();
  const [isClient, setIsClient] = useState(false);
  
  // Check permissions - canExport is a function that returns boolean
  const canExportProducts = typeof canExport === 'function' 
    ? canExport() 
    : false || canManage(PermissionResource.PRODUCT);

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
  if (!canExportProducts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to export products. Please contact your administrator.
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Download className="w-6 h-6 text-blue-500" />
                Export Products
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Export your products to CSV, Excel, or JSON format
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => router.push('/admin/catalog')}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
        >
          Cancel
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium">Export Information</p>
          <ul className="mt-1 space-y-1 list-disc list-inside">
            <li>Export all your products with complete details</li>
            <li>Choose from CSV, Excel, or JSON formats</li>
            <li>Includes product details, pricing, inventory, and categories</li>
            <li>Large exports may take a few moments to process</li>
          </ul>
        </div>
      </div>

      {/* Export Component */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <ProductImportExport />
      </div>

      {/* Format Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h4 className="font-medium text-gray-900 dark:text-white">CSV</h4>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Comma-separated values format. Best for spreadsheet applications and data analysis.
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h4 className="font-medium text-gray-900 dark:text-white">Excel</h4>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Microsoft Excel format (.xlsx). Preserves formatting and supports multiple sheets.
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <FileJson className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h4 className="font-medium text-gray-900 dark:text-white">JSON</h4>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            JavaScript Object Notation format. Ideal for API integration and web applications.
          </p>
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">💡 Tips for Exporting</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600 dark:text-gray-400">
              <span className="font-medium">📊 Large Datasets:</span> For large catalogs, consider exporting in smaller batches or using CSV format.
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">
              <span className="font-medium">🔍 Filter First:</span> Use the catalog filters to export only the products you need.
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">
              <span className="font-medium">📋 Includes All Data:</span> Exports include product details, variants, inventory, and categories.
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">
              <span className="font-medium">⏳ Processing Time:</span> Large exports may take a few moments. Please be patient.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
