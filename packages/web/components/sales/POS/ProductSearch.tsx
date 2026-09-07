// D:\Projects\Kalwanga\packages\web\components\sales\POS\ProductSearch.tsx
import React from 'react';
import { Package, Plus, Eye, X, Loader2 } from 'lucide-react';

interface ProductSearchProps {
  query: string;
  results?: any[];
  loading?: boolean;
  onSelect: (product: any) => void;
  onViewDetails: (product: any) => void;
  onClose: () => void;
}

export function ProductSearch({ 
  query, 
  results = [], 
  loading = false, 
  onSelect, 
  onViewDetails, 
  onClose 
}: ProductSearchProps) {
  if (!query || query.length < 2) return null;

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 max-h-80 overflow-y-auto shadow-lg flex-shrink-0 z-10">
      <div className="sticky top-0 bg-gray-50 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {loading ? 'Searching...' : `${results.length} results found`}
        </span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          <span className="ml-2 text-gray-500 dark:text-gray-400">Searching...</span>
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-gray-500 dark:text-gray-400">
          <Package className="w-12 h-12 mb-2 opacity-50" />
          <p>No products found</p>
          <p className="text-sm">Try searching with a different term</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {results.map((product) => (
            <div
              key={product.id}
              className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-4 transition-colors"
            >
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                {product.images?.[0] ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{product.name}</p>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span>SKU: {product.sku}</span>
                  {product.barcode && <span>| Barcode: {product.barcode}</span>}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`px-1.5 py-0.5 rounded ${
                    (product.inventory?.available || product.inventory?.quantity || 0) > 10
                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                      : (product.inventory?.available || product.inventory?.quantity || 0) > 0
                      ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                      : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                  }`}>
                    {product.inventory?.available || product.inventory?.quantity || 0} in stock
                  </span>
                  {product.category && (
                    <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                      {product.category.name}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-gray-900 dark:text-white">
                  ${product.unitPrice.toFixed(2)}
                </p>
                <div className="flex gap-1 mt-1">
                  <button
                    onClick={() => onSelect(product)}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                  <button
                    onClick={() => onViewDetails(product)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
