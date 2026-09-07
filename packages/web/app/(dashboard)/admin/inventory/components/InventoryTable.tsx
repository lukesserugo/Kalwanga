// D:\Projects\Kalwanga\packages\web\app\(dashboard)\inventory\components\InventoryTable.tsx

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Eye, Edit, Trash2, ChevronLeft, ChevronRight,
  Check, X, AlertTriangle, MoreVertical, Download,
  Printer, RefreshCw, Grid, List, Barcode, QrCode,
  Copy, Scan, Link2
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../../../../utils/formatters';
import { useAuth } from '../../../../../hooks/useAuth';
import { barcodeService } from '../../../../../services/barcodeService';
import { toast } from '../../../../../utils/toast-manager';

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
  price: number;
  reorderPoint: number;
  category?: string;
  location?: string;
  status?: string;
  lastUpdated?: string;
  barcode?: string | null;
  images?: string[];
}

interface InventoryTableProps {
  data: InventoryItem[];
  loading: boolean;
  viewMode: 'table' | 'grid' | 'compact';
  selectedItems: string[];
  onSelectItem: (id: string) => void;
  onSelectAll: () => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onView: (item: InventoryItem) => void;
  pagination: {
    page: number;
    total: number;
    totalPages: number;
    limit: number;
  };
  onPageChange: (page: number) => void;
}

export function InventoryTable({
  data,
  loading,
  viewMode,
  selectedItems,
  onSelectItem,
  onSelectAll,
  onEdit,
  onDelete,
  onView,
  pagination,
  onPageChange,
}: InventoryTableProps) {
  const { canEditInventory, canDeleteInventory } = useAuth();
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);
  const [generatingBarcode, setGeneratingBarcode] = useState<string | null>(null);
  const [showBarcodeModal, setShowBarcodeModal] = useState<InventoryItem | null>(null);

  const getStatusColor = (stock: number, reorderPoint: number) => {
    if (stock === 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' };
    if (stock <= reorderPoint) return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' };
    return { label: 'In Stock', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' };
  };

  const handleCopyBarcode = async (barcode: string, itemName: string) => {
    try {
      await navigator.clipboard.writeText(barcode);
      setCopiedBarcode(barcode);
      toast.success(`Barcode for ${itemName} copied`);
      setTimeout(() => setCopiedBarcode(null), 2000);
    } catch {
      toast.error('Failed to copy barcode');
    }
  };

  const handleGenerateBarcode = async (item: InventoryItem) => {
    setGeneratingBarcode(item.id);
    try {
      // In a real implementation, this would call an API to generate barcode
      // For now, we'll simulate with a toast
      toast.success(`Generating barcode for ${item.name}...`);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success(`Barcode generated for ${item.name}`);
    } catch (error) {
      toast.error('Failed to generate barcode');
    } finally {
      setGeneratingBarcode(null);
    }
  };

  const handleViewBarcode = (item: InventoryItem) => {
    setShowBarcodeModal(item);
  };

  const handleCloseBarcodeModal = () => {
    setShowBarcodeModal(null);
  };

  const handlePrintBarcode = (item: InventoryItem) => {
    if (!item.barcode) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Barcode - ${item.name}</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: white; }
            .container { text-align: center; padding: 30px; border: 1px solid #ddd; border-radius: 8px; max-width: 400px; }
            .barcode-img { max-width: 300px; margin: 15px 0; }
            .product-name { margin: 0 0 5px 0; color: #1a1a1a; }
            .sku { color: #666; font-size: 12px; margin: 0 0 15px 0; }
            .price { font-size: 18px; font-weight: bold; color: #2563eb; margin: 5px 0; }
            .info { margin-top: 15px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2 class="product-name">${item.name}</h2>
            <p class="sku">SKU: ${item.sku || 'N/A'}</p>
            <img src="https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(item.barcode!)}&code=EAN-13&dpi=96" alt="Barcode" class="barcode-img" />
            <div class="price">${formatCurrency(item.price)}</div>
            <div class="info">
              <span>${item.barcode}</span>
              ${item.category ? `<span>| ${item.category}</span>` : ''}
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const renderBarcodeCell = (item: InventoryItem) => {
    if (item.barcode) {
      return (
        <div className="flex items-center gap-1">
          <Barcode className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
          <span className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate max-w-[100px]">
            {item.barcode}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopyBarcode(item.barcode!, item.name);
            }}
            className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
            title="Copy barcode"
          >
            {copiedBarcode === item.barcode ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <Copy className="w-3 h-3 text-gray-400" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleViewBarcode(item);
            }}
            className="p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
            title="View QR Code"
          >
            <QrCode className="w-3 h-3 text-blue-500" />
          </button>
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-400">No barcode</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleGenerateBarcode(item);
          }}
          disabled={generatingBarcode === item.id}
          className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {generatingBarcode === item.id ? (
            <span className="flex items-center gap-1">
              <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
              ...
            </span>
          ) : (
            'Generate'
          )}
        </button>
      </div>
    );
  };

  // Barcode Modal
  const BarcodeModal = () => {
    if (!showBarcodeModal) return null;
    
    const item = showBarcodeModal;
    const hasBarcode = !!item.barcode;
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCloseBarcodeModal} />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
        >
          <button
            onClick={handleCloseBarcodeModal}
            className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
          
          <div className="text-center">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              {item.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {item.sku}</p>
            
            {hasBarcode ? (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <div className="flex flex-col items-center gap-4">
                  <div>
                    <img
                      src={`https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(item.barcode!)}&code=EAN-13&dpi=96`}
                      alt="Barcode"
                      className="h-16 w-auto"
                    />
                    <p className="text-xs font-mono text-gray-600 dark:text-gray-400 mt-2">
                      {item.barcode}
                    </p>
                  </div>
                  <div>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(JSON.stringify({
                        id: item.id,
                        name: item.name,
                        sku: item.sku,
                        barcode: item.barcode,
                        price: item.price
                      }))}&size=200x200`}
                      alt="QR Code"
                      className="w-24 h-24 object-contain"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 p-8 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-center">
                <Barcode className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">No barcode assigned</p>
                <button
                  onClick={() => {
                    handleGenerateBarcode(item);
                    handleCloseBarcodeModal();
                  }}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Generate Barcode
                </button>
              </div>
            )}
            
            {hasBarcode && (
              <div className="mt-4 flex justify-center gap-2">
                <button
                  onClick={() => {
                    handleCopyBarcode(item.barcode!, item.name);
                  }}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </button>
                <button
                  onClick={() => handlePrintBarcode(item)}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(item.barcode!)}&code=EAN-13&dpi=96`;
                    link.download = `barcode-${item.sku}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    toast.success('Barcode downloaded');
                  }}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No items found</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Try adjusting your filters or add a new item</p>
        </div>
      </div>
    );
  }

  // Grid View
  if (viewMode === 'grid') {
    return (
      <>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.map((item) => {
              const status = getStatusColor(item.stock, item.reorderPoint);
              const isSelected = selectedItems.includes(item.id);
              const isHovered = hoveredRow === item.id;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -4 }}
                  className={`bg-white dark:bg-gray-800 rounded-xl border transition-all ${
                    isSelected 
                      ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50' 
                      : 'border-gray-200 dark:border-gray-700 hover:shadow-md'
                  }`}
                  onMouseEnter={() => setHoveredRow(item.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onSelectItem(item.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">{item.name}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {item.sku}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="mt-2">
                      {renderBarcodeCell(item)}
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Stock</p>
                        <p className="font-medium text-gray-900 dark:text-white">{item.stock}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Price</p>
                        <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.price)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Reorder</p>
                        <p className="font-medium text-gray-900 dark:text-white">{item.reorderPoint}</p>
                      </div>
                    </div>

                    {item.category && (
                      <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Category: {item.category}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-2">
                      {item.barcode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewBarcode(item);
                          }}
                          className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                          title="View Barcode"
                        >
                          <QrCode className="w-4 h-4 text-green-500" />
                        </button>
                      )}
                      <button
                        onClick={() => onView(item)}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                      {canEditInventory && (
                        <button
                          onClick={() => onEdit(item)}
                          className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-blue-500" />
                        </button>
                      )}
                      {canDeleteInventory && (
                        <button
                          onClick={() => onDelete(item.id)}
                          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Showing {data.length} of {pagination.total} items
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => onPageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => onPageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
        <BarcodeModal />
      </>
    );
  }

  // Table View
  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedItems.length === data.length && data.length > 0}
                    onChange={onSelectAll}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Barcode
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.map((item) => {
                const status = getStatusColor(item.stock, item.reorderPoint);
                const isSelected = selectedItems.includes(item.id);

                return (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                    }`}
                    onMouseEnter={() => setHoveredRow(item.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onSelectItem(item.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 text-gray-400" />
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono">{item.sku}</td>
                    <td className="px-4 py-3">
                      {renderBarcodeCell(item)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-white">{item.stock}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-white">{formatCurrency(item.price)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {item.barcode && (
                          <button
                            onClick={() => handleViewBarcode(item)}
                            className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                            title="View Barcode"
                          >
                            <QrCode className="w-4 h-4 text-green-500" />
                          </button>
                        )}
                        <button
                          onClick={() => onView(item)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {canEditInventory && (
                          <button
                            onClick={() => onEdit(item)}
                            className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-blue-500" />
                          </button>
                        )}
                        {canDeleteInventory && (
                          <button
                            onClick={() => onDelete(item.id)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Showing {data.length} of {pagination.total} items
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      <BarcodeModal />
    </>
  );
}
