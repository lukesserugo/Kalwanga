// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\[id]\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Package, Truck, Edit, Trash2, 
  RefreshCw, Printer, Download, Copy, CheckCircle,
  AlertCircle, Info, Plus, Minus, X, Save,
  Loader2, Building2, MapPin, Barcode, QrCode,
  Eye, Clock, User, Calendar, DollarSign,
  FileText, ChevronDown, ChevronUp, MoreHorizontal,
  TrendingUp, TrendingDown, ShoppingCart, Warehouse
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { inventoryService, Inventory, InventoryTransaction } from '../../../../../services/inventoryService';
import { productService } from '../../../../../services/productService';
import { api } from '../../../../../services/api';
import { toast } from '../../../../../utils/toast-manager';
import { formatDate, formatCurrency } from '../../../../../utils/formatters';
import { PermissionResource } from '../../../../../types/enums';

// ============================================
// TYPES
// ============================================

interface InventoryItemWithDetails {
  id: string;
  productId?: string;
  name?: string;
  sku?: string;
  barcode?: string | null;
  unitPrice?: number;
  quantity: number;
  reserved: number;
  location: string;
  reorderPoint: number;
  businessUnitId?: string;
  createdAt?: string;
  updatedAt?: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    unitPrice: number;
    barcode?: string | null;
    category?: { id: string; name: string } | null;
    supplier?: { id: string; name: string } | null;
  };
  transactions?: InventoryTransaction[];
  stats?: {
    totalIn: number;
    totalOut: number;
    netChange: number;
  };
}

interface StockUpdateData {
  quantity: number;
  transactionType: 'PURCHASE' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  notes?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function InventoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { hasPermission } = usePermission();
  
  const id = params?.id as string;
  
  // Refs
  const loadedRef = useRef(false);
  const fetchingRef = useRef(false);
  
  // State
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<InventoryItemWithDetails | null>(null);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockUpdate, setStockUpdate] = useState<StockUpdateData>({
    quantity: 1,
    transactionType: 'ADJUSTMENT_IN',
    notes: '',
  });
  const [updatingStock, setUpdatingStock] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [businessUnitName, setBusinessUnitName] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  // Permission checks
  const canEdit = hasPermission(`${PermissionResource.INVENTORY}:edit`) || 
                  hasPermission(`${PermissionResource.INVENTORY}:manage`);
  const canDelete = hasPermission(`${PermissionResource.INVENTORY}:delete`) || 
                    hasPermission(`${PermissionResource.INVENTORY}:manage`);

  // ============================================
  // FETCH INVENTORY ITEM
  // ============================================

  const fetchInventoryItem = useCallback(async () => {
    if (fetchingRef.current) return;
    if (!id) return;

    fetchingRef.current = true;
    setLoading(true);
    
    try {
      console.log(`📤 Fetching inventory item: ${id}`);
      
      // Get the inventory item
      const response = await inventoryService.getInventoryItemById(id);
      console.log('📥 getInventoryItemById response:', response);
      
      // Handle different response formats
      let inventoryData = response;
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          inventoryData = response.data;
        }
      }
      
      if (!inventoryData || typeof inventoryData !== 'object') {
        toast.error('Inventory item not found');
        router.push('/admin/inventory');
        return;
      }

      // Get product details if available
      let productDetails = null;
      if (inventoryData.productId) {
        try {
          productDetails = await productService.getProductById(inventoryData.productId);
          console.log('📥 Product details:', productDetails);
        } catch (error) {
          console.warn('Failed to fetch product details:', error);
        }
      }

      // Get transactions - getInventoryTransactions only takes 1 argument
      let transactionData: InventoryTransaction[] = [];
      try {
        const transResponse = await inventoryService.getInventoryTransactions(
          inventoryData.id || id
        );
        console.log('📥 Transactions response:', transResponse);
        
        if (transResponse && typeof transResponse === 'object') {
          if (Array.isArray(transResponse)) {
            transactionData = transResponse;
          } else if ('data' in transResponse && Array.isArray(transResponse.data)) {
            transactionData = transResponse.data;
          } else if ('transactions' in transResponse && Array.isArray(transResponse.transactions)) {
            transactionData = transResponse.transactions;
          }
        }
      } catch (error) {
        console.warn('Failed to fetch transactions:', error);
      }

      // Calculate stats
      const stats = {
        totalIn: 0,
        totalOut: 0,
        netChange: 0,
      };
      
      transactionData.forEach((t: InventoryTransaction) => {
        if (t.transactionType === 'PURCHASE' || 
            t.transactionType === 'RETURN' || 
            t.transactionType === 'ADJUSTMENT_IN') {
          stats.totalIn += t.quantity;
        } else if (t.transactionType === 'SALE' || 
                   t.transactionType === 'ADJUSTMENT_OUT') {
          stats.totalOut += t.quantity;
        }
      });
      stats.netChange = stats.totalIn - stats.totalOut;

      // Build the full item object
      const fullItem: InventoryItemWithDetails = {
        id: inventoryData.id || id,
        productId: inventoryData.productId,
        name: inventoryData.name || productDetails?.name,
        sku: inventoryData.sku || productDetails?.sku,
        barcode: inventoryData.barcode || productDetails?.barcode,
        unitPrice: inventoryData.unitPrice || productDetails?.unitPrice,
        quantity: inventoryData.quantity || 0,
        reserved: inventoryData.reserved || 0,
        location: inventoryData.location || 'Warehouse',
        reorderPoint: inventoryData.reorderPoint || 5,
        businessUnitId: inventoryData.businessUnitId,
        createdAt: inventoryData.createdAt,
        updatedAt: inventoryData.updatedAt,
        product: productDetails || undefined,
        transactions: transactionData,
        stats: stats,
      };

      setItem(fullItem);
      setTransactions(transactionData);
      
      // Get business unit name
      if (inventoryData.businessUnitId) {
        try {
          const stored = localStorage.getItem('businessUnits');
          if (stored) {
            const units = JSON.parse(stored);
            const bu = units.find((u: any) => u.id === inventoryData.businessUnitId);
            if (bu) {
              setBusinessUnitName(bu.name);
            }
          }
        } catch (e) {
          // Ignore
        }
      }

      loadedRef.current = true;
      
    } catch (error: any) {
      console.error('Failed to fetch inventory item:', error);
      if (error?.response?.status === 404) {
        toast.error('Inventory item not found');
        router.push('/admin/inventory');
      } else {
        toast.error(error?.response?.data?.message || 'Failed to load inventory item');
      }
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [id, router]);

  // ============================================
  // UPDATE STOCK
  // ============================================

  const handleUpdateStock = async () => {
    if (!item) return;
    if (stockUpdate.quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    setUpdatingStock(true);
    try {
      console.log(`📤 Updating stock for item ${item.id}:`, stockUpdate);
      
      // Calculate new quantity
      const currentQuantity = item.quantity || 0;
      let newQuantity = currentQuantity;
      
      // Determine if we're adding or removing
      const isAddition = ['ADJUSTMENT_IN', 'PURCHASE', 'RETURN'].includes(stockUpdate.transactionType);
      const isRemoval = ['ADJUSTMENT_OUT', 'SALE'].includes(stockUpdate.transactionType);
      
      if (isAddition) {
        newQuantity = currentQuantity + stockUpdate.quantity;
      } else if (isRemoval) {
        newQuantity = Math.max(0, currentQuantity - stockUpdate.quantity);
      } else {
        newQuantity = stockUpdate.quantity;
      }
      
      console.log(`📊 Stock change: ${currentQuantity} → ${newQuantity}`);
      
      let updateSuccess = false;
      let lastError = null;

      // METHOD 1: Try using inventoryService.updateInventory
      try {
        if (typeof inventoryService.updateInventory === 'function') {
          console.log('📤 Trying inventoryService.updateInventory...');
          const response = await inventoryService.updateInventory(item.id, {
            quantity: newQuantity,
            location: item.location,
            reorderPoint: item.reorderPoint,
          });
          console.log('📥 Update response (updateInventory):', response);
          updateSuccess = true;
        }
      } catch (err: any) {
        console.warn('inventoryService.updateInventory failed:', err);
        lastError = err;
      }

      // METHOD 2: Try PATCH /inventory/{id}
      if (!updateSuccess) {
        try {
          console.log('📤 Trying PATCH /inventory/{id}...');
          const response = await api.patch(`/inventory/${item.id}`, {
            quantity: newQuantity,
            location: item.location,
            reorderPoint: item.reorderPoint,
          });
          console.log('📥 PATCH response:', response);
          updateSuccess = true;
        } catch (err: any) {
          if (err?.response?.status !== 404 && err?.response?.status !== 405) {
            lastError = err;
          }
          console.warn('PATCH failed:', err?.response?.status);
        }
      }

      // METHOD 3: Try PUT /inventory/{id}
      if (!updateSuccess) {
        try {
          console.log('📤 Trying PUT /inventory/{id}...');
          const response = await api.put(`/inventory/${item.id}`, {
            quantity: newQuantity,
            location: item.location,
            reorderPoint: item.reorderPoint,
          });
          console.log('📥 PUT response:', response);
          updateSuccess = true;
        } catch (err: any) {
          if (err?.response?.status !== 404 && err?.response?.status !== 405) {
            lastError = err;
          }
          console.warn('PUT failed:', err?.response?.status);
        }
      }

      // METHOD 4: Try POST /inventory/{id}/adjust
      if (!updateSuccess) {
        try {
          console.log('📤 Trying POST /inventory/{id}/adjust...');
          const response = await api.post(`/inventory/${item.id}/adjust`, {
            quantity: stockUpdate.quantity,
            type: stockUpdate.transactionType,
            notes: stockUpdate.notes,
          });
          console.log('📥 POST /adjust response:', response);
          updateSuccess = true;
        } catch (err: any) {
          console.warn('POST /adjust failed:', err?.response?.status);
          lastError = err;
        }
      }

      if (updateSuccess) {
        toast.success(`Stock updated successfully! New quantity: ${newQuantity}`);
        setShowStockModal(false);
        loadedRef.current = false;
        await fetchInventoryItem();
        setStockUpdate({
          quantity: 1,
          transactionType: 'ADJUSTMENT_IN',
          notes: '',
        });
      } else {
        if (lastError) {
          throw lastError;
        } else {
          throw new Error('Unable to update inventory. Please try again.');
        }
      }
      
    } catch (error: any) {
      console.error('Failed to update stock:', error);
      
      if (error?.response?.status === 404) {
        toast.error('Inventory update endpoint not found. Please check the API configuration.');
      } else if (error?.response?.status === 500) {
        toast.error('Server error. Please try again later.');
      } else {
        toast.error(error?.response?.data?.message || error?.message || 'Failed to update stock');
      }
    } finally {
      setUpdatingStock(false);
    }
  };

  // ============================================
  // DELETE INVENTORY ITEM
  // ============================================

  const handleDelete = async () => {
    if (!item) return;
    
    setDeleting(true);
    try {
      await inventoryService.deleteInventoryItem(item.id);
      toast.success('Inventory item deleted successfully');
      router.push('/admin/inventory');
      router.refresh();
    } catch (error: any) {
      console.error('Failed to delete inventory item:', error);
      toast.error(error?.response?.data?.message || 'Failed to delete inventory item');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // ============================================
  // GENERATE QR CODE
  // ============================================

  const generateQRCode = async () => {
    if (!item) return;
    
    try {
      const qrData = {
        itemName: item.product?.name || item.name || 'Inventory Item',
        sku: item.product?.sku || item.sku || '',
        barcode: item.product?.barcode || item.barcode || '',
        price: item.product?.unitPrice || item.unitPrice || 0,
        type: 'INVENTORY_ITEM',
        id: item.id,
      };
      
      const response = await productService.generateQRCode(qrData);
      console.log('📥 QR Code response:', response);
      
      if (response && typeof response === 'object') {
        let qrUrl = null;
        if ('data' in response && response.data) {
          if (typeof response.data === 'string') {
            qrUrl = response.data;
          } else if (typeof response.data === 'object' && 'url' in response.data) {
            qrUrl = response.data.url;
          }
        } else if ('url' in response) {
          qrUrl = response.url;
        } else if ('qrCode' in response) {
          qrUrl = response.qrCode;
        }
        
        if (qrUrl) {
          setQrCodeUrl(qrUrl);
          setShowQRCode(true);
        } else {
          toast.error('Failed to generate QR code');
        }
      } else {
        toast.error('Failed to generate QR code');
      }
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      toast.error('Failed to generate QR code');
    }
  };

  // ============================================
  // COPY TO CLIPBOARD
  // ============================================

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => {
      toast.error('Failed to copy');
    });
  };

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    if (id && !loadedRef.current) {
      fetchInventoryItem();
    }
  }, [id, fetchInventoryItem]);

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading inventory item...</p>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Item Not Found</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">The inventory item you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push('/admin/inventory')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Inventory
          </button>
        </div>
      </div>
    );
  }

  const availableStock = (item.quantity || 0) - (item.reserved || 0);
  const isLowStock = availableStock <= (item.reorderPoint || 5);
  const isOutOfStock = availableStock <= 0;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {item.product?.name || item.name || 'Inventory Item'}
              </h1>
              {isOutOfStock ? (
                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium rounded-full">
                  Out of Stock
                </span>
              ) : isLowStock ? (
                <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs font-medium rounded-full">
                  Low Stock
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium rounded-full">
                  In Stock
                </span>
              )}
            </div>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              SKU: {item.product?.sku || item.sku || 'N/A'}
              {businessUnitName && (
                <span className="ml-4 inline-flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  {businessUnitName}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchInventoryItem}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {canEdit && (
            <>
              <button
                onClick={() => setShowStockModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Update Stock
              </button>
              <button
                onClick={() => router.push(`/admin/inventory/${item.id}/edit`)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            </>
          )}
          {canDelete && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Current Stock</p>
          <p className={`text-2xl font-bold ${
            isOutOfStock ? 'text-red-600 dark:text-red-400' :
            isLowStock ? 'text-yellow-600 dark:text-yellow-400' :
            'text-green-600 dark:text-green-400'
          }`}>
            {item.quantity || 0}
          </p>
          {item.reserved && item.reserved > 0 && (
            <p className="text-xs text-gray-400">({item.reserved} reserved)</p>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Available</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {availableStock}
          </p>
          <p className="text-xs text-gray-400">Reorder at {item.reorderPoint || 5}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total In</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {item.stats?.totalIn || 0}
          </p>
          <p className="text-xs text-gray-400">Purchases & Returns</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Out</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {item.stats?.totalOut || 0}
          </p>
          <p className="text-xs text-gray-400">Sales & Adjustments</p>
        </div>
      </div>

      {/* DETAILS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Item Details</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
              <p className="font-medium text-gray-900 dark:text-white">{item.product?.name || item.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">SKU</p>
              <p className="font-mono text-gray-900 dark:text-white">{item.product?.sku || item.sku || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Barcode</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-gray-900 dark:text-white">
                  {item.product?.barcode || item.barcode || 'N/A'}
                </p>
                {(item.product?.barcode || item.barcode) && (
                  <button
                    onClick={() => handleCopy(item.product?.barcode || item.barcode || '', 'Barcode')}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    {copied === 'Barcode' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-gray-400" />
                    )}
                  </button>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Price</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {item.product?.unitPrice ? formatCurrency(item.product.unitPrice) : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Location</p>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <p className="text-gray-900 dark:text-white">{item.location || 'Not specified'}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Reorder Point</p>
              <p className="text-gray-900 dark:text-white">{item.reorderPoint || 5}</p>
            </div>
          </div>

          {item.product?.category && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">Category</p>
              <p className="text-gray-900 dark:text-white">{item.product.category.name}</p>
            </div>
          )}

          {item.product?.supplier && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">Supplier</p>
              <p className="text-gray-900 dark:text-white">{item.product.supplier.name}</p>
            </div>
          )}
        </div>

        {/* Actions Sidebar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Actions</h3>
          
          <button
            onClick={() => window.print()}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Details
          </button>
          
          {item.product?.barcode && (
            <button
              onClick={() => {
                const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(item.product?.barcode || item.barcode || '')}&code=EAN-13&dpi=96`;
                window.open(barcodeUrl, '_blank');
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
            >
              <Barcode className="w-4 h-4" />
              View Barcode
            </button>
          )}
          
          <button
            onClick={generateQRCode}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
          >
            <QrCode className="w-4 h-4" />
            Generate QR Code
          </button>

          {(item.product?.barcode || item.barcode) && (
            <button
              onClick={() => handleCopy(item.product?.barcode || item.barcode || '', 'Barcode')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy Barcode
            </button>
          )}
        </div>
      </div>

      {/* TRANSACTIONS */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Transaction History</h3>
          <span className="text-sm text-gray-500">{transactions.length} transactions</span>
        </div>
        <div className="overflow-x-auto">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p>No transactions found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        transaction.transactionType === 'PURCHASE' || transaction.transactionType === 'ADJUSTMENT_IN' || transaction.transactionType === 'RETURN'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : transaction.transactionType === 'SALE' || transaction.transactionType === 'ADJUSTMENT_OUT'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300'
                      }`}>
                        {transaction.transactionType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {transaction.quantity > 0 ? '+' : ''}{transaction.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(transaction.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {transaction.user?.firstName} {transaction.user?.lastName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                      {transaction.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* STOCK UPDATE MODAL */}
      <AnimatePresence>
        {showStockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowStockModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Update Stock</h3>
                <button
                  onClick={() => setShowStockModal(false)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type
                  </label>
                  <select
                    value={stockUpdate.transactionType}
                    onChange={(e) => setStockUpdate({ ...stockUpdate, transactionType: e.target.value as any })}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="ADJUSTMENT_IN">Add Stock (Adjustment In)</option>
                    <option value="ADJUSTMENT_OUT">Remove Stock (Adjustment Out)</option>
                    <option value="PURCHASE">Purchase</option>
                    <option value="RETURN">Return</option>
                    <option value="SALE">Sale</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={stockUpdate.quantity}
                    onChange={(e) => setStockUpdate({ ...stockUpdate, quantity: Math.max(0, parseInt(e.target.value) || 0) })}
                    min="1"
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    value={stockUpdate.notes}
                    onChange={(e) => setStockUpdate({ ...stockUpdate, notes: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                    placeholder="Reason for stock update..."
                  />
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Info className="w-4 h-4 text-blue-500" />
                  <span>Current stock: {item.quantity || 0}</span>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowStockModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateStock}
                  disabled={updatingStock || stockUpdate.quantity <= 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {updatingStock ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Update Stock
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Inventory Item</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Are you sure you want to delete "{item.product?.name || item.name}"? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR CODE MODAL */}
      <AnimatePresence>
        {showQRCode && qrCodeUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowQRCode(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">QR Code</h3>
                <button
                  onClick={() => setShowQRCode(false)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="flex justify-center">
                {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" className="max-w-full h-auto" />}
              </div>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
                {item.product?.name || item.name}
              </p>
              <button
                onClick={() => {
                  if (qrCodeUrl) {
                    const link = document.createElement('a');
                    link.href = qrCodeUrl;
                    link.download = `qrcode-${item.product?.sku || item.sku || 'item'}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }
                }}
                className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download QR Code
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
