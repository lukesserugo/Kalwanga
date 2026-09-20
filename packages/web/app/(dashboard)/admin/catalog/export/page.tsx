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
  
  const canExportProducts = typeof canExport === 'function' 
    ? canExport() 
    : false || canManage(PermissionResource.PRODUCT);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (permissionLoading || !isClient) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

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
          className="mt-4 px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-2 shadow-brand focus-ring"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Catalog
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin/catalog')}
              className="p-2 hover:bg-brand-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
              aria-label="Back to catalog"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Download className="w-6 h-6 text-brand-500" />
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
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors text-gray-700 dark:text-gray-300 focus-ring"
        >
          Cancel
        </button>
      </div>

      <div className="bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800 rounded-lg p-4 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-brand-700 dark:text-brand-300">
          <p className="font-medium">Export Information</p>
          <ul className="mt-1 space-y-1 list-disc list-inside">
            <li>Export all your products with complete details</li>
            <li>Choose from CSV, Excel, or JSON formats</li>
            <li>Includes product details, pricing, inventory, and categories</li>
            <li>Large exports may take a few moments to process</li>
          </ul>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <ProductImportExport />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-success-100 dark:bg-success-950/30 rounded-lg">
              <FileText className="w-5 h-5 text-success-600 dark:text-success-400" />
            </div>
            <h4 className="font-medium text-gray-900 dark:text-white">CSV</h4>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Comma-separated values format. Best for spreadsheet applications and data analysis.
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-brand-100 dark:bg-brand-950/30 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <h4 className="font-medium text-gray-900 dark:text-white">Excel</h4>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Microsoft Excel format (.xlsx). Preserves formatting and supports multiple sheets.
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-warning-100 dark:bg-warning-950/30 rounded-lg">
              <FileJson className="w-5 h-5 text-warning-600 dark:text-warning-400" />
            </div>
            <h4 className="font-medium text-gray-900 dark:text-white">JSON</h4>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            JavaScript Object Notation format. Ideal for API integration and web applications.
          </p>
        </div>
      </div>

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
