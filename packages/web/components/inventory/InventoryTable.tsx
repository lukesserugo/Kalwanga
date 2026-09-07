'use client';

import React, { useState } from 'react';
import { Package, Edit, Trash2, Eye, Loader2, Barcode, QrCode, Copy, Check, Scan, Printer, Download } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { toast } from '../../utils/toast-manager';

interface InventoryTableProps {
  data: any[];
  loading?: boolean;
  viewMode?: 'table' | 'grid' | 'compact';
  selectedItems?: string[];
  onSelectItem?: (id: string) => void;
  onSelectAll?: () => void;
  onEdit?: (item: any) => void;
  onDelete?: (id: string) => void;
  onView?: (item: any) => void;
  onGenerateBarcode?: (item: any) => void;
  onViewBarcode?: (item: any) => void;
  pagination?: {
    page: number;
    total: number;
    totalPages: number;
    limit: number;
  };
  onPageChange?: (page: number) => void;
}

export function InventoryTable({
  data,
  loading = false,
  viewMode = 'table',
  selectedItems = [],
  onSelectItem,
  onSelectAll,
  onEdit,
  onDelete,
  onView,
  onGenerateBarcode,
  onViewBarcode,
  pagination,
  onPageChange,
}: InventoryTableProps) {
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);
  const [generatingBarcode, setGeneratingBarcode] = useState<string | null>(null);
  const [showBarcodeModal, setShowBarcodeModal] = useState<any | null>(null);

  const getStockStatus = (item: any) => {
    const quantity = item.quantity || 0;
    const reorderPoint = item.reorderPoint || item.minStock || 5;
    
    if (quantity <= 0) {
      return { label: 'Out of Stock', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
    }
    if (quantity <= reorderPoint) {
      return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' };
    }
    return { label: 'In Stock', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
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

  const handleGenerateBarcode = async (item: any) => {
    setGeneratingBarcode(item.id);
    try {
      if (onGenerateBarcode) {
        await onGenerateBarcode(item);
      } else {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast.success(`Barcode generated for ${item.name}`);
      }
    } catch (error) {
      toast.error('Failed to generate barcode');
    } finally {
      setGeneratingBarcode(null);
    }
  };

  const handleViewBarcode = (item: any) => {
    if (onViewBarcode) {
      onViewBarcode(item);
    } else {
      setShowBarcodeModal(item);
    }
  };

  const handleCloseBarcodeModal = () => {
    setShowBarcodeModal(null);
  };

  const handlePrintBarcode = (item: any) => {
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
            .qr-img { max-width: 150px; margin: 10px 0; }
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
            <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(JSON.stringify({ 
              id: item.id, 
              name: item.name, 
              sku: item.sku, 
              barcode: item.barcode 
            }))}&size=200x200" alt="QR Code" class="qr-img" />
            <div class="price">${formatCurrency(item.unitPrice || 0)}</div>
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

  const renderBarcodeCell = (item: any) => {
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
              handleCopyBarcode(item.barcode, item.name);
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

  // Barcode Modal Component
  const BarcodeModal = () => {
    if (!showBarcodeModal) return null;
    
    const item = showBarcodeModal;
    const hasBarcode = !!item.barcode;
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCloseBarcodeModal} />
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
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
                        price: item.unitPrice
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
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => {
                    handleCopyBarcode(item.barcode, item.name);
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
                <button
                  onClick={() => {
                    // Open QR code in new window
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(JSON.stringify({
                      id: item.id,
                      name: item.name,
                      sku: item.sku,
                      barcode: item.barcode
                    }))}&size=300x300`;
                    window.open(qrUrl, '_blank');
                  }}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm flex items-center gap-1"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  QR Code
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">No inventory items found</p>
      </div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {data.map((item) => {
            const stockStatus = getStockStatus(item);
            const isSelected = selectedItems.includes(item.id);
            
            return (
              <div
                key={item.id}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow ${
                  isSelected ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${
                      item.quantity <= 0 ? 'bg-red-100 dark:bg-red-900/30' :
                      item.quantity <= (item.reorderPoint || 5) ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                      'bg-green-100 dark:bg-green-900/30'
                    }`}>
                      <Package className={`w-5 h-5 ${
                        item.quantity <= 0 ? 'text-red-600' :
                        item.quantity <= (item.reorderPoint || 5) ? 'text-yellow-600' :
                        'text-green-600'
                      }`} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">{item.name}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.sku || 'No SKU'}</p>
                    </div>
                  </div>
                  {onSelectItem && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onSelectItem(item.id)}
                      className="w-4 h-4 text-blue-600 rounded flex-shrink-0 ml-2"
                    />
                  )}
                </div>

                {/* Barcode Row */}
                <div className="mt-2">
                  {renderBarcodeCell(item)}
                </div>

                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Quantity</span>
                    <span className={`font-medium ${
                      item.quantity <= 0 ? 'text-red-600' :
                      item.quantity <= (item.reorderPoint || 5) ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {item.quantity} {item.unit || 'units'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Price</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(item.unitPrice || 0)}
                    </span>
                  </div>
                  {item.category && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Category</span>
                      <span className="text-gray-900 dark:text-white">{item.category}</span>
                    </div>
                  )}
                  {item.location && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Location</span>
                      <span className="text-gray-900 dark:text-white">{item.location}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${stockStatus.color}`}>
                    {stockStatus.label}
                  </span>
                  <div className="flex items-center gap-1">
                    {item.barcode && (
                      <button onClick={() => handleViewBarcode(item)} className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg" title="View Barcode">
                        <QrCode className="w-4 h-4 text-green-500" />
                      </button>
                    )}
                    {onView && (
                      <button onClick={() => onView(item)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" title="View">
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                    {onEdit && (
                      <button onClick={() => onEdit(item)} className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg" title="Edit">
                        <Edit className="w-4 h-4 text-blue-500" />
                      </button>
                    )}
                    {onDelete && (
                      <button onClick={() => onDelete(item.id)} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg" title="Delete">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && onPageChange && (
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

        <BarcodeModal />
      </>
    );
  }

  if (viewMode === 'compact') {
    return (
      <>
        <div className="space-y-2">
          {data.map((item) => {
            const stockStatus = getStockStatus(item);
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                {onSelectItem && (
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.id)}
                    onChange={() => onSelectItem(item.id)}
                    className="w-4 h-4 text-blue-600 rounded flex-shrink-0"
                  />
                )}
                <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.sku || 'No SKU'}</p>
                </div>
                {item.barcode && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Barcode className="w-3 h-3 text-green-500" />
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-300">{item.barcode}</span>
                  </div>
                )}
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {item.quantity} {item.unit || 'units'}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${stockStatus.color}`}>
                  {stockStatus.label}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {item.barcode && (
                    <button onClick={() => handleViewBarcode(item)} className="p-1 hover:bg-green-100 rounded" title="View Barcode">
                      <QrCode className="w-4 h-4 text-green-500" />
                    </button>
                  )}
                  {onView && (
                    <button onClick={() => onView(item)} className="p-1 hover:bg-gray-100 rounded" title="View">
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                  {onEdit && (
                    <button onClick={() => onEdit(item)} className="p-1 hover:bg-blue-100 rounded" title="Edit">
                      <Edit className="w-4 h-4 text-blue-500" />
                    </button>
                  )}
                  {onDelete && (
                    <button onClick={() => onDelete(item.id)} className="p-1 hover:bg-red-100 rounded" title="Delete">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && onPageChange && (
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

        <BarcodeModal />
      </>
    );
  }

  // Default table view
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              {onSelectItem && (
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedItems.length === data.length && data.length > 0}
                    onChange={onSelectAll}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Item</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">SKU</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Barcode</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quantity</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.map((item) => {
              const stockStatus = getStockStatus(item);
              return (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  {onSelectItem && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => onSelectItem(item.id)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.sku || '-'}</td>
                  <td className="px-4 py-3">
                    {renderBarcodeCell(item)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.category || '-'}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                    {item.quantity} {item.unit || ''}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                    {formatCurrency(item.unitPrice || 0)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${stockStatus.color}`}>
                      {stockStatus.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {item.barcode && (
                        <button onClick={() => handleViewBarcode(item)} className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg" title="View Barcode">
                          <QrCode className="w-4 h-4 text-green-500" />
                        </button>
                      )}
                      {onView && (
                        <button onClick={() => onView(item)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" title="View">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                      )}
                      {onEdit && (
                        <button onClick={() => onEdit(item)} className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg" title="Edit">
                          <Edit className="w-4 h-4 text-blue-500" />
                        </button>
                      )}
                      {onDelete && (
                        <button onClick={() => onDelete(item.id)} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg" title="Delete">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && onPageChange && (
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

// Helper component for X icon (since it might not be imported)
const X = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
