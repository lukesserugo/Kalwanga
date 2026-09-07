// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\barcodes\scan\page.tsx

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Scan, Search, Camera, X, Loader2, Package, 
  DollarSign, Tag, ArrowLeft, CheckCircle, AlertCircle
} from 'lucide-react';
import { barcodeService } from '../../../../../services/barcodeService';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency } from '../../../../../utils/formatters';

export default function BarcodeScanPage() {
  const router = useRouter();
  const [barcode, setBarcode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on load
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) {
      toast.warning('Please enter or scan a barcode');
      return;
    }

    setLoading(true);
    setError(null);
    setProduct(null);

    try {
      const result = await barcodeService.lookupProductByBarcode(barcode.trim());
      setProduct(result);
      toast.success('Product found!');
    } catch (error: any) {
      console.error('Failed to lookup product:', error);
      setError(error?.message || 'Product not found for this barcode');
      toast.error('Product not found');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScan(e);
    }
    if (e.key === 'Escape') {
      setBarcode('');
      setProduct(null);
      setError(null);
    }
  };

  const handleClear = () => {
    setBarcode('');
    setProduct(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/admin/barcodes')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Scan className="w-6 h-6 text-blue-500" />
            Scan Barcode
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Scan or enter a barcode to find a product
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <form onSubmit={handleScan} className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="Enter barcode or use scanner..."
              className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              disabled={loading}
              autoFocus
            />
            {barcode && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !barcode.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Scan className="w-4 h-4" />
            )}
            {loading ? 'Searching...' : 'Scan'}
          </button>
        </form>

        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>💡 Tip: Use a barcode scanner or enter the barcode manually</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Press Enter to search</span>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">Searching for product...</span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-red-700 dark:text-red-300">Product Not Found</h3>
            <p className="text-red-600 dark:text-red-400 mt-1">{error}</p>
            <p className="text-sm text-red-500 dark:text-red-400 mt-2">
              Barcode: <span className="font-mono">{barcode}</span>
            </p>
            <button
              onClick={handleClear}
              className="mt-3 px-4 py-2 bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Product Result */}
      {product && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-green-200 dark:border-green-800 overflow-hidden">
          <div className="bg-green-50 dark:bg-green-900/20 px-6 py-3 border-b border-green-200 dark:border-green-800 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-green-700 dark:text-green-300 font-medium">Product Found</span>
          </div>
          
          <div className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Product Image */}
              <div className="w-full md:w-48 h-48 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                {product.images?.[0] ? (
                  <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Package className="w-16 h-16 text-gray-300 dark:text-gray-500" />
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{product.name}</h2>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                      {product.sku}
                    </span>
                    {product.barcode && (
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs font-mono">
                        {product.barcode}
                      </span>
                    )}
                    {product.isActive ? (
                      <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-xs font-medium">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Unit Price</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(product.unitPrice)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Cost Price</p>
                    <p className="text-lg text-gray-900 dark:text-white">{formatCurrency(product.costPrice || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Category</p>
                    <p className="text-gray-900 dark:text-white">{product.category?.name || 'Uncategorized'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Supplier</p>
                    <p className="text-gray-900 dark:text-white">{product.supplier?.name || 'N/A'}</p>
                  </div>
                </div>

                {product.description && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Description</p>
                    <p className="text-gray-700 dark:text-gray-300">{product.description}</p>
                  </div>
                )}

                {product.inventory && product.inventory.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Stock Information</p>
                    <div className="grid grid-cols-3 gap-4 mt-2">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Quantity</p>
                        <p className="font-medium text-gray-900 dark:text-white">{product.inventory[0].quantity}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Reserved</p>
                        <p className="font-medium text-yellow-600 dark:text-yellow-400">{product.inventory[0].reserved || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Available</p>
                        <p className="font-medium text-green-600 dark:text-green-400">
                          {(product.inventory[0].quantity || 0) - (product.inventory[0].reserved || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => router.push(`/admin/catalog/${product.id}`)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    View Product
                  </button>
                  <button
                    onClick={() => router.push(`/admin/catalog/edit/${product.id}`)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Edit Product
                  </button>
                  <button
                    onClick={handleClear}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Scan Another
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {!product && !loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 text-center">
            <Scan className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Scan a barcode</p>
            <p className="text-xs text-gray-500 dark:text-gray-500">Using scanner or manual entry</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 text-center">
            <Package className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Instant product lookup</p>
            <p className="text-xs text-gray-500 dark:text-gray-500">Get product details instantly</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 text-center">
            <DollarSign className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Check stock & pricing</p>
            <p className="text-xs text-gray-500 dark:text-gray-500">View inventory and prices</p>
          </div>
        </div>
      )}
    </div>
  );
}
