// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\[id]\page.tsx

'use client';

import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Package, Truck, Edit, Trash2,
  RefreshCw, Printer, Download, Copy, CheckCircle,
  AlertCircle, Info, Plus, Minus, X, Save,
  Loader2, Building2, MapPin, Barcode, QrCode,
  Eye, Clock, User, Calendar, DollarSign,
  FileText, ChevronDown, ChevronUp, MoreHorizontal,
  TrendingUp, TrendingDown, ShoppingCart, Warehouse,
  Weight, Percent, Tag as TagIcon, Image as ImageIcon,
  Globe, Star, Archive, Hash, CalendarDays
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import {
  inventoryService,
  Inventory,
  InventoryTransaction,
  InventoryItemResponse,
} from '../../../../../services/inventoryService';
import { productService } from '../../../../../services/productService';
import { api } from '../../../../../services/api';
import { toast } from '../../../../../utils/toast-manager';
import { formatDate, formatCurrency } from '../../../../../utils/formatters';
import { PermissionResource } from '../../../../../types/enums';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ============================================
// IMAGE HELPERS
// ============================================
//
// The backend stores `Product.images` as `ProductImage[]` and the
// frontend service flattens it to `string[]`. This guard makes the
// page resilient if a raw payload (e.g. from productService) ever
// leaks through with the un-flattened shape.

function toImageUrls(input: unknown): string[] {
  if (!input) return [];
  if (typeof input === 'string') return [input];
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => {
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object' && typeof (v as any).url === 'string') {
        return (v as any).url as string;
      }
      return null;
    })
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
}

// ============================================
// TYPES
// ============================================

interface InventoryItemWithDetails {
  id: string;
  productId?: string;
  name: string;
  sku: string;
  barcode: string | null;
  unitPrice: number;
  quantity: number;
  reserved: number;
  location: string;
  reorderPoint: number;
  reorderQuantity?: number;
  businessUnitId?: string;
  createdAt?: string;
  updatedAt?: string;
  images: string[];
  description: string | null;
  weight: number;
  taxRate: number;
  tags: string[];
  isActive: boolean;
  isDigital: boolean;
  featured: boolean;
  category: string;
  categoryId: string | null;
  supplier: string | null;
  supplierId: string | null;
  notes: string | null;
  expiryDate?: string | null;
  batchNumber?: string | null;
  product?: {
    id: string;
    name: string;
    sku: string;
    unitPrice: number;
    barcode?: string | null;
    category?: { id: string; name: string } | null;
    supplier?: { id: string; name: string } | null;
    images?: string[];
    description?: string | null;
    weight?: number;
    taxRate?: number;
    tags?: string[];
    isActive?: boolean;
    isDigital?: boolean;
    featured?: boolean;
    minStock?: number;
    maxStock?: number;
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
  transactionType:
    | 'PURCHASE'
    | 'SALE'
    | 'RETURN'
    | 'ADJUSTMENT'
    | 'ADJUSTMENT_IN'
    | 'ADJUSTMENT_OUT';
  notes?: string;
}

// ============================================
// STOCK STATUS HELPERS
// ============================================

const getStockStatus = (available: number, reorderPoint: number) => {
  if (available <= 0)
    return { status: 'out_of_stock', label: 'Out of Stock', color: 'red' };
  if (available <= reorderPoint)
    return { status: 'low_stock', label: 'Low Stock', color: 'yellow' };
  return { status: 'in_stock', label: 'In Stock', color: 'green' };
};

const getStockStatusColor = (status: string) => {
  switch (status) {
    case 'out_of_stock':
      return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
    case 'low_stock':
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
    case 'in_stock':
      return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
    default:
      return 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300';
  }
};

const getTransactionTypeColor = (type: string) => {
  const additions = [
    'PURCHASE',
    'ADJUSTMENT_IN',
    'RETURN',
    'INITIAL',
    'RESTOCK',
    'TRANSFER_IN',
  ];
  const removals = [
    'SALE',
    'ADJUSTMENT_OUT',
    'ISSUE',
    'DAMAGED',
    'LOST',
    'TRANSFER_OUT',
  ];

  if (additions.includes(type)) {
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  }
  if (removals.includes(type)) {
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  }
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300';
};

const getTransactionIcon = (type: string) => {
  switch (type) {
    case 'PURCHASE':
    case 'RESTOCK':
      return <ShoppingCart className="w-3 h-3" />;
    case 'SALE':
      return <TrendingUp className="w-3 h-3" />;
    case 'RETURN':
      return <RefreshCw className="w-3 h-3" />;
    case 'ADJUSTMENT_IN':
      return <Plus className="w-3 h-3" />;
    case 'ADJUSTMENT_OUT':
      return <Minus className="w-3 h-3" />;
    case 'ISSUE':
      return <Truck className="w-3 h-3" />;
    default:
      return <FileText className="w-3 h-3" />;
  }
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function InventoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { hasPermission } = usePermission();

  // ✅ useParams() instead of parsing window.location — SSR-safe and
  //    updates on client-side navigation.
  const id = useMemo(() => {
    const raw = params?.id;
    if (Array.isArray(raw)) return raw[0] || '';
    return typeof raw === 'string' ? raw : '';
  }, [params]);

  // Refs
  const loadedRef = useRef(false);
  const fetchingRef = useRef(false);
  const refreshingRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [generatingQR, setGeneratingQR] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Permission checks
  const canEdit =
    hasPermission(`${PermissionResource.INVENTORY}:edit`) ||
    hasPermission(`${PermissionResource.INVENTORY}:manage`);
  const canDelete =
    hasPermission(`${PermissionResource.INVENTORY}:delete`) ||
    hasPermission(`${PermissionResource.INVENTORY}:manage`);

  // ============================================
  // FETCH INVENTORY ITEM
  // ============================================

  const fetchInventoryItem = useCallback(async () => {
    if (fetchingRef.current) return;
    if (!id) {
      console.warn('⚠️ No ID provided');
      router.push('/admin/inventory');
      return;
    }

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      console.log(`📤 Fetching inventory item: ${id}`);

      let inventoryData: any = null;

      try {
        // ⚠️ Do NOT pass a businessUnitId here. The service only
        //    forwards an explicit argument; everything else falls
        //    through to the backend's `req.user.businessUnitId`,
        //    which is the same value the list page uses. Passing
        //    `inventoryData.businessUnitId` here would force a BU
        //    that may not match the one `getAllInventory` used,
        //    producing 404s from the list ↔ detail mismatch.
        const response = await inventoryService.getInventoryItemById(id);
        console.log('📥 getInventoryItemById response:', response);

        if (response === null) {
          console.warn(`⚠️ Inventory item ${id} not found (404)`);
          toast.error('Inventory item not found');
          router.push('/admin/inventory');
          return;
        }

        // The service already unwraps `{ success, data }`. Prefer the
        // flat shape directly. Fall back to defensive unwrap only if
        // the payload still looks wrapped.
        if (response && typeof response === 'object') {
          if ('id' in (response as any)) {
            inventoryData = response;
          } else if ('data' in (response as any) && (response as any).data) {
            inventoryData = (response as any).data;
          }
        }
      } catch (fetchError: any) {
        if (fetchError?.response?.status === 404) {
          console.warn(`⚠️ Inventory item ${id} not found (404)`);
          toast.error('Inventory item not found');
          router.push('/admin/inventory');
          return;
        }
        throw fetchError;
      }

      if (!inventoryData || typeof inventoryData !== 'object') {
        console.warn('⚠️ Invalid inventory data received');
        toast.error('Invalid inventory data');
        router.push('/admin/inventory');
        return;
      }

      // Product details (best-effort)
      let productDetails: any = null;
      if (inventoryData.productId) {
        try {
          productDetails = await productService.getProductById(
            inventoryData.productId
          );
          console.log('📥 Product details:', productDetails);
        } catch (productError) {
          console.warn('Failed to fetch product details:', productError);
        }
      }

      // Transactions (best-effort)
      let transactionData: InventoryTransaction[] = [];
      const stats = { totalIn: 0, totalOut: 0, netChange: 0 };

      if (inventoryData.productId) {
        try {
          // ⚠️ Do NOT pass a businessUnitId here either. The service
          //    resolves it the same way the detail request above did,
          //    so both calls target the same BU.
          const transResponse =
            await inventoryService.getInventoryTransactions({
              productId: inventoryData.productId,
              limit: 100,
            });
          console.log('📥 Transactions response:', transResponse);

          if (transResponse) {
            if (Array.isArray(transResponse)) {
              transactionData = transResponse;
            } else if (
              'data' in transResponse &&
              Array.isArray((transResponse as any).data)
            ) {
              transactionData = (transResponse as any).data;
            } else if (
              'transactions' in transResponse &&
              Array.isArray((transResponse as any).transactions)
            ) {
              transactionData = (transResponse as any).transactions;
            }

            transactionData.forEach((t: InventoryTransaction) => {
              const type = t.transactionType;
              if (
                type === 'PURCHASE' ||
                type === 'RESTOCK' ||
                type === 'RETURN' ||
                type === 'ADJUSTMENT_IN' ||
                type === 'INITIAL' ||
                type === 'TRANSFER_IN'
              ) {
                stats.totalIn += Math.abs(t.quantity);
              } else if (
                type === 'SALE' ||
                type === 'ADJUSTMENT_OUT' ||
                type === 'ISSUE' ||
                type === 'TRANSFER_OUT'
              ) {
                stats.totalOut += Math.abs(t.quantity);
              }
            });
            stats.netChange = stats.totalIn - stats.totalOut;
          }
        } catch (transError) {
          console.warn('Failed to fetch transactions:', transError);
        }
      }

      // Build the full item object
      const fullItem: InventoryItemWithDetails = {
        id: inventoryData.id || id,
        productId: inventoryData.productId || inventoryData.product?.id,
        name:
          inventoryData.name ||
          inventoryData.product?.name ||
          'Unknown Item',
        sku: inventoryData.sku || inventoryData.product?.sku || 'N/A',
        barcode:
          inventoryData.barcode || inventoryData.product?.barcode || null,
        unitPrice:
          inventoryData.unitPrice || inventoryData.product?.unitPrice || 0,
        quantity: inventoryData.quantity || inventoryData.stock || 0,
        reserved: inventoryData.reserved || 0,
        location: inventoryData.location || 'Warehouse',
        reorderPoint: inventoryData.reorderPoint || inventoryData.minStock || 5,
        reorderQuantity:
          inventoryData.reorderQuantity || inventoryData.maxStock || 10,
        businessUnitId: inventoryData.businessUnitId,
        createdAt: inventoryData.createdAt,
        updatedAt: inventoryData.updatedAt,
        // ✅ Both branches go through toImageUrls so a raw
        //    ProductImage[] from productService can't leak through.
        images:
          inventoryData.images && inventoryData.images.length > 0
            ? toImageUrls(inventoryData.images)
            : toImageUrls(inventoryData.product?.images),
        description:
          inventoryData.description ||
          inventoryData.product?.description ||
          null,
        weight: inventoryData.weight ?? inventoryData.product?.weight ?? 0,
        taxRate:
          inventoryData.taxRate ?? inventoryData.product?.taxRate ?? 0,
        tags:
          inventoryData.tags && inventoryData.tags.length > 0
            ? inventoryData.tags
            : inventoryData.product?.tags || [],
        isActive:
          inventoryData.isActive ??
          inventoryData.product?.isActive ??
          true,
        isDigital:
          inventoryData.isDigital ??
          inventoryData.product?.isDigital ??
          false,
        featured:
          inventoryData.featured ??
          inventoryData.product?.featured ??
          false,
        category:
          inventoryData.category ||
          inventoryData.product?.category?.name ||
          'Uncategorized',
        categoryId:
          inventoryData.categoryId ||
          inventoryData.product?.category?.id ||
          null,
        supplier:
          inventoryData.supplier ||
          inventoryData.product?.supplier?.name ||
          null,
        supplierId:
          inventoryData.supplierId ||
          inventoryData.product?.supplier?.id ||
          null,
        notes: inventoryData.notes || null,
        expiryDate: inventoryData.expiryDate || null,
        batchNumber: inventoryData.batchNumber || null,
        product: productDetails || inventoryData.product || undefined,
        transactions: transactionData,
        stats,
      };

      setItem(fullItem);
      setTransactions(transactionData);

      // Business unit name
      if (fullItem.businessUnitId) {
        try {
          const stored = localStorage.getItem('businessUnits');
          if (stored) {
            const units = JSON.parse(stored);
            const bu = units.find(
              (u: any) => u.id === fullItem.businessUnitId
            );
            if (bu) setBusinessUnitName(bu.name);
          }
        } catch (e) {
          console.warn('Failed to get business unit name:', e);
        }
      }

      loadedRef.current = true;
    } catch (error: any) {
      console.error('❌ Failed to fetch inventory item:', error);

      if (error?.response?.status === 404) {
        toast.error('Inventory item not found');
        router.push('/admin/inventory');
        return;
      }

      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load inventory item';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [id, router]);

  // ============================================
  // REFRESH ITEM
  // ============================================

  const refreshItem = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    loadedRef.current = false;
    try {
      await fetchInventoryItem();
      toast.success('Item refreshed');
    } finally {
      setRefreshing(false);
      refreshingRef.current = false;
    }
  }, [fetchInventoryItem]);

  // ============================================
  // UPDATE STOCK
  // ============================================
  //
  // ✅ Single deterministic call to inventoryService.updateStock.
  //    The previous version tried seven endpoints in sequence and
  //    accepted whichever one returned 2xx first — which could
  //    "succeed" without actually changing the stock. This surfaces
  //    real errors correctly.

  const handleUpdateStock = async () => {
    if (!item) return;
    if (stockUpdate.quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    setUpdatingStock(true);
    setError(null);

    try {
      console.log(
        `📤 Updating stock for item ${item.id}:`,
        stockUpdate
      );

      const currentQuantity = item.quantity || 0;
      const isAddition = [
        'ADJUSTMENT_IN',
        'PURCHASE',
        'RESTOCK',
        'RETURN',
      ].includes(stockUpdate.transactionType);
      const isRemoval = [
        'ADJUSTMENT_OUT',
        'SALE',
        'ISSUE',
      ].includes(stockUpdate.transactionType);

      let newQuantity = currentQuantity;
      if (isAddition) newQuantity = currentQuantity + stockUpdate.quantity;
      else if (isRemoval)
        newQuantity = Math.max(0, currentQuantity - stockUpdate.quantity);

      console.log(`📊 Stock change: ${currentQuantity} → ${newQuantity}`);

      await inventoryService.updateStock(item.id, {
        quantity: stockUpdate.quantity,
        transactionType: stockUpdate.transactionType,
        notes: stockUpdate.notes,
      });

      toast.success(
        `Stock updated successfully! New quantity: ${newQuantity}`
      );
      setShowStockModal(false);
      loadedRef.current = false;
      await fetchInventoryItem();
      setStockUpdate({
        quantity: 1,
        transactionType: 'ADJUSTMENT_IN',
        notes: '',
      });
    } catch (error: any) {
      console.error('❌ Failed to update stock:', error);

      let errorMsg = 'Failed to update stock';
      if (error?.response?.status === 404) {
        errorMsg = 'Inventory item not found. Please refresh and try again.';
      } else if (error?.response?.status === 500) {
        errorMsg = 'Server error. Please try again later.';
      } else {
        errorMsg =
          error?.response?.data?.message ||
          error?.message ||
          'Failed to update stock';
      }

      setError(errorMsg);
      toast.error(errorMsg);
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
    setError(null);
    try {
      await inventoryService.deleteInventoryItem(item.id);
      toast.success('Inventory item deleted successfully');
      router.push('/admin/inventory');
    } catch (error: any) {
      console.error('❌ Failed to delete inventory item:', error);
      const errorMsg =
        error?.response?.data?.message || 'Failed to delete inventory item';
      setError(errorMsg);
      toast.error(errorMsg);
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
    setGeneratingQR(true);
    setError(null);

    try {
      const qrData = {
        itemName: item.name || 'Inventory Item',
        sku: item.sku || '',
        barcode: item.barcode || '',
        price: item.unitPrice || 0,
        description: item.description || '',
        weight: item.weight || 0,
        taxRate: item.taxRate || 0,
        tags: item.tags && item.tags.length > 0 ? item.tags.join(', ') : '',
        type: 'INVENTORY_ITEM',
        id: item.id,
        location: item.location || '',
        quantity: item.quantity || 0,
      };

      try {
        const response = await productService.generateQRCode(qrData);
        console.log('📥 QR Code response:', response);

        if (response && typeof response === 'object') {
          let qrUrl: string | null = null;

          if ('data' in response && response.data) {
            if (typeof response.data === 'string') {
              qrUrl = response.data;
            } else if (
              typeof response.data === 'object' &&
              response.data !== null &&
              'url' in response.data &&
              typeof (response.data as any).url === 'string'
            ) {
              qrUrl = (response.data as any).url;
            }
          } else if (
            'url' in response &&
            typeof (response as any).url === 'string'
          ) {
            qrUrl = (response as any).url;
          } else if (
            'qrCode' in response &&
            typeof (response as any).qrCode === 'string'
          ) {
            qrUrl = (response as any).qrCode;
          }

          if (typeof qrUrl === 'string' && qrUrl.length > 0) {
            setQrCodeUrl(qrUrl);
            setShowQRCode(true);
            return;
          }
        }
      } catch (qrError) {
        console.warn('productService.generateQRCode failed:', qrError);
      }

      // Fallback: public QR server
      const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
        JSON.stringify(qrData)
      )}`;
      setQrCodeUrl(fallbackUrl);
      setShowQRCode(true);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      setError('Failed to generate QR code. Please try again.');
      toast.error('Failed to generate QR code');
    } finally {
      setGeneratingQR(false);
    }
  };

  // ============================================
  // COPY TO CLIPBOARD
  // ============================================

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(label);
        toast.success(`${label} copied to clipboard`);
        setTimeout(() => setCopied(null), 2000);
      })
      .catch(() => {
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

    return () => {
      loadedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [id, fetchInventoryItem]);

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            Loading inventory item...
          </p>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            Item Not Found
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            The inventory item you're looking for doesn't exist or has been
            removed.
          </p>
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
  const stockStatus = getStockStatus(
    availableStock,
    item.reorderPoint || 5
  );
  const stockStatusColor = getStockStatusColor(stockStatus.status);

  const images =
    item.images && item.images.length > 0
      ? item.images
      : toImageUrls(item.product?.images);
  const hasImages = images.length > 0;
  const tags =
    item.tags && item.tags.length > 0
      ? item.tags
      : item.product?.tags || [];

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-300 font-medium">
              Error
            </p>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-800/30 rounded-lg transition"
          >
            <X className="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                {item.name}
              </h1>
              <span
                className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${stockStatusColor} flex-shrink-0`}
              >
                {stockStatus.label}
              </span>
              {!item.isActive && (
                <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-full flex-shrink-0">
                  Inactive
                </span>
              )}
              {item.featured && (
                <span className="px-2.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs font-medium rounded-full flex items-center gap-1 flex-shrink-0">
                  <Star className="w-3 h-3" /> Featured
                </span>
              )}
              {item.isDigital && (
                <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full flex items-center gap-1 flex-shrink-0">
                  <Globe className="w-3 h-3" /> Digital
                </span>
              )}
            </div>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm truncate">
              SKU: {item.sku || 'N/A'}
              {businessUnitName && (
                <span className="ml-4 inline-flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                  {businessUnitName}
                </span>
              )}
              {item.category && item.category !== 'Uncategorized' && (
                <span className="ml-4 inline-flex items-center gap-1">
                  <TagIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  {item.category}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          <button
            onClick={refreshItem}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            aria-label="Refresh"
            disabled={refreshing}
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            />
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
                onClick={() =>
                  router.push(`/admin/inventory/${item.id}/edit`)
                }
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
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Current Stock
          </p>
          <p
            className={`text-2xl font-bold ${
              stockStatus.status === 'out_of_stock'
                ? 'text-red-600 dark:text-red-400'
                : stockStatus.status === 'low_stock'
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-green-600 dark:text-green-400'
            }`}
          >
            {item.quantity || 0}
          </p>
          {item.reserved && item.reserved > 0 && (
            <p className="text-xs text-gray-400">
              ({item.reserved} reserved)
            </p>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Available
          </p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {availableStock}
          </p>
          <p className="text-xs text-gray-400">
            Reorder at {item.reorderPoint || 5}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Unit Price
          </p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {formatCurrency(item.unitPrice || 0)}
          </p>
          <p className="text-xs text-gray-400">
            Total Value:{' '}
            {formatCurrency(
              (item.unitPrice || 0) * (item.quantity || 0)
            )}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Net Change
          </p>
          <p
            className={`text-2xl font-bold ${
              (item.stats?.netChange || 0) >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {(item.stats?.netChange || 0) >= 0 ? '+' : ''}
            {item.stats?.netChange || 0}
          </p>
          <p className="text-xs text-gray-400">
            In: {item.stats?.totalIn || 0} | Out: {item.stats?.totalOut || 0}
          </p>
        </div>
      </div>

      {/* DETAILS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Item Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Name
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {item.name}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                SKU
              </p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-gray-900 dark:text-white">
                  {item.sku || 'N/A'}
                </p>
                {item.sku && (
                  <button
                    onClick={() => handleCopy(item.sku, 'SKU')}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    aria-label="Copy SKU"
                  >
                    {copied === 'SKU' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-gray-400" />
                    )}
                  </button>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Barcode
              </p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-gray-900 dark:text-white">
                  {item.barcode || 'N/A'}
                </p>
                {item.barcode && (
                  <button
                    onClick={() =>
                      handleCopy(item.barcode || '', 'Barcode')
                    }
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    aria-label="Copy barcode"
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
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Unit Price
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(item.unitPrice || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Location
              </p>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <p className="text-gray-900 dark:text-white">
                  {item.location || 'Not specified'}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Reorder Point
              </p>
              <p className="text-gray-900 dark:text-white">
                {item.reorderPoint || 5}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Weight
              </p>
              <div className="flex items-center gap-2">
                <Weight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <p className="text-gray-900 dark:text-white">
                  {item.weight ? `${item.weight.toFixed(3)} kg` : 'N/A'}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Tax Rate
              </p>
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <p className="text-gray-900 dark:text-white">
                  {item.taxRate ? `${item.taxRate}%` : '0%'}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Category
              </p>
              <p className="text-gray-900 dark:text-white">
                {item.category || 'Uncategorized'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Supplier
              </p>
              <p className="text-gray-900 dark:text-white">
                {item.supplier || 'N/A'}
              </p>
            </div>
            {item.expiryDate && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Expiry Date
                </p>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <p className="text-gray-900 dark:text-white">
                    {formatDate(item.expiryDate)}
                  </p>
                </div>
              </div>
            )}
            {item.batchNumber && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Batch Number
                </p>
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <p className="text-gray-900 dark:text-white">
                    {item.batchNumber}
                  </p>
                </div>
              </div>
            )}
            <div className="sm:col-span-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Description
              </p>
              <p className="text-gray-900 dark:text-white">
                {item.description || 'No description provided'}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tags.length > 0 ? (
                  tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1"
                    >
                      <TagIcon className="w-3 h-3" />
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-400 text-sm">No tags</span>
                )}
              </div>
            </div>
            {item.notes && (
              <div className="sm:col-span-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Notes
                </p>
                <p className="text-gray-900 dark:text-white text-sm">
                  {item.notes}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Created
              </p>
              <p className="text-gray-900 dark:text-white text-sm">
                {formatDate(item.createdAt || new Date().toISOString())}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Last Updated
              </p>
              <p className="text-gray-900 dark:text-white text-sm">
                {formatDate(item.updatedAt || new Date().toISOString())}
              </p>
            </div>
          </div>

          {/* Image Gallery */}
          {hasImages && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-500" />
                Images ({images.length})
              </p>
              <div className="flex flex-wrap gap-3">
                {images.slice(0, 6).map((image, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSelectedImage(image);
                      setShowImageModal(true);
                    }}
                    className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-600 hover:ring-2 hover:ring-blue-500 hover:border-blue-500 transition-all group"
                  >
                    <img
                      src={image}
                      alt={`${item.name} - Image ${index + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          '/images/placeholder-image.png';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    {index === 5 && images.length > 6 && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-sm font-medium">
                        +{images.length - 6}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions Sidebar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Actions
          </h3>

          <button
            onClick={() => window.print()}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors text-left"
          >
            <Printer className="w-4 h-4 text-gray-500" />
            <span>Print Details</span>
          </button>

          {item.barcode && (
            <button
              onClick={() => {
                const barcodeValue = item.barcode || '';
                const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(
                  barcodeValue
                )}&code=EAN-13&dpi=96`;
                window.open(barcodeUrl, '_blank');
              }}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors text-left"
            >
              <Barcode className="w-4 h-4 text-gray-500" />
              <span>View Barcode</span>
            </button>
          )}

          <button
            onClick={generateQRCode}
            disabled={generatingQR}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors text-left disabled:opacity-50"
          >
            {generatingQR ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            ) : (
              <QrCode className="w-4 h-4 text-gray-500" />
            )}
            <span>{generatingQR ? 'Generating...' : 'Generate QR Code'}</span>
          </button>

          {item.barcode && (
            <button
              onClick={() => handleCopy(item.barcode || '', 'Barcode')}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors text-left"
            >
              {copied === 'Barcode' ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-gray-500" />
              )}
              <span>{copied === 'Barcode' ? 'Copied!' : 'Copy Barcode'}</span>
            </button>
          )}

          {item.sku && (
            <button
              onClick={() => handleCopy(item.sku, 'SKU')}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors text-left"
            >
              {copied === 'SKU' ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-gray-500" />
              )}
              <span>{copied === 'SKU' ? 'Copied!' : 'Copy SKU'}</span>
            </button>
          )}

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Item ID: {item.id}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Product ID: {item.productId || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* TRANSACTIONS */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            Transaction History
          </h3>
          <span className="text-sm text-gray-500">
            {transactions.length} transactions
          </span>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {transactions.slice(0, 50).map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getTransactionTypeColor(
                          transaction.transactionType
                        )}`}
                      >
                        {getTransactionIcon(transaction.transactionType)}
                        {transaction.transactionType}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 font-medium ${
                        transaction.quantity > 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {transaction.quantity > 0 ? '+' : ''}
                      {transaction.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(transaction.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {transaction.user?.firstName}{' '}
                      {transaction.user?.lastName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                      {transaction.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {transactions.length > 50 && (
            <div className="px-6 py-3 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
              Showing 50 of {transactions.length} transactions
            </div>
          )}
        </div>
      </div>

      {/* STOCK UPDATE MODAL */}
      <AnimatePresence>
        {showStockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowStockModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Update Stock
                </h3>
                <button
                  onClick={() => setShowStockModal(false)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Transaction Type
                  </label>
                  <select
                    value={stockUpdate.transactionType}
                    onChange={(e) =>
                      setStockUpdate({
                        ...stockUpdate,
                        transactionType: e.target.value as any,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="ADJUSTMENT_IN">
                      Add Stock (Adjustment In)
                    </option>
                    <option value="ADJUSTMENT_OUT">
                      Remove Stock (Adjustment Out)
                    </option>
                    <option value="PURCHASE">Purchase</option>
                    <option value="RESTOCK">Restock</option>
                    <option value="RETURN">Return</option>
                    <option value="SALE">Sale</option>
                    <option value="ISSUE">Issue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={stockUpdate.quantity}
                    onChange={(e) =>
                      setStockUpdate({
                        ...stockUpdate,
                        quantity: Math.max(
                          1,
                          parseInt(e.target.value) || 0
                        ),
                      })
                    }
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
                    onChange={(e) =>
                      setStockUpdate({
                        ...stockUpdate,
                        notes: e.target.value,
                      })
                    }
                    rows={2}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                    placeholder="Reason for stock update..."
                  />
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
                  <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>
                    Current stock: <strong>{item.quantity || 0}</strong>
                  </span>
                  <span className="mx-2">|</span>
                  <span>
                    Available: <strong>{availableStock}</strong>
                  </span>
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
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowDeleteModal(false)}
            />
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
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Delete Inventory Item
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Are you sure you want to delete{' '}
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    "{item.name}"
                  </span>
                  ? This action cannot be undone.
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
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowQRCode(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  QR Code
                </h3>
                <button
                  onClick={() => setShowQRCode(false)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="flex justify-center">
                {qrCodeUrl && (
                  <img
                    src={qrCodeUrl}
                    alt={`QR Code for ${item.name}`}
                    className="max-w-full h-auto rounded-lg shadow-md"
                    onError={() => {
                      setQrCodeUrl(null);
                      toast.error('Failed to load QR code image');
                    }}
                  />
                )}
              </div>
              <p className="text-center text-sm text-gray-600 dark:text-gray-300 mt-4 font-medium">
                {item.name}
              </p>
              <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                SKU: {item.sku || 'N/A'} • Price:{' '}
                {formatCurrency(item.unitPrice || 0)}
              </p>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    if (qrCodeUrl) {
                      const link = document.createElement('a');
                      link.href = qrCodeUrl;
                      link.download = `qrcode-${(
                        item.sku || 'item'
                      ).toLowerCase()}.png`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => setShowQRCode(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Gallery Modal */}
      <AnimatePresence>
        {showImageModal && selectedImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowImageModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-4xl max-h-[90vh] w-full"
            >
              <button
                onClick={() => setShowImageModal(false)}
                className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
                aria-label="Close image"
              >
                <X className="w-8 h-8" />
              </button>
              <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-2xl">
                <div className="flex justify-center p-4 bg-black/5 dark:bg-black/20">
                  <img
                    src={selectedImage}
                    alt={item.name}
                    className="max-w-full max-h-[70vh] object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        '/images/placeholder-image.png';
                    }}
                  />
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-center text-sm font-medium text-gray-900 dark:text-white">
                    {item.name}
                  </p>
                  <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                    {item.sku ? `SKU: ${item.sku}` : ''}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
