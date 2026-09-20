// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\barcodes\scan\page.tsx

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Scan,
  Search,
  Camera,
  X,
  Loader2,
  Package,
  DollarSign,
  Tag,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
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
    <div className="space-y-6 p-6 max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/admin/barcodes')}
          className="p-2 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Scan className="w-6 h-6 text-brand-500" />
            Scan Barcode
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Scan or enter a barcode to find a product
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="card-brand">
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
              className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono tabular-nums transition-shadow"
              disabled={loading}
              autoFocus
            />
            {barcode && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus-ring rounded-full p-1 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !barcode.trim()}
            className="px-6 py-3 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all focus-ring"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Scan className="w-4 h-4" />
            )}
            {loading ? 'Searching...' : 'Scan'}
          </button>
        </form>

        <div className="mt-3 flex items-center gap-4 text-2xs text-gray-500 dark:text-gray-400">
          <span>💡 Tip: Use a barcode scanner or enter the barcode manually</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Press Enter to search</span>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            Searching for product...
          </span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-2xl p-6 flex items-start gap-4 animate-slide-down">
          <AlertCircle className="w-6 h-6 text-danger-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-danger-700 dark:text-danger-300">
              Product Not Found
            </h3>
            <p className="text-danger-600 dark:text-danger-400 mt-1">{error}</p>
            <p className="text-sm text-danger-500 dark:text-danger-400 mt-2">
              Barcode: <span className="font-mono tabular-nums">{barcode}</span>
            </p>
            <button
              onClick={handleClear}
              className="mt-3 px-4 py-2 bg-danger-100 dark:bg-danger-800/30 text-danger-700 dark:text-danger-300 rounded-lg hover:bg-danger-200 dark:hover:bg-danger-800/50 transition-colors focus-ring"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Product Result */}
      {product && !loading && (
        <div className="card-brand !p-0 overflow-hidden !border-success-200 dark:!border-success-800 animate-slide-up">
          <div className="bg-success-50 dark:bg-success-900/20 px-6 py-3 border-b border-success-200 dark:border-success-800 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success-500" />
            <span className="text-success-700 dark:text-success-300 font-medium">
              Product Found
            </span>
          </div>

          <div className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Product Image */}
              <div className="w-full md:w-48 h-48 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                {product.images?.[0] ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Package className="w-16 h-16 text-gray-300 dark:text-gray-500" />
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {product.name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <span className="px-2 py-0.5 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-full text-2xs font-medium">
                      {product.sku}
                    </span>
                    {product.barcode && (
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-2xs font-mono tabular-nums">
                        {product.barcode}
                      </span>
                    )}
                    {product.isActive ? (
                      <span className="px-2 py-0.5 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 rounded-full text-2xs font-medium">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300 rounded-full text-2xs font-medium">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Unit Price
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                      {formatCurrency(product.unitPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Cost Price
                    </p>
                    <p className="text-lg text-gray-900 dark:text-white tabular-nums">
                      {formatCurrency(product.costPrice || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Category
                    </p>
                    <p className="text-gray-900 dark:text-white">
                      {product.category?.name || 'Uncategorized'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Supplier
                    </p>
                    <p className="text-gray-900 dark:text-white">
                      {product.supplier?.name || 'N/A'}
                    </p>
                  </div>
                </div>

                {product.description && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Description
                    </p>
                    <p className="text-gray-700 dark:text-gray-300">
                      {product.description}
                    </p>
                  </div>
                )}

                {product.inventory && product.inventory.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Stock Information
                    </p>
                    <div className="grid grid-cols-3 gap-4 mt-2">
                      <div>
                        <p className="text-2xs text-gray-500 dark:text-gray-400">
                          Quantity
                        </p>
                        <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                          {product.inventory[0].quantity}
                        </p>
                      </div>
                      <div>
                        <p className="text-2xs text-gray-500 dark:text-gray-400">
                          Reserved
                        </p>
                        <p className="font-medium text-warning-600 dark:text-warning-400 tabular-nums">
                          {product.inventory[0].reserved || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-2xs text-gray-500 dark:text-gray-400">
                          Available
                        </p>
                        <p className="font-medium text-success-600 dark:text-success-400 tabular-nums">
                          {(product.inventory[0].quantity || 0) -
                            (product.inventory[0].reserved || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => router.push(`/admin/catalog/${product.id}`)}
                    className="px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all focus-ring"
                  >
                    View Product
                  </button>
                  <button
                    onClick={() =>
                      router.push(`/admin/catalog/edit/${product.id}`)
                    }
                    className="btn-secondary focus-ring"
                  >
                    Edit Product
                  </button>
                  <button onClick={handleClear} className="btn-secondary focus-ring">
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-200 dark:border-gray-700 p-4 text-center">
            <Scan className="w-6 h-6 text-brand-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Scan a barcode
            </p>
            <p className="text-2xs text-gray-500 dark:text-gray-500">
              Using scanner or manual entry
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-200 dark:border-gray-700 p-4 text-center">
            <Package className="w-6 h-6 text-success-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Instant product lookup
            </p>
            <p className="text-2xs text-gray-500 dark:text-gray-500">
              Get product details instantly
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-200 dark:border-gray-700 p-4 text-center">
            <DollarSign className="w-6 h-6 text-warning-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Check stock & pricing
            </p>
            <p className="text-2xs text-gray-500 dark:text-gray-500">
              View inventory and prices
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
