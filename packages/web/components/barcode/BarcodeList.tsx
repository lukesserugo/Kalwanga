// D:\Projects\Kalwanga\packages\web\components\barcode\BarcodeList.tsx

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Barcode,
  QrCode,
  Download,
  Printer,
  Eye,
  Copy,
  Check,
  Loader2,
  Package,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useBarcode } from '../../hooks/useBarcode';
import { toast } from '../../utils/toast-manager';
import { Product } from '../../services/productService';
import { BarcodeDisplay } from './BarcodeDisplay';

interface BarcodeListProps {
  products: Product[];
  loading?: boolean;
  onRefresh?: () => void;
  onProductSelect?: (product: Product) => void;
  className?: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
}

export function BarcodeList({
  products,
  loading = false,
  onRefresh,
  onProductSelect,
  className = '',
  showSearch = true,
  searchPlaceholder = 'Search by name, SKU, or barcode...',
}: BarcodeListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const { generateBarcode, downloadBarcode, printBarcode } = useBarcode();

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery))
  );

  const handleGenerate = async (productId: string) => {
    setGeneratingIds((prev) => new Set(prev).add(productId));
    try {
      await generateBarcode(productId);
      onRefresh?.();
    } finally {
      setGeneratingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

  const handleBulkGenerate = async () => {
    const productsWithoutBarcode = filteredProducts.filter((p) => !p.barcode);
    if (productsWithoutBarcode.length === 0) {
      toast.info('All products already have barcodes');
      return;
    }

    for (const product of productsWithoutBarcode) {
      await handleGenerate(product.id);
    }
    toast.success(`Generated ${productsWithoutBarcode.length} barcodes`);
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">
          Loading products...
        </span>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Search and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        {showSearch && (
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
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
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors focus-ring"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleBulkGenerate}
            className="px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all flex items-center gap-2 focus-ring"
          >
            <Barcode className="w-4 h-4" />
            Generate Missing
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="card-brand !p-0 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-4 py-3 text-left text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-4 py-3 text-left text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Barcode
                </th>
                <th className="px-4 py-3 text-left text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    {searchQuery
                      ? 'No products match your search'
                      : 'No products found'}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const isGenerating = generatingIds.has(product.id);
                  const hasBarcode = !!product.barcode;

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-orange-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
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
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-gray-900 dark:text-white tabular-nums">
                              {product.barcode}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(product.barcode!);
                                toast.success('Copied!');
                              }}
                              className="p-1 hover:bg-orange-50 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                            >
                              <Copy className="w-3 h-3 text-gray-400" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleGenerate(product.id)}
                            disabled={isGenerating}
                            className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 flex items-center gap-1 disabled:opacity-50 transition-colors focus-ring rounded"
                          >
                            {isGenerating ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Barcode className="w-3 h-3" />
                            )}
                            {isGenerating ? 'Generating...' : 'Generate'}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedProduct(product);
                              onProductSelect?.(product);
                            }}
                            className="p-1.5 hover:bg-orange-50 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                          {hasBarcode && (
                            <>
                              <button
                                onClick={() => downloadBarcode(product.id)}
                                className="p-1.5 hover:bg-orange-50 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                                title="Download"
                              >
                                <Download className="w-4 h-4 text-success-500" />
                              </button>
                              <button
                                onClick={() => printBarcode(product.id)}
                                className="p-1.5 hover:bg-orange-50 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                                title="Print"
                              >
                                <Printer className="w-4 h-4 text-gray-500" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedProduct(product);
                                }}
                                className="p-1.5 hover:bg-orange-50 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                                title="QR Code"
                              >
                                <QrCode className="w-4 h-4 text-brand-500" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            Showing {filteredProducts.length} of {products.length} products
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            {products.filter((p) => p.barcode).length} have barcodes
          </span>
        </div>
      </div>

      {/* Barcode Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-modal flex items-center justify-center p-4 animate-fade-in">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setSelectedProduct(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-md w-full"
            >
              <BarcodeDisplay
                productId={selectedProduct.id}
                productName={selectedProduct.name}
                productSku={selectedProduct.sku}
                onClose={() => setSelectedProduct(null)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
