// D:\Projects\Kalwanga\packages\web\components\inventory\InventoryTable.tsx

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, Edit, Trash2, Eye, Loader2, Barcode, QrCode, 
  Copy, Check, Scan, Printer, Download, X, Search,
  ChevronLeft, ChevronRight, Grid, List, LayoutGrid,
  Filter, ArrowUpDown, AlertCircle, CheckCircle,
  AlertTriangle, DollarSign, MapPin, Tag, Building,
  Clock, TrendingUp, TrendingDown, Plus, Minus,
  RefreshCw, MoreVertical, Globe, Star, Archive,
  Weight, Percent, Hash, Calendar, Users, ChevronUp, ChevronDown 
} from 'lucide-react';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';
import { toast } from '../../utils/toast-manager';

// ============================================
// TYPES
// ============================================

export interface InventoryTableItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  category?: string;
  location?: string;
  supplier?: string;
  barcode?: string | null;
  images?: string[];
  status?: string;
  isActive?: boolean;
  isDigital?: boolean;
  featured?: boolean;
  unit?: string;
  weight?: number;
  taxRate?: number;
  tags?: string[];
  reorderPoint?: number;
  minStock?: number;
  reserved?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface InventoryTableProps {
  data: InventoryTableItem[];
  loading?: boolean;
  viewMode?: 'table' | 'grid' | 'compact';
  selectedItems?: string[];
  onSelectItem?: (id: string) => void;
  onSelectAll?: () => void;
  onEdit?: (item: InventoryTableItem) => void;
  onDelete?: (id: string) => void;
  onView?: (item: InventoryTableItem) => void;
  onGenerateBarcode?: (item: InventoryTableItem) => void;
  onViewBarcode?: (item: InventoryTableItem) => void;
  onAdjustStock?: (item: InventoryTableItem) => void;
  onTransfer?: (item: InventoryTableItem) => void;
  onRestock?: (item: InventoryTableItem) => void;
  pagination?: {
    page: number;
    total: number;
    totalPages: number;
    limit: number;
  };
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  onSort?: (field: string, direction: 'asc' | 'desc') => void;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  className?: string;
  emptyMessage?: string;
}

// ============================================
// SUB-COMPONENTS
// ============================================

const StockStatusBadge: React.FC<{ 
  quantity: number; 
  reorderPoint: number;
  isActive?: boolean;
}> = ({ quantity, reorderPoint, isActive = true }) => {
  if (!isActive) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
        Inactive
      </span>
    );
  }
  
  const stockStatus = useMemo(() => {
    if (quantity <= 0) {
      return { 
        label: 'Out of Stock', 
        color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
        icon: AlertCircle
      };
    }
    if (quantity <= reorderPoint) {
      return { 
        label: 'Low Stock', 
        color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
        icon: AlertTriangle
      };
    }
    return { 
      label: 'In Stock', 
      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      icon: CheckCircle
    };
  }, [quantity, reorderPoint]);

  const Icon = stockStatus.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${stockStatus.color}`}>
      <Icon className="w-3 h-3" />
      {stockStatus.label}
    </span>
  );
};

const BarcodeCell: React.FC<{
  item: InventoryTableItem;
  onGenerateBarcode?: (item: InventoryTableItem) => void;
  onViewBarcode?: (item: InventoryTableItem) => void;
  onCopyBarcode?: (barcode: string) => void;
}> = ({ item, onGenerateBarcode, onViewBarcode, onCopyBarcode }) => {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!item.barcode) return;
    try {
      await navigator.clipboard.writeText(item.barcode);
      setCopied(true);
      onCopyBarcode?.(item.barcode);
      toast.success(`Barcode copied`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy barcode');
    }
  }, [item.barcode, onCopyBarcode]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      await onGenerateBarcode?.(item);
      toast.success(`Barcode generated for ${item.name}`);
    } catch (error) {
      toast.error('Failed to generate barcode');
    } finally {
      setGenerating(false);
    }
  }, [item, onGenerateBarcode]);

  if (item.barcode) {
    return (
      <div className="flex items-center gap-1">
        <Barcode className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
        <span className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate max-w-[80px]">
          {item.barcode}
        </span>
        <button
          onClick={handleCopy}
          className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
          title="Copy barcode"
        >
          {copied ? (
            <Check className="w-3 h-3 text-green-500" />
          ) : (
            <Copy className="w-3 h-3 text-gray-400" />
          )}
        </button>
        {onViewBarcode && (
          <button
            onClick={() => onViewBarcode(item)}
            className="p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
            title="View QR Code"
          >
            <QrCode className="w-3 h-3 text-blue-500" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-400">No barcode</span>
      {onGenerateBarcode && (
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {generating ? (
            <span className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
            </span>
          ) : (
            'Generate'
          )}
        </button>
      )}
    </div>
  );
};

const BarcodeModal: React.FC<{
  item: InventoryTableItem | null;
  onClose: () => void;
  onCopyBarcode?: (barcode: string) => void;
  onGenerateBarcode?: (item: InventoryTableItem) => void;
}> = ({ item, onClose, onCopyBarcode, onGenerateBarcode }) => {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  if (!item) return null;

  const hasBarcode = !!item.barcode;

  const handleCopy = useCallback(async () => {
    if (!item.barcode) return;
    try {
      await navigator.clipboard.writeText(item.barcode);
      setCopied(true);
      onCopyBarcode?.(item.barcode);
      toast.success('Barcode copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy barcode');
    }
  }, [item.barcode, onCopyBarcode]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      await onGenerateBarcode?.(item);
      toast.success(`Barcode generated for ${item.name}`);
      onClose();
    } catch (error) {
      toast.error('Failed to generate barcode');
    } finally {
      setGenerating(false);
    }
  }, [item, onGenerateBarcode, onClose]);

  const handlePrint = useCallback(() => {
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
          <script>window.onload = function() { window.print(); }<\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [item]);

  const handleDownload = useCallback(() => {
    if (!item.barcode) return;
    const link = document.createElement('a');
    link.href = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(item.barcode)}&code=EAN-13&dpi=96`;
    link.download = `barcode-${item.sku || 'item'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Barcode downloaded');
  }, [item]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
        
        <div className="text-center">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
            {item.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {item.sku || 'N/A'}</p>
          
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
              {onGenerateBarcode && (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
                >
                  {generating ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </span>
                  ) : (
                    'Generate Barcode'
                  )}
                </button>
              )}
            </div>
          )}
          
          {hasBarcode && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={handlePrint}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
              <button
                onClick={handleDownload}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
              <button
                onClick={() => {
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
      </motion.div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

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
  onAdjustStock,
  onTransfer,
  onRestock,
  pagination,
  onPageChange,
  onLimitChange,
  onSort,
  sortField,
  sortDirection = 'asc',
  className = '',
  emptyMessage = 'No inventory items found',
}: InventoryTableProps) {
  const [barcodeModalItem, setBarcodeModalItem] = useState<InventoryTableItem | null>(null);

  const handleViewBarcode = useCallback((item: InventoryTableItem) => {
    if (onViewBarcode) {
      onViewBarcode(item);
    } else {
      setBarcodeModalItem(item);
    }
  }, [onViewBarcode]);

  const handleCloseBarcodeModal = useCallback(() => {
    setBarcodeModalItem(null);
  }, []);

  const getStockStatus = useCallback((item: InventoryTableItem) => {
    const quantity = item.quantity || 0;
    const reorderPoint = item.reorderPoint || item.minStock || 5;
    
    if (!item.isActive) {
      return { label: 'Inactive', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300' };
    }
    if (quantity <= 0) {
      return { label: 'Out of Stock', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
    }
    if (quantity <= reorderPoint) {
      return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' };
    }
    return { label: 'In Stock', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
  }, []);

  const getAvailableStock = useCallback((item: InventoryTableItem) => {
    return (item.quantity || 0) - (item.reserved || 0);
  }, []);

  const getStockValue = useCallback((item: InventoryTableItem) => {
    return (item.quantity || 0) * (item.unitPrice || 0);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading inventory...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  // ============================================
  // GRID VIEW
  // ============================================

  if (viewMode === 'grid') {
    return (
      <>
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${className}`}>
          {data.map((item) => {
            const stockStatus = getStockStatus(item);
            const isSelected = selectedItems.includes(item.id);
            const availableStock = getAvailableStock(item);
            const stockValue = getStockValue(item);
            const hasImage = item.images && item.images.length > 0;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4 hover:shadow-md transition-all ${
                  isSelected ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {hasImage ? (
                        <img 
                          src={item.images![0]} 
                          alt={item.name} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/placeholder-image.png';
                          }}
                        />
                      ) : (
                        <Package className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">{item.name}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{item.sku || 'No SKU'}</p>
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
                  <BarcodeCell
                    item={item}
                    onGenerateBarcode={onGenerateBarcode}
                    onViewBarcode={handleViewBarcode}
                  />
                </div>

                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Available</span>
                    <span className={`font-medium ${
                      availableStock <= 0 ? 'text-red-600 dark:text-red-400' :
                      availableStock <= (item.reorderPoint || 5) ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {availableStock} {item.unit || 'units'}
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
                      <span className="text-gray-900 dark:text-white truncate max-w-[100px]">{item.category}</span>
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
                  <StockStatusBadge 
                    quantity={item.quantity || 0} 
                    reorderPoint={item.reorderPoint || item.minStock || 5}
                    isActive={item.isActive}
                  />
                  <div className="flex items-center gap-1">
                    {item.barcode && (
                      <button 
                        onClick={() => handleViewBarcode(item)} 
                        className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors" 
                        title="View Barcode"
                      >
                        <QrCode className="w-4 h-4 text-green-500" />
                      </button>
                    )}
                    {onAdjustStock && (
                      <button 
                        onClick={() => onAdjustStock(item)} 
                        className="p-1.5 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors" 
                        title="Adjust Stock"
                      >
                        <Minus className="w-4 h-4 text-amber-500" />
                      </button>
                    )}
                    {onView && (
                      <button 
                        onClick={() => onView(item)} 
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" 
                        title="View"
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                    {onEdit && (
                      <button 
                        onClick={() => onEdit(item)} 
                        className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors" 
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-blue-500" />
                      </button>
                    )}
                    {onDelete && (
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
        {pagination && pagination.totalPages > 1 && onPageChange && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Showing {data.length} of {pagination.total} items
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Barcode Modal */}
        <AnimatePresence>
          {barcodeModalItem && (
            <BarcodeModal
              item={barcodeModalItem}
              onClose={handleCloseBarcodeModal}
              onGenerateBarcode={onGenerateBarcode}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  // ============================================
  // COMPACT VIEW
  // ============================================

  if (viewMode === 'compact') {
    return (
      <>
        <div className={`space-y-2 ${className}`}>
          {data.map((item) => {
            const stockStatus = getStockStatus(item);
            const availableStock = getAvailableStock(item);
            
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
                  <p className="text-xs text-gray-500 font-mono">{item.sku || 'No SKU'}</p>
                </div>
                {item.barcode && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Barcode className="w-3 h-3 text-green-500" />
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-300">{item.barcode}</span>
                  </div>
                )}
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {availableStock} {item.unit || 'units'}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {formatCurrency(item.unitPrice || 0)}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stockStatus.color}`}>
                  {stockStatus.label}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {item.barcode && (
                    <button 
                      onClick={() => handleViewBarcode(item)} 
                      className="p-1 hover:bg-green-100 rounded transition-colors" 
                      title="View Barcode"
                    >
                      <QrCode className="w-4 h-4 text-green-500" />
                    </button>
                  )}
                  {onView && (
                    <button 
                      onClick={() => onView(item)} 
                      className="p-1 hover:bg-gray-100 rounded transition-colors" 
                      title="View"
                    >
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                  {onEdit && (
                    <button 
                      onClick={() => onEdit(item)} 
                      className="p-1 hover:bg-blue-100 rounded transition-colors" 
                      title="Edit"
                    >
                      <Edit className="w-4 h-4 text-blue-500" />
                    </button>
                  )}
                  {onDelete && (
                    <button 
                      onClick={() => onDelete(item.id)} 
                      className="p-1 hover:bg-red-100 rounded transition-colors" 
                      title="Delete"
                    >
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
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Showing {data.length} of {pagination.total} items
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Barcode Modal */}
        <AnimatePresence>
          {barcodeModalItem && (
            <BarcodeModal
              item={barcodeModalItem}
              onClose={handleCloseBarcodeModal}
              onGenerateBarcode={onGenerateBarcode}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  // ============================================
  // TABLE VIEW (DEFAULT)
  // ============================================

  const handleSort = (field: string) => {
    if (!onSort) return;
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(field, newDirection);
  };

  const SortableHeader: React.FC<{
    field: string;
    children: React.ReactNode;
    className?: string;
  }> = ({ field, children, className = '' }) => {
    const isActive = sortField === field;
    return (
      <th 
        className={`px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors ${className}`}
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1">
          {children}
          {isActive ? (
            sortDirection === 'asc' ? 
              <ChevronUp className="w-3 h-3" /> : 
              <ChevronDown className="w-3 h-3" />
          ) : (
            <ArrowUpDown className="w-3 h-3 opacity-50" />
          )}
        </div>
      </th>
    );
  };

  return (
    <>
      <div className={`overflow-x-auto ${className}`}>
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              {onSelectItem && (
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectedItems.length === data.length && data.length > 0}
                    onChange={onSelectAll}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                </th>
              )}
              <SortableHeader field="name">Item</SortableHeader>
              <SortableHeader field="sku" className="hidden md:table-cell">SKU</SortableHeader>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Barcode</th>
              <SortableHeader field="category" className="hidden lg:table-cell">Category</SortableHeader>
              <SortableHeader field="quantity" className="text-right">Quantity</SortableHeader>
              <SortableHeader field="unitPrice" className="text-right hidden sm:table-cell">Price</SortableHeader>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.map((item) => {
              const stockStatus = getStockStatus(item);
              const availableStock = getAvailableStock(item);
              const hasBarcode = !!item.barcode;

              return (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  {onSelectItem && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => onSelectItem(item.id)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.images && item.images.length > 0 ? (
                          <img 
                            src={item.images[0]} 
                            alt={item.name} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/images/placeholder-image.png';
                            }}
                          />
                        ) : (
                          <Package className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white truncate max-w-[150px]">
                        {item.name}
                      </span>
                      {item.featured && (
                        <Star className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                      )}
                      {item.isDigital && (
                        <Globe className="w-3 h-3 text-blue-500 flex-shrink-0" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono hidden md:table-cell">
                    {item.sku || '-'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <BarcodeCell
                      item={item}
                      onGenerateBarcode={onGenerateBarcode}
                      onViewBarcode={handleViewBarcode}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hidden lg:table-cell">
                    {item.category || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <div className="flex flex-col items-end">
                      <span className={`font-medium ${
                        availableStock <= 0 ? 'text-red-600 dark:text-red-400' :
                        availableStock <= (item.reorderPoint || 5) ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-green-600 dark:text-green-400'
                      }`}>
                        {availableStock}
                      </span>
                      {item.reserved && item.reserved > 0 && (
                        <span className="text-xs text-gray-400">({item.reserved} reserved)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white hidden sm:table-cell">
                    {formatCurrency(item.unitPrice || 0)}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <StockStatusBadge 
                      quantity={item.quantity || 0} 
                      reorderPoint={item.reorderPoint || item.minStock || 5}
                      isActive={item.isActive}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {hasBarcode && (
                        <button 
                          onClick={() => handleViewBarcode(item)} 
                          className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors" 
                          title="View Barcode"
                        >
                          <QrCode className="w-4 h-4 text-green-500" />
                        </button>
                      )}
                      {onAdjustStock && (
                        <button 
                          onClick={() => onAdjustStock(item)} 
                          className="p-1.5 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors" 
                          title="Adjust Stock"
                        >
                          <Minus className="w-4 h-4 text-amber-500" />
                        </button>
                      )}
                      {onView && (
                        <button 
                          onClick={() => onView(item)} 
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" 
                          title="View"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                      )}
                      {onEdit && (
                        <button 
                          onClick={() => onEdit(item)} 
                          className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors" 
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-blue-500" />
                        </button>
                      )}
                      {onDelete && (
                        <button 
                          onClick={() => onDelete(item.id)} 
                          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors" 
                          title="Delete"
                        >
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
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Showing {data.length} of {pagination.total} items
              </span>
              {onLimitChange && (
                <select
                  value={pagination.limit}
                  onChange={(e) => onLimitChange(parseInt(e.target.value))}
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Barcode Modal */}
      <AnimatePresence>
        {barcodeModalItem && (
          <BarcodeModal
            item={barcodeModalItem}
            onClose={handleCloseBarcodeModal}
            onGenerateBarcode={onGenerateBarcode}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================
// EXPORT
// ============================================

export default InventoryTable;
