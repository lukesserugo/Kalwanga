// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\scan\page.tsx

'use client';

import { useRouter } from 'next/navigation';
import { Scan } from 'lucide-react';
import { InventoryScan } from '../../../../../components/inventory/InventoryScan';

export default function InventoryScanPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Page header — owned by the route, not the component */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-50 dark:bg-brand-950/30 rounded-lg">
            <Scan className="w-6 h-6 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Scan Inventory
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Scan a barcode or type a SKU to look up an item
            </p>
          </div>
        </div>

        <button
          onClick={() => router.push('/admin/inventory')}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors text-sm text-gray-700 dark:text-gray-300 focus-ring"
        >
          Back to Inventory
        </button>
      </div>

      {/* The actual scanner — all logic lives in the component */}
      <InventoryScan />
    </div>
  );
}
