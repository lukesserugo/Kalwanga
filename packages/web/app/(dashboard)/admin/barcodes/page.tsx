// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\barcodes\page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Barcode,
  QrCode,
  Search,
  RefreshCw,
  Loader2,
  Download,
  Printer,
  Copy,
  Check,
  Package,
  Eye,
  ArrowLeft,
  Plus,
  Lock,
} from 'lucide-react';
import { usePermission } from '../../../../hooks/usePermission';
import { productService } from '../../../../services/productService';
import { barcodeService } from '../../../../services/barcodeService';
import { toast } from '../../../../utils/toast-manager';
import { PermissionResource } from '../../../../types/enums';
import { ProductBarcode } from '../../../../components/barcode/ProductBarcode';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  unitPrice: number;
  images?: string[];
}

export default function BarcodesPage() {
  const router = useRouter();
  const {
    canView,
    canManage,
    isLoading: permissionLoading,
  } = usePermission();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [generating, setGenerating] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const canViewProducts =
    canView(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && canViewProducts) {
      loadProducts();
    }
  }, [isClient, canViewProducts]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const result = await productService.getAllProducts({ limit: 100 });
      setProducts(result.data || []);
    } catch (error) {
      console.error('Failed to load products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBarcode = async (productId: string) => {
    try {
      setGenerating(true);
      await barcodeService.generateBarcode(productId);
      toast.success('Barcode generated successfully');
      await loadProducts();
    } catch (error: any) {
      console.error('Failed to generate barcode:', error);
      toast.error(error?.message || 'Failed to generate barcode');
    } finally {
      setGenerating(false);
    }
  };

  const handleBulkGenerate = async () => {
    try {
      setGenerating(true);
      const result = await barcodeService.bulkGenerateBarcodes();
      toast.success(
        `Generated ${result.generated} barcodes, ${result.failed} failed`
      );
      await loadProducts();
    } catch (error: any) {
      console.error('Failed to bulk generate barcodes:', error);
      toast.error(error?.message || 'Failed to bulk generate barcodes');
    } finally {
      setGenerating(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery))
  );

  if (permissionLoading || !isClient) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!canViewProducts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <Lock className="w-12 h-12 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          You don't have permission to view barcodes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin/inventory')}
              className="p-2 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Barcode className="w-6 h-6 text-brand-500" />
                Barcodes & QR Codes
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Manage product barcodes and QR codes
              </p>
            </div>
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
            onClick={handleBulkGenerate}
            disabled={generating}
            className="px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg disabled:opacity-50 flex items-center gap-2 transition-all focus-ring"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Bulk Generate
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="card-brand !p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search products by name, SKU, or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-shadow"
          />
        </div>
      </div>

      {/* Product List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="card-brand !p-12 text-center">
          <Barcode className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
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
                    QR Code
                  </th>
                  <th className="px-4 py-3 text-right text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredProducts.map((product) => (
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
                      {product.barcode ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-gray-900 dark:text-white tabular-nums">
                            {product.barcode}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(product.barcode!);
                              toast.success('Copied!');
                            }}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                          >
                            <Copy className="w-3 h-3 text-gray-400" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleGenerateBarcode(product.id)}
                          disabled={generating}
                          className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 flex items-center gap-1 transition-colors focus-ring rounded"
                        >
                          <Barcode className="w-3 h-3" />
                          Generate
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {product.barcode ? (
                        <button
                          onClick={() => setSelectedProduct(product)}
                          className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 flex items-center gap-1 text-sm transition-colors focus-ring rounded"
                        >
                          <QrCode className="w-3 h-3" />
                          View QR
                        </button>
                      ) : (
                        <span className="text-gray-400 text-sm">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedProduct(product)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {product.barcode && (
                          <>
                            <button
                              onClick={() => {
                                // Download barcode
                                barcodeService
                                  .getBarcodeImage(product.id)
                                  .then((data) => {
                                    const link =
                                      document.createElement('a');
                                    link.href = data.barcodeUrl;
                                    link.download = `barcode_${product.sku}.png`;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  });
                              }}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                              title="Download Barcode"
                            >
                              <Download className="w-4 h-4 text-success-500" />
                            </button>
                            <button
                              onClick={() => {
                                // Print barcode
                                window.open(
                                  `/admin/barcodes/print/${product.id}`,
                                  '_blank'
                                );
                              }}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                              title="Print Barcode"
                            >
                              <Printer className="w-4 h-4 text-gray-500" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
              Showing {filteredProducts.length} of {products.length} products
            </span>
          </div>
        </div>
      )}

      {/* Barcode/QR Code Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4 animate-fade-in">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedProduct(null)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-card-hover max-w-md w-full max-h-[90vh] overflow-y-auto p-6 custom-scrollbar">
            <ProductBarcode
              productId={selectedProduct.id}
              productName={selectedProduct.name}
              productSku={selectedProduct.sku}
              onClose={() => setSelectedProduct(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
