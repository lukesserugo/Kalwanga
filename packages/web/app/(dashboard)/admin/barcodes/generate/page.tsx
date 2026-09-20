// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\barcodes\generate\page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Barcode,
  Loader2,
  CheckCircle,
  AlertCircle,
  Package,
  RefreshCw,
  Download,
  Printer,
  Search,
  X,
  Lock,
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { productService } from '../../../../../services/productService';
import { barcodeService } from '../../../../../services/barcodeService';
import { toast } from '../../../../../utils/toast-manager';
import { PermissionResource } from '../../../../../types/enums';

export default function GenerateBarcodesPage() {
  const router = useRouter();
  const { canManage, isLoading: permissionLoading } = usePermission();

  const [products, setProducts] = useState<any[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<{
    generated: number;
    failed: number;
  } | null>(null);
  const [isClient, setIsClient] = useState(false);

  const canManageProducts = canManage(PermissionResource.PRODUCT);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && canManageProducts) {
      loadProducts();
    }
  }, [isClient, canManageProducts]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const result = await productService.getAllProducts({ limit: 500 });
      setProducts(result.data || []);
    } catch (error) {
      console.error('Failed to load products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    const productsWithoutBarcode = filteredProducts.filter((p) => !p.barcode);
    if (selectedProducts.size === productsWithoutBarcode.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(productsWithoutBarcode.map((p) => p.id)));
    }
  };

  const handleToggleProduct = (productId: string) => {
    setSelectedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleGenerateSelected = async () => {
    if (selectedProducts.size === 0) {
      toast.warning('Please select at least one product');
      return;
    }

    setGenerating(true);
    setResults(null);

    try {
      let generated = 0;
      let failed = 0;
      const ids = Array.from(selectedProducts);

      for (const id of ids) {
        try {
          await barcodeService.generateBarcode(id);
          generated++;
        } catch (error) {
          console.error(`Failed to generate barcode for ${id}:`, error);
          failed++;
        }
      }

      setResults({ generated, failed });
      toast.success(`Generated ${generated} barcodes, ${failed} failed`);
      await loadProducts();
      setSelectedProducts(new Set());
    } catch (error) {
      console.error('Failed to generate barcodes:', error);
      toast.error('Failed to generate barcodes');
    } finally {
      setGenerating(false);
    }
  };

  const handleBulkGenerateAll = async () => {
    const productsWithoutBarcode = filteredProducts.filter((p) => !p.barcode);
    if (productsWithoutBarcode.length === 0) {
      toast.info('All products already have barcodes');
      return;
    }

    setSelectedProducts(new Set(productsWithoutBarcode.map((p) => p.id)));
    await handleGenerateSelected();
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery))
  );

  const productsWithoutBarcode = filteredProducts.filter((p) => !p.barcode);
  const hasBarcode = filteredProducts.filter((p) => p.barcode);

  if (permissionLoading || !isClient) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!canManageProducts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          You don't have permission to generate barcodes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/admin/barcodes')}
            className="p-2 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Barcode className="w-6 h-6 text-brand-500" />
              Generate Barcodes
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Generate barcodes for products that don't have one
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadProducts}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors focus-ring"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleBulkGenerateAll}
            disabled={generating || productsWithoutBarcode.length === 0}
            className="px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg disabled:opacity-50 flex items-center gap-2 transition-all focus-ring"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Barcode className="w-4 h-4" />
            )}
            Generate All Missing
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-200 dark:border-gray-700 p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total Products
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
            {filteredProducts.length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-200 dark:border-gray-700 p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            With Barcode
          </p>
          <p className="text-2xl font-bold text-success-600 dark:text-success-400 tabular-nums">
            {hasBarcode.length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-200 dark:border-gray-700 p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Missing Barcode
          </p>
          <p className="text-2xl font-bold text-warning-600 dark:text-warning-400 tabular-nums">
            {productsWithoutBarcode.length}
          </p>
        </div>
      </div>

      {/* Results */}
      {results && (
        <div
          className={`rounded-2xl p-4 flex items-center gap-3 animate-slide-down ${
            results.failed === 0
              ? 'bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800'
              : 'bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800'
          }`}
        >
          {results.failed === 0 ? (
            <CheckCircle className="w-5 h-5 text-success-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-warning-500" />
          )}
          <span
            className={
              results.failed === 0
                ? 'text-success-700 dark:text-success-300'
                : 'text-warning-700 dark:text-warning-300'
            }
          >
            Generated {results.generated} barcodes, {results.failed} failed
          </span>
        </div>
      )}

      {/* Search */}
      <div className="card-brand !p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-shadow"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus-ring rounded-full p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Product List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="card-brand !p-12 text-center">
          <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            No products found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {searchQuery
              ? 'Try adjusting your search'
              : 'Add products to generate barcodes'}
          </p>
        </div>
      ) : (
        <div className="card-brand !p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={
                  selectedProducts.size === productsWithoutBarcode.length &&
                  productsWithoutBarcode.length > 0
                }
                onChange={handleSelectAll}
                className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 focus:outline-none"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                Select all missing ({productsWithoutBarcode.length})
              </span>
            </div>
            {selectedProducts.size > 0 && (
              <button
                onClick={handleGenerateSelected}
                disabled={generating}
                className="px-3 py-1 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg disabled:opacity-50 flex items-center gap-1 text-sm transition-all focus-ring"
              >
                {generating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Barcode className="w-3 h-3" />
                )}
                Generate Selected ({selectedProducts.size})
              </button>
            )}
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-4 py-3 text-left text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-4 py-3 text-left text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredProducts.map((product) => {
                  const isSelected = selectedProducts.has(product.id);
                  const hasBarcode = !!product.barcode;

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-orange-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleProduct(product.id)}
                          disabled={hasBarcode}
                          className={`w-4 h-4 rounded ${
                            hasBarcode
                              ? 'opacity-50 cursor-not-allowed'
                              : 'text-brand-600 focus:ring-brand-500 focus:outline-none'
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                            {product.images?.[0] ? (
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-full h-full p-2 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {product.name}
                            </p>
                            <p className="text-2xs text-gray-500 dark:text-gray-400 tabular-nums">
                              ${product.unitPrice.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono">
                        {product.sku}
                      </td>
                      <td className="px-4 py-3">
                        {hasBarcode ? (
                          <span className="px-2 py-1 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 rounded-full text-2xs font-medium flex items-center gap-1 w-fit">
                            <CheckCircle className="w-3 h-3" />
                            Has Barcode
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300 rounded-full text-2xs font-medium flex items-center gap-1 w-fit">
                            <AlertCircle className="w-3 h-3" />
                            Missing
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
              Showing {filteredProducts.length} of {products.length} products
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
              {productsWithoutBarcode.length} missing barcodes
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
