'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, ArrowLeft, Edit, RefreshCw, AlertTriangle,
  TrendingUp, TrendingDown, Clock, User, MapPin,
  Calendar, DollarSign, BarChart3, History,
  Download, Printer, Plus, Minus, X, CheckCircle,
  AlertCircle, Truck, Building, Phone, Mail,
  Barcode, QrCode, Scan, Copy, Link2, Eye,
  Loader2, Info, Shield, Award, Tag, Layers,
  MoreVertical, ChevronDown, ChevronRight,
  FileText, ShoppingCart, Users, Zap, Lock,
  Save, Trash2, ExternalLink, Grid, List,
  Weight, Percent, Hash, Globe, Star, Archive,
  CalendarDays, Image as ImageIcon,
} from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { barcodeService } from '../../services/barcodeService';
import { toast } from '../../utils/toast-manager';
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { PermissionResource } from '../../types/enums';

interface InventoryDetailData {
  id: string;
  productId: string;
  businessUnitId?: string;
  product: {
    id: string;
    name: string;
    sku: string;
    barcode?: string;
    unitPrice: number;
    costPrice: number;
    category?: { id: string; name: string };
    images?: string[];
    description?: string;
    minStock?: number;
    maxStock?: number;
    taxRate?: number;
    weight?: number;
  };
  variantId?: string;
  variant?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    attributes: Record<string, any>;
  };
  quantity: number;
  reserved: number;
  reorderPoint: number;
  reorderQuantity: number;
  location: string;
  shelfNumber?: string;
  supplier?: string;
  supplierId?: string;
  supplierDetails?: {
    name: string;
    contactPerson: string;
    phone: string;
    email: string;
  };
  notes?: string;
  status: string;
  unit?: string;
  weight?: number;
  taxRate?: number;
  tags?: string[];
  isActive?: boolean;
  isDigital?: boolean;
  featured?: boolean;
  expiryDate?: string;
  batchNumber?: string;
  transactions: Array<{
    id: string;
    transactionType: string;
    quantity: number;
    notes?: string;
    createdAt: string;
    user: { firstName: string; lastName: string };
  }>;
  issues: Array<{
    id: string;
    issuedTo: string;
    quantity: number;
    purpose?: string;
    status: string;
    expectedReturnDate?: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface BarcodeInfo {
  barcode: string;
  barcodeUrl: string;
  qrCodeUrl: string;
  isGenerated: boolean;
}

interface AdjustmentData {
  quantity: number;
  type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  notes: string;
}

const StatusBadge: React.FC<{
  status: string;
  quantity: number;
  reorderPoint: number;
}> = ({ status, quantity, reorderPoint }) => {
  if (quantity === 0) {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-2xs font-medium bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-300 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" /> Out of Stock
      </span>
    );
  }
  if (quantity <= reorderPoint) {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-2xs font-medium bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" /> Low Stock
      </span>
    );
  }
  return (
    <span className="px-2.5 py-0.5 rounded-full text-2xs font-medium bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300 flex items-center gap-1">
      <CheckCircle className="w-3 h-3" /> In Stock
    </span>
  );
};

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtext?: string;
}> = ({ label, value, icon: Icon, color, subtext }) => {
  const colorClasses: Record<string, string> = {
    blue: 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400',
    green:
      'bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400',
    yellow:
      'bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400',
    red: 'bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400',
    purple:
      'bg-secondary-50 dark:bg-secondary-900/20 text-secondary-600 dark:text-secondary-400',
    orange:
      'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400',
    indigo:
      'bg-secondary-50 dark:bg-secondary-900/20 text-secondary-600 dark:text-secondary-400',
    teal: 'bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400',
  };

  return (
    <div className="card-brand !p-4 hover:shadow-card-hover transition-shadow">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <div className={`p-1.5 rounded-lg ${colorClasses[color] || colorClasses.blue}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
        {value}
      </p>
      {subtext && (
        <p className="text-2xs text-gray-400 dark:text-gray-500 mt-1 tabular-nums">
          {subtext}
        </p>
      )}
    </div>
  );
};

export function InventoryDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { canView, canEdit, canDelete, canManage } = usePermission();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [item, setItem] = useState<InventoryDetailData | null>(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [barcodeInfo, setBarcodeInfo] = useState<BarcodeInfo | null>(null);
  const [loadingBarcode, setLoadingBarcode] = useState(false);

  const [adjustmentData, setAdjustmentData] = useState<AdjustmentData>({
    quantity: 0,
    type: 'ADJUSTMENT_IN',
    notes: '',
  });
  const [issueData, setIssueData] = useState({
    issuedTo: '',
    quantity: 1,
    purpose: '',
    remarks: '',
    expectedReturnDate: '',
  });
  const [restockData, setRestockData] = useState({
    quantity: 1,
    supplier: '',
    unitPrice: 0,
    purchaseDate: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [copiedSku, setCopiedSku] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canViewInventory =
    canView?.(`${PermissionResource.INVENTORY}:view`) ||
    canManage?.(`${PermissionResource.INVENTORY}:manage`) ||
    user?.role === 'SUPER_ADMIN' ||
    false;
  const canEditInventory =
    canEdit?.(`${PermissionResource.INVENTORY}:edit`) ||
    canManage?.(`${PermissionResource.INVENTORY}:manage`) ||
    user?.role === 'SUPER_ADMIN' ||
    false;
  const canDeleteInventory =
    canDelete?.(`${PermissionResource.INVENTORY}:delete`) ||
    canManage?.(`${PermissionResource.INVENTORY}:manage`) ||
    user?.role === 'SUPER_ADMIN' ||
    false;
  const canAdjustInventory =
    canManage?.(`${PermissionResource.INVENTORY}:manage`) ||
    user?.role === 'SUPER_ADMIN' ||
    false;

  const getBusinessUnitId = useCallback((): string => {
    if (item?.businessUnitId) return item.businessUnitId;

    const units = user?.businessUnits;
    if (units && units.length > 0) {
      const firstUnit = units[0] as any;
      return firstUnit?.businessUnitId || firstUnit?.id || '';
    }

    return localStorage.getItem('businessUnitId') || '';
  }, [item, user]);

  const loadItem = useCallback(
    async (showLoading = true) => {
      if (!id || !canViewInventory) {
        setLoading(false);
        return;
      }
      setError(null);
      try {
        if (showLoading) setLoading(true);
        if (!showLoading) setRefreshing(true);

        const data: any = await inventoryService.getInventoryItemById(id);

        if (data === null) {
          toast.error('Item not found');
          router.push('/admin/inventory');
          return;
        }

        const inventoryData = data.data || data;
        const mappedData = mapInventoryData(inventoryData);
        setItem(mappedData);

        if (mappedData.product.barcode) {
          await loadBarcodeInfo(mappedData.product.barcode);
        }
      } catch (error: any) {
        console.error('Failed to load inventory item:', error);
        if (error?.response?.status === 404 || error?.status === 404) {
          toast.error('Item not found');
          router.push('/admin/inventory');
        } else {
          const errorMsg = error?.message || 'Failed to load inventory item';
          setError(errorMsg);
          toast.error(errorMsg);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, router, canViewInventory]
  );

  const mapInventoryData = (data: any): InventoryDetailData => {
    if (data && data.product && data.product.name) {
      return {
        id: data.id || '',
        productId: data.productId || data.product?.id || '',
        businessUnitId:
          data.businessUnitId || data.product?.businessUnitId || '',
        product: {
          id: data.product?.id || data.productId || '',
          name: data.product?.name || data.name || 'Unknown Product',
          sku: data.product?.sku || data.sku || 'N/A',
          barcode: data.product?.barcode || data.barcode || undefined,
          unitPrice:
            data.product?.unitPrice || data.unitPrice || data.price || 0,
          costPrice: data.product?.costPrice || data.costPrice || 0,
          category: data.product?.category
            ? {
                id: data.product.category.id,
                name: data.product.category.name,
              }
            : data.category
            ? { id: data.categoryId || '', name: data.category }
            : undefined,
          images: data.product?.images || data.images || [],
          description:
            data.product?.description || data.description || undefined,
          minStock:
            data.product?.minStock ||
            data.minStock ||
            data.reorderPoint ||
            5,
          maxStock:
            data.product?.maxStock ||
            data.maxStock ||
            data.reorderQuantity ||
            100,
          taxRate: data.product?.taxRate || data.taxRate || 0,
          weight: data.product?.weight || data.weight || 0,
        },
        variantId: data.variantId || undefined,
        variant: data.variant
          ? {
              id: data.variant.id || '',
              name: data.variant.name || '',
              sku: data.variant.sku || '',
              price: data.variant.price || 0,
              attributes: data.variant.attributes || {},
            }
          : undefined,
        quantity: data.quantity || data.stock || 0,
        reserved: data.reserved || 0,
        reorderPoint: data.reorderPoint || data.minStock || 5,
        reorderQuantity: data.reorderQuantity || data.maxStock || 10,
        location: data.location || 'Warehouse',
        shelfNumber: data.shelfNumber || undefined,
        supplier: data.supplier || data.product?.supplier?.name || undefined,
        supplierId: data.supplierId || data.product?.supplierId || undefined,
        supplierDetails: data.supplierDetails || undefined,
        notes: data.notes || undefined,
        status:
          data.status || (data.isActive === false ? 'inactive' : 'active'),
        unit: data.unit || 'each',
        weight: data.weight || 0,
        taxRate: data.taxRate || 0,
        tags: data.tags || [],
        isActive: data.isActive !== undefined ? data.isActive : true,
        isDigital: data.isDigital || false,
        featured: data.featured || false,
        expiryDate: data.expiryDate || undefined,
        batchNumber: data.batchNumber || undefined,
        transactions: (data.transactions || []).map((tx: any) => ({
          id: tx.id || '',
          transactionType: tx.transactionType || 'UNKNOWN',
          quantity: tx.quantity || 0,
          notes: tx.notes,
          createdAt: tx.createdAt || new Date().toISOString(),
          user: {
            firstName: tx.user?.firstName || 'System',
            lastName: tx.user?.lastName || '',
          },
        })),
        issues: (data.issues || []).map((issue: any) => ({
          id: issue.id || '',
          issuedTo: issue.issuedTo || 'Unknown',
          quantity: issue.quantity || 0,
          purpose: issue.purpose,
          status: issue.status || 'ISSUED',
          expectedReturnDate: issue.expectedReturnDate,
          createdAt: issue.createdAt || new Date().toISOString(),
        })),
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    }

    if (data && data.inventory) {
      const inv = data.inventory;
      return {
        id: inv.id || data.id || '',
        productId: data.id || '',
        businessUnitId: data.businessUnitId || inv.businessUnitId || '',
        product: {
          id: data.id || '',
          name: data.name || 'Unknown Product',
          sku: data.sku || 'N/A',
          barcode: data.barcode || undefined,
          unitPrice: data.unitPrice || 0,
          costPrice: data.costPrice || 0,
          category: data.category
            ? { id: data.category.id || '', name: data.category.name || '' }
            : undefined,
          images: data.images || [],
          description: data.description || undefined,
          minStock: data.minStock || inv.reorderPoint || 5,
          maxStock: data.maxStock || inv.reorderQuantity || 100,
          taxRate: data.taxRate || 0,
          weight: data.weight || 0,
        },
        variantId: inv.variantId || undefined,
        variant: inv.variant
          ? {
              id: inv.variant.id || '',
              name: inv.variant.name || '',
              sku: inv.variant.sku || '',
              price: inv.variant.price || 0,
              attributes: inv.variant.attributes || {},
            }
          : undefined,
        quantity: inv.quantity || 0,
        reserved: inv.reserved || 0,
        reorderPoint: inv.reorderPoint || data.minStock || 5,
        reorderQuantity: inv.reorderQuantity || data.maxStock || 10,
        location: inv.location || 'Warehouse',
        shelfNumber: inv.shelfNumber || undefined,
        supplier: inv.supplier || data.supplier?.name || undefined,
        supplierId: inv.supplierId || data.supplierId || undefined,
        supplierDetails: data.supplierDetails || undefined,
        notes: inv.notes || undefined,
        status: inv.status || 'active',
        unit: 'each',
        weight: data.weight || 0,
        taxRate: data.taxRate || 0,
        tags: data.tags || [],
        isActive: data.isActive !== undefined ? data.isActive : true,
        isDigital: data.isDigital || false,
        featured: data.featured || false,
        expiryDate: data.expiryDate || undefined,
        batchNumber: data.batchNumber || undefined,
        transactions: (inv.transactions || data.transactions || []).map(
          (tx: any) => ({
            id: tx.id || '',
            transactionType: tx.transactionType || 'UNKNOWN',
            quantity: tx.quantity || 0,
            notes: tx.notes,
            createdAt: tx.createdAt || new Date().toISOString(),
            user: {
              firstName: tx.user?.firstName || 'System',
              lastName: tx.user?.lastName || '',
            },
          })
        ),
        issues: (inv.issues || data.issues || []).map((issue: any) => ({
          id: issue.id || '',
          issuedTo: issue.issuedTo || 'Unknown',
          quantity: issue.quantity || 0,
          purpose: issue.purpose,
          status: issue.status || 'ISSUED',
          expectedReturnDate: issue.expectedReturnDate,
          createdAt: issue.createdAt || new Date().toISOString(),
        })),
        createdAt: inv.createdAt || data.createdAt || new Date().toISOString(),
        updatedAt: inv.updatedAt || data.updatedAt || new Date().toISOString(),
      };
    }

    return {
      id: data.id || '',
      productId: data.productId || '',
      businessUnitId: data.businessUnitId || '',
      product: {
        id: data.productId || data.id || '',
        name: data.name || 'Unknown Product',
        sku: data.sku || 'N/A',
        barcode: data.barcode || undefined,
        unitPrice: data.unitPrice || data.price || 0,
        costPrice: data.costPrice || 0,
        category: data.category
          ? { id: data.categoryId || '', name: data.category }
          : undefined,
        images: data.images || [],
        description: data.description || undefined,
        minStock: data.minStock || data.reorderPoint || 5,
        maxStock: data.maxStock || data.reorderQuantity || 100,
        taxRate: data.taxRate || 0,
        weight: data.weight || 0,
      },
      variantId: data.variantId || undefined,
      variant: data.variant
        ? {
            id: data.variant.id || '',
            name: data.variant.name || '',
            sku: data.variant.sku || '',
            price: data.variant.price || 0,
            attributes: data.variant.attributes || {},
          }
        : undefined,
      quantity: data.quantity || data.stock || 0,
      reserved: data.reserved || 0,
      reorderPoint: data.reorderPoint || data.minStock || 5,
      reorderQuantity: data.reorderQuantity || data.maxStock || 10,
      location: data.location || 'Warehouse',
      shelfNumber: data.shelfNumber || undefined,
      supplier: data.supplier || undefined,
      supplierId: data.supplierId || undefined,
      supplierDetails: data.supplierDetails || undefined,
      notes: data.notes || undefined,
      status: data.status || 'active',
      unit: data.unit || 'each',
      weight: data.weight || 0,
      taxRate: data.taxRate || 0,
      tags: data.tags || [],
      isActive: data.isActive !== undefined ? data.isActive : true,
      isDigital: data.isDigital || false,
      featured: data.featured || false,
      expiryDate: data.expiryDate || undefined,
      batchNumber: data.batchNumber || undefined,
      transactions: (data.transactions || []).map((tx: any) => ({
        id: tx.id || '',
        transactionType: tx.transactionType || 'UNKNOWN',
        quantity: tx.quantity || 0,
        notes: tx.notes,
        createdAt: tx.createdAt || new Date().toISOString(),
        user: {
          firstName: tx.user?.firstName || 'System',
          lastName: tx.user?.lastName || '',
        },
      })),
      issues: (data.issues || []).map((issue: any) => ({
        id: issue.id || '',
        issuedTo: issue.issuedTo || 'Unknown',
        quantity: issue.quantity || 0,
        purpose: issue.purpose,
        status: issue.status || 'ISSUED',
        expectedReturnDate: issue.expectedReturnDate,
        createdAt: issue.createdAt || new Date().toISOString(),
      })),
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  };

  const loadBarcodeInfo = async (barcode: string) => {
    if (!item) return;
    try {
      setLoadingBarcode(true);
      const [barcodeImage, qrCode] = await Promise.all([
        barcodeService.generateBarcodeImage(barcode),
        barcodeService.generateQRCode({
          itemName: item.product.name,
          sku: item.product.sku,
          barcode,
          price: item.product.unitPrice,
          type: 'INVENTORY_ITEM',
          id: item.id,
        }),
      ]);
      setBarcodeInfo({
        barcode,
        barcodeUrl: barcodeImage.barcodeUrl,
        qrCodeUrl: qrCode.qrCodeUrl,
        isGenerated: true,
      });
    } catch {
      setBarcodeInfo({
        barcode,
        barcodeUrl: `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(
          barcode
        )}&code=CODE128&dpi=96`,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
          JSON.stringify({ barcode, item: item?.product?.name })
        )}&size=200x200`,
        isGenerated: true,
      });
    } finally {
      setLoadingBarcode(false);
    }
  };

  const handleGenerateBarcode = async () => {
    if (!item || !id) return;
    setGeneratingBarcode(true);
    setError(null);
    try {
      const businessUnitId = getBusinessUnitId();
      const result: any = await inventoryService.generateInventoryBarcode(
        id,
        businessUnitId
      );
      const barcode =
        result.barcode ||
        (result as any)?.barcodeRecord?.barcode ||
        result.barcodeRecord?.code;

      setItem((prev) =>
        prev ? { ...prev, product: { ...prev.product, barcode } } : null
      );

      const [barcodeImage, qrCode] = await Promise.all([
        barcodeService.generateBarcodeImage(barcode),
        barcodeService.generateQRCode({
          itemName: item.product.name,
          sku: item.product.sku,
          barcode,
          type: 'INVENTORY_ITEM',
        }),
      ]);

      setBarcodeInfo({
        barcode,
        barcodeUrl: barcodeImage.barcodeUrl,
        qrCodeUrl: qrCode.qrCodeUrl,
        isGenerated: true,
      });
      setShowBarcode(true);
      toast.success('Barcode generated successfully');
    } catch (error: any) {
      console.error('Failed to generate barcode:', error);
      const errorMsg = error?.message || 'Failed to generate barcode';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setGeneratingBarcode(false);
    }
  };

  const handleCopyBarcode = async () => {
    if (!barcodeInfo?.barcode) return;
    try {
      await navigator.clipboard.writeText(barcodeInfo.barcode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Barcode copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handlePrintBarcode = () => {
    if (!barcodeInfo || !item) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Barcode - ${item.product.name}</title>
      <style>body{font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:white}.container{text-align:center;padding:30px;border:1px solid #ddd;border-radius:8px;max-width:400px}.barcode-img{max-width:300px;margin:15px 0}.qr-img{max-width:150px;margin:10px 0}.info{margin-top:15px}.info p{margin:5px 0;font-size:14px}.info .label{color:#666}.info .value{font-weight:bold}.product-name{margin:0 0 5px 0;color:#1a1a1a}.sku{color:#666;font-size:12px;margin:0 0 15px 0}</style>
      </head><body><div class="container"><h2 class="product-name">${item.product.name}</h2><p class="sku">SKU: ${item.product.sku || 'N/A'}</p>
      ${barcodeInfo.barcodeUrl ? `<img src="${barcodeInfo.barcodeUrl}" alt="Barcode" class="barcode-img" />` : ''}
      ${barcodeInfo.qrCodeUrl ? `<img src="${barcodeInfo.qrCodeUrl}" alt="QR Code" class="qr-img" />` : ''}
      <div class="info"><p><span class="label">Barcode:</span> <span class="value">${barcodeInfo.barcode}</span></p><p><span class="label">Price:</span> <span class="value">$${item.product.unitPrice.toFixed(2)}</span></p><p><span class="label">Stock:</span> <span class="value">${item.quantity}</span></p><p><span class="label">Location:</span> <span class="value">${item.location || 'Warehouse'}</span></p></div></div>
      <script>window.onload=function(){window.print()}<\/script></body></html>
    `);
    printWindow.document.close();
  };

  const handleDownloadBarcode = () => {
    if (!barcodeInfo?.barcodeUrl) return;
    const link = document.createElement('a');
    link.href = barcodeInfo.barcodeUrl;
    link.download = `barcode-${
      item?.product?.sku || item?.product?.barcode || 'item'
    }.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Barcode downloaded');
  };

  const handleCopySku = async () => {
    if (!item?.product?.sku) return;
    try {
      await navigator.clipboard.writeText(item.product.sku);
      setCopiedSku(true);
      toast.success('SKU copied');
      setTimeout(() => setCopiedSku(false), 2000);
    } catch {
      toast.error('Failed to copy SKU');
    }
  };

  const handleAdjustment = async () => {
    if (!id || !item) return;
    if (adjustmentData.quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }
    if (
      adjustmentData.type === 'ADJUSTMENT_OUT' &&
      adjustmentData.quantity > item.quantity
    ) {
      toast.error('Cannot remove more than current stock');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await inventoryService.updateStock(id, {
        quantity: adjustmentData.quantity,
        notes: adjustmentData.notes || 'Stock adjustment',
        transactionType: adjustmentData.type,
      });
      toast.success('Stock adjusted successfully');
      setShowAdjustmentModal(false);
      setAdjustmentData({ quantity: 0, type: 'ADJUSTMENT_IN', notes: '' });
      await loadItem(false);
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to adjust stock';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleIssue = async () => {
    if (!id || !item) return;
    if (!issueData.issuedTo) {
      toast.error('Recipient name is required');
      return;
    }
    if (issueData.quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }
    if (issueData.quantity > item.quantity) {
      toast.error('Insufficient stock available');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await inventoryService.issueItem(id, {
        issuedTo: issueData.issuedTo,
        quantity: issueData.quantity,
        purpose: issueData.purpose || undefined,
        remarks: issueData.remarks || undefined,
        expectedReturnDate: issueData.expectedReturnDate || undefined,
      });
      toast.success('Item issued successfully');
      setShowIssueModal(false);
      setIssueData({
        issuedTo: '',
        quantity: 1,
        purpose: '',
        remarks: '',
        expectedReturnDate: '',
      });
      await loadItem(false);
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to issue item';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestock = async () => {
    if (!id || !item) return;
    if (restockData.quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await inventoryService.restockItem(id, {
        quantity: restockData.quantity,
        supplier: restockData.supplier || undefined,
        unitPrice: restockData.unitPrice || undefined,
        purchaseDate: restockData.purchaseDate || undefined,
        notes: restockData.notes || undefined,
      });
      toast.success('Item restocked successfully');
      setShowRestockModal(false);
      setRestockData({
        quantity: 1,
        supplier: '',
        unitPrice: 0,
        purchaseDate: '',
        notes: '',
      });
      await loadItem(false);
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to restock item';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setSubmitting(true);
    setError(null);
    try {
      await inventoryService.deleteInventoryItem(id);
      toast.success('Item deleted successfully');
      router.push('/admin/inventory');
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to delete item';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
      setShowDeleteModal(false);
    }
  };

  const getStatusInfo = (item: InventoryDetailData) => {
    const quantity = item.quantity || 0;
    const reorderPoint = item.reorderPoint || 5;
    if (quantity === 0)
      return {
        label: 'Out of Stock',
        color:
          'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-300',
        icon: AlertCircle,
        iconColor: 'text-danger-500',
        severity: 'critical',
        action: 'Restock Now',
      };
    if (quantity <= reorderPoint)
      return {
        label: 'Low Stock',
        color:
          'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300',
        icon: AlertTriangle,
        iconColor: 'text-warning-500',
        severity: 'warning',
        action: 'Restock',
      };
    return {
      label: 'In Stock',
      color:
        'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300',
      icon: CheckCircle,
      iconColor: 'text-success-500',
      severity: 'good',
      action: null,
    };
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'PURCHASE':
      case 'RESTOCK':
      case 'ADJUSTMENT_IN':
      case 'TRANSFER_IN':
      case 'INITIAL':
        return <TrendingUp className="w-4 h-4 text-success-500" />;
      case 'SALE':
      case 'ISSUE':
      case 'ADJUSTMENT_OUT':
      case 'TRANSFER_OUT':
      case 'DAMAGED':
      case 'LOST':
        return <TrendingDown className="w-4 h-4 text-danger-500" />;
      case 'RETURN':
        return <RefreshCw className="w-4 h-4 text-brand-500" />;
      default:
        return <RefreshCw className="w-4 h-4 text-gray-500" />;
    }
  };

  const getIssueStatusColor = (status: string) => {
    switch (status) {
      case 'RETURNED':
        return 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300';
      case 'ISSUED':
        return 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300';
      case 'OVERDUE':
        return 'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-300';
      case 'LOST':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'DAMAGED':
        return 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Please Login
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You need to be logged in to view inventory details.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="mt-4 px-6 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all focus-ring"
        >
          Go to Login
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            Loading item details...
          </p>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-400">
          Item not found
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          The item you're looking for doesn't exist or has been removed.
        </p>
        <button
          onClick={() => router.push('/admin/inventory')}
          className="mt-4 px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all focus-ring"
        >
          Back to Inventory
        </button>
      </div>
    );
  }

  const status = getStatusInfo(item);
  const StatusIcon = status.icon;
  const quantity = item.quantity || 0;
  const reserved = item.reserved || 0;
  const availableStock = quantity - reserved;
  const isLowStock = quantity <= (item.reorderPoint || 5) && quantity > 0;
  const isOutOfStock = quantity === 0;
  const itemPrice = item.product.unitPrice || 0;
  const totalValue = quantity * itemPrice;
  const hasBarcode = !!item.product.barcode || !!barcodeInfo;

  const images = item.product.images || [];
  const hasImages = images.length > 0;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 animate-fade-in">
      {error && (
        <div className="mb-6 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-2xl flex items-start gap-3 animate-slide-down">
          <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-danger-800 dark:text-danger-200">
              Error
            </p>
            <p className="text-sm text-danger-700 dark:text-danger-300">
              {error}
            </p>
          </div>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-danger-100 dark:hover:bg-danger-800/30 rounded-lg transition-colors focus-ring"
          >
            <X className="w-4 h-4 text-danger-600 dark:text-danger-400" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => router.push('/admin/inventory')}
            className="p-2 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0 focus-ring"
            aria-label="Back to inventory"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                {item.product.name}
              </h1>
              <StatusBadge
                status={item.status}
                quantity={item.quantity}
                reorderPoint={item.reorderPoint}
              />
              {item.isActive === false && (
                <span className="px-2.5 py-0.5 rounded-full text-2xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                  Inactive
                </span>
              )}
              {item.featured && (
                <span className="px-2.5 py-0.5 rounded-full text-2xs font-medium bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300">
                  <Award className="w-3 h-3 inline mr-0.5" />
                  Featured
                </span>
              )}
              {item.isDigital && (
                <span className="px-2.5 py-0.5 rounded-full text-2xs font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                  <Globe className="w-3 h-3 inline mr-0.5" />
                  Digital
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
              <span className="flex items-center gap-1">
                SKU: <span className="font-mono tabular-nums">{item.product.sku}</span>
                <button
                  onClick={handleCopySku}
                  className="p-0.5 hover:bg-orange-50 dark:hover:bg-gray-600 rounded transition-colors focus-ring"
                  aria-label="Copy SKU"
                >
                  {copiedSku ? (
                    <CheckCircle className="w-3 h-3 text-success-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </span>
              {hasBarcode && (
                <span className="flex items-center gap-1">
                  <Barcode className="w-3 h-3" />
                  Barcode:{' '}
                  <span className="font-mono tabular-nums">
                    {barcodeInfo?.barcode || item.product.barcode}
                  </span>
                </span>
              )}
              {item.product.category && (
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {item.product.category.name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {item.location || 'Warehouse'}
              </span>
              {item.unit && (
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  {item.unit}
                </span>
              )}
              {item.weight && item.weight > 0 && (
                <span className="flex items-center gap-1 tabular-nums">
                  <Weight className="w-3 h-3" />
                  {item.weight} kg
                </span>
              )}
              {item.taxRate && item.taxRate > 0 && (
                <span className="flex items-center gap-1 tabular-nums">
                  <Percent className="w-3 h-3" />
                  {item.taxRate}%
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          <button
            onClick={() => loadItem(false)}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
            aria-label="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>
          {canAdjustInventory && (
            <>
              <button
                onClick={() => setShowRestockModal(true)}
                className="px-3 py-2 bg-success-600 hover:bg-success-700 text-white rounded-lg flex items-center gap-1 transition-colors text-sm focus-ring"
              >
                <Plus className="w-4 h-4" />
                Restock
              </button>
              <button
                onClick={() => setShowIssueModal(true)}
                className="px-3 py-2 bg-secondary-600 hover:bg-secondary-700 text-white rounded-lg flex items-center gap-1 transition-colors text-sm focus-ring"
              >
                <User className="w-4 h-4" />
                Issue
              </button>
              <button
                onClick={() => setShowAdjustmentModal(true)}
                className="px-3 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg flex items-center gap-1 transition-all text-sm focus-ring"
              >
                <Edit className="w-4 h-4" />
                Adjust
              </button>
            </>
          )}
          {canEditInventory && (
            <button
              onClick={() => router.push(`/admin/inventory/${id}/edit`)}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center gap-1 transition-colors text-sm focus-ring"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
          {canDeleteInventory && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-3 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg flex items-center gap-1 transition-colors text-sm focus-ring"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      {status.severity !== 'good' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 p-4 ${
            status.severity === 'critical'
              ? 'bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-800'
              : 'bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800'
          } border rounded-lg flex flex-wrap items-center gap-3`}
        >
          <StatusIcon className={`w-5 h-5 ${status.iconColor} flex-shrink-0`} />
          <span
            className={`flex-1 ${
              status.severity === 'critical'
                ? 'text-danger-700 dark:text-danger-300'
                : 'text-warning-700 dark:text-warning-300'
            }`}
          >
            {status.severity === 'critical'
              ? 'This item is out of stock. Please restock immediately.'
              : `Low stock alert. Current stock (${quantity}) is below reorder point (${item.reorderPoint}).`}
          </span>
          <button
            onClick={() => setShowRestockModal(true)}
            className={`px-3 py-1 ${
              status.severity === 'critical'
                ? 'bg-danger-600 hover:bg-danger-700'
                : 'bg-warning-600 hover:bg-warning-700'
            } text-white text-sm rounded-lg transition-colors focus-ring`}
          >
            {status.action || 'Restock'}
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Stock" value={quantity} icon={Package} color="blue" />
        <StatCard
          label="Reserved"
          value={reserved}
          icon={Users}
          color="yellow"
          subtext={reserved > 0 ? 'Allocated to orders' : 'No reservations'}
        />
        <StatCard
          label="Available"
          value={availableStock}
          icon={CheckCircle}
          color={isOutOfStock ? 'red' : isLowStock ? 'yellow' : 'green'}
          subtext={availableStock > 0 ? 'Ready for sale' : 'Unavailable'}
        />
        <StatCard
          label="Unit Price"
          value={formatCurrency(itemPrice)}
          icon={DollarSign}
          color="green"
          subtext={
            item.product.costPrice > 0
              ? `Cost: ${formatCurrency(item.product.costPrice)}`
              : undefined
          }
        />
        <StatCard
          label="Total Value"
          value={formatCurrency(totalValue)}
          icon={TrendingUp}
          color="teal"
        />
      </div>

      {hasImages && (
        <div className="card-brand !p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ImageIcon className="w-5 h-5 text-brand-accent-500" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Product Images
            </h3>
            <span className="text-2xs text-gray-400 tabular-nums">
              ({images.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {images.slice(0, 6).map((image, index) => (
              <button
                key={index}
                onClick={() => {
                  setSelectedImage(image);
                  setShowImageModal(true);
                }}
                className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-600 hover:ring-2 hover:ring-brand-500 hover:border-brand-500 transition-all group focus-ring"
              >
                <img
                  src={image}
                  alt={`${item.product.name} - Image ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      '/images/placeholder-image.png';
                  }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                {index === 5 && images.length > 6 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-sm font-medium tabular-nums">
                    +{images.length - 6}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card-brand !p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary-50 dark:bg-secondary-900/20 rounded-lg">
              <Barcode className="w-5 h-5 text-secondary-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Barcode / QR Code
              </p>
              {hasBarcode ? (
                <p className="text-2xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                  {barcodeInfo?.barcode || item.product.barcode}
                </p>
              ) : (
                <p className="text-2xs text-gray-500 dark:text-gray-400">
                  No barcode assigned
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!hasBarcode && (
              <button
                onClick={handleGenerateBarcode}
                disabled={generatingBarcode}
                className="px-3 py-1.5 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg text-sm flex items-center gap-1 disabled:opacity-50 transition-all focus-ring"
              >
                {generatingBarcode ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Generate
              </button>
            )}
            {hasBarcode && (
              <>
                <button
                  onClick={() => setShowBarcode(!showBarcode)}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors text-sm flex items-center gap-1 focus-ring"
                >
                  <QrCode className="w-4 h-4" />
                  {showBarcode ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={handlePrintBarcode}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors text-sm flex items-center gap-1 focus-ring"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
                <button
                  onClick={handleDownloadBarcode}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors text-sm flex items-center gap-1 focus-ring"
                >
                  <Download className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
        {showBarcode && barcodeInfo && (
          <div className="mt-3 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/30">
            <div className="flex flex-wrap items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-2xs text-gray-500 dark:text-gray-400 mb-1">
                  Barcode
                </p>
                {barcodeInfo.barcodeUrl ? (
                  <img
                    src={barcodeInfo.barcodeUrl}
                    alt="Barcode"
                    className="h-12 w-auto"
                  />
                ) : (
                  <div className="h-12 flex items-center justify-center text-gray-400">
                    No barcode
                  </div>
                )}
                <p className="text-2xs font-mono text-gray-600 dark:text-gray-400 mt-1 text-center tabular-nums">
                  {barcodeInfo.barcode}
                </p>
                <button
                  onClick={handleCopyBarcode}
                  className="mt-1 text-2xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 flex items-center gap-1 mx-auto focus-ring rounded"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>
              {barcodeInfo.qrCodeUrl && (
                <div className="text-center">
                  <p className="text-2xs text-gray-500 dark:text-gray-400 mb-1">
                    QR Code
                  </p>
                  <img
                    src={barcodeInfo.qrCodeUrl}
                    alt="QR Code"
                    className="w-20 h-20 object-contain"
                  />
                  <p className="text-2xs text-gray-500 dark:text-gray-400 mt-1">
                    Scan to view item
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card-brand !p-4 hover:shadow-card-hover transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-50 dark:bg-brand-900/20 rounded-lg">
              <MapPin className="w-5 h-5 text-brand-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Location
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {item.location || 'Warehouse'}
              </p>
              {item.shelfNumber && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Shelf: {item.shelfNumber}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="card-brand !p-4 hover:shadow-card-hover transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary-50 dark:bg-secondary-900/20 rounded-lg">
              <Clock className="w-5 h-5 text-secondary-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Last Updated
              </p>
              <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                {formatDate(item.updatedAt)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                Created: {formatDate(item.createdAt)}
              </p>
            </div>
          </div>
        </div>
        <div className="card-brand !p-4 hover:shadow-card-transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-50 dark:bg-brand-900/20 rounded-lg">
              <Tag className="w-5 h-5 text-brand-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Category
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {item.product.category?.name || 'Uncategorized'}
              </p>
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {item.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-2xs text-gray-600 dark:text-gray-400"
                    >
                      {tag}
                    </span>
                  ))}
                  {item.tags.length > 3 && (
                    <span className="text-2xs text-gray-400 tabular-nums">
                      +{item.tags.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {item.expiryDate && (
          <div className="card-brand !p-4 hover:shadow-card-hover transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-danger-50 dark:bg-danger-900/20 rounded-lg">
                <CalendarDays className="w-5 h-5 text-danger-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Expiry Date
                </p>
                <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                  {formatDate(item.expiryDate)}
                </p>
              </div>
            </div>
          </div>
        )}
        {item.batchNumber && (
          <div className="card-brand !p-4 hover:shadow-card-hover transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary-50 dark:bg-secondary-900/20 rounded-lg">
                <Hash className="w-5 h-5 text-secondary-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Batch Number
                </p>
                <p className="font-medium text-gray-900 dark:text-white font-mono">
                  {item.batchNumber}
                </p>
              </div>
            </div>
          </div>
        )}
        {item.reorderQuantity && (
          <div className="card-brand !p-4 hover:shadow-card-hover transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success-50 dark:bg-success-900/20 rounded-lg">
                <Package className="w-5 h-5 text-success-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Reorder Quantity
                </p>
                <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                  {item.reorderQuantity || 'Not set'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {item.supplier && (
        <div className="card-brand !p-4 mb-6 hover:shadow-card-hover transition-shadow">
          <div className="flex flex-wrap items-center gap-4">
            <div className="p-2 bg-brand-50 dark:bg-brand-900/20 rounded-lg">
              <Truck className="w-5 h-5 text-brand-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Supplier
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {item.supplier}
              </p>
              {item.supplierDetails && (
                <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {item.supplierDetails.contactPerson}
                  </span>
                  <span className="flex items-center gap-1 tabular-nums">
                    <Phone className="w-3 h-3" />
                    {item.supplierDetails.phone}
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {item.supplierDetails.email}
                  </span>
                </div>
              )}
            </div>
            {item.notes && (
              <div className="max-w-md text-sm text-gray-500 dark:text-gray-400 border-l dark:border-gray-700 pl-4">
                <p className="text-2xs text-gray-400 dark:text-gray-500">
                  Notes
                </p>
                <p>{item.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {item.product.description && (
        <div className="card-brand !p-4 mb-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Description
          </p>
          <p className="text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">
            {item.product.description}
          </p>
        </div>
      )}

      <div className="card-brand !p-0 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Transaction History
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
              ({item.transactions?.length || 0})
            </span>
          </div>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-80 overflow-y-auto custom-scrollbar">
          {item.transactions?.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
              No transactions yet
            </div>
          ) : (
            item.transactions?.map((tx) => (
              <div
                key={tx.id}
                className="px-6 py-3 hover:bg-orange-50 dark:hover:bg-gray-700/50 flex flex-wrap items-center justify-between gap-2 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getTransactionIcon(tx.transactionType)}
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white">
                      {getTransactionTypeLabel(tx.transactionType)}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-2xs text-gray-500 dark:text-gray-400">
                      <span className="tabular-nums">
                        {formatDate(tx.createdAt)}
                      </span>
                      <span>
                        by {tx.user.firstName} {tx.user.lastName}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <span
                    className={`font-medium tabular-nums ${
                      tx.quantity > 0
                        ? 'text-success-600 dark:text-success-400'
                        : 'text-danger-600 dark:text-danger-400'
                    }`}
                  >
                    {tx.quantity > 0 ? '+' : ''}
                    {tx.quantity}
                  </span>
                  {tx.notes && (
                    <span
                      className="text-2xs text-gray-400 dark:text-gray-500 max-w-xs truncate"
                      title={tx.notes}
                    >
                      {tx.notes}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {item.issues && item.issues.length > 0 && (
        <div className="card-brand !p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Issue History
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
              ({item.issues.length})
            </span>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {item.issues.map((issue) => (
              <div
                key={issue.id}
                className="px-6 py-3 hover:bg-orange-50 dark:hover:bg-gray-700/50 flex flex-wrap items-center justify-between gap-2 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900 dark:text-white">
                    Issued to: {issue.issuedTo}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-2xs text-gray-500 dark:text-gray-400">
                    <span className="tabular-nums">
                      {formatDate(issue.createdAt)}
                    </span>
                    <span className="tabular-nums">Qty: {issue.quantity}</span>
                    {issue.purpose && <span>Purpose: {issue.purpose}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-2xs font-medium ${getIssueStatusColor(
                      issue.status
                    )}`}
                  >
                    {issue.status}
                  </span>
                  {issue.expectedReturnDate && (
                    <span className="text-2xs text-gray-500 dark:text-gray-400 tabular-nums">
                      Expected: {formatDate(issue.expectedReturnDate)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showAdjustmentModal && (
          <div className="fixed inset-0 z-modal flex items-center justify-center animate-fade-in">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowAdjustmentModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative card-brand shadow-card-hover max-w-md w-full m-4 animate-slide-up"
            >
              <button
                onClick={() => setShowAdjustmentModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Adjust Stock
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Current stock:{' '}
                <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                  {quantity}
                </span>
                {reserved > 0 && ` (${reserved} reserved)`}
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Adjustment Type
                  </label>
                  <select
                    value={adjustmentData.type}
                    onChange={(e) =>
                      setAdjustmentData({
                        ...adjustmentData,
                        type: e.target.value as
                          | 'ADJUSTMENT_IN'
                          | 'ADJUSTMENT_OUT',
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={submitting}
                  >
                    <option value="ADJUSTMENT_IN">Add Stock (+)</option>
                    <option value="ADJUSTMENT_OUT">Remove Stock (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={adjustmentData.quantity}
                    onChange={(e) =>
                      setAdjustmentData({
                        ...adjustmentData,
                        quantity: parseInt(e.target.value) || 0,
                      })
                    }
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums"
                    disabled={submitting}
                  />
                  {adjustmentData.type === 'ADJUSTMENT_OUT' &&
                    adjustmentData.quantity > quantity && (
                      <p className="mt-1 text-sm text-danger-600 dark:text-danger-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Cannot remove more than current stock
                      </p>
                    )}
                  {adjustmentData.type === 'ADJUSTMENT_IN' && (
                    <p className="mt-1 text-sm text-success-600 dark:text-success-400 tabular-nums">
                      New stock will be: {quantity + adjustmentData.quantity}
                    </p>
                  )}
                  {adjustmentData.type === 'ADJUSTMENT_OUT' &&
                    adjustmentData.quantity <= quantity && (
                      <p className="mt-1 text-sm text-warning-600 dark:text-warning-400 tabular-nums">
                        New stock will be: {quantity - adjustmentData.quantity}
                      </p>
                    )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={adjustmentData.notes}
                    onChange={(e) =>
                      setAdjustmentData({
                        ...adjustmentData,
                        notes: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Reason for adjustment..."
                    disabled={submitting}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowAdjustmentModal(false)}
                  className="btn-secondary focus-ring"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjustment}
                  disabled={
                    submitting ||
                    adjustmentData.quantity <= 0 ||
                    (adjustmentData.type === 'ADJUSTMENT_OUT' &&
                      adjustmentData.quantity > quantity)
                  }
                  className="px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 focus-ring"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Apply Adjustment
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showIssueModal && (
          <div className="fixed inset-0 z-modal flex items-center justify-center animate-fade-in">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowIssueModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative card-brand shadow-card-hover max-w-md w-full m-4 max-h-[90vh] overflow-y-auto custom-scrollbar animate-slide-up"
            >
              <button
                onClick={() => setShowIssueModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Issue Item
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Available stock:{' '}
                <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                  {availableStock}
                </span>
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Issued To *
                  </label>
                  <input
                    type="text"
                    value={issueData.issuedTo}
                    onChange={(e) =>
                      setIssueData({ ...issueData, issuedTo: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Recipient name"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    value={issueData.quantity}
                    onChange={(e) =>
                      setIssueData({
                        ...issueData,
                        quantity: parseInt(e.target.value) || 1,
                      })
                    }
                    min="1"
                    max={availableStock}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums"
                    disabled={submitting}
                  />
                  {issueData.quantity > availableStock && (
                    <p className="text-2xs text-danger-600 dark:text-danger-400 mt-1">
                      Not enough stock available
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Purpose
                  </label>
                  <input
                    type="text"
                    value={issueData.purpose}
                    onChange={(e) =>
                      setIssueData({ ...issueData, purpose: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Why is this being issued?"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Expected Return Date
                  </label>
                  <input
                    type="date"
                    value={issueData.expectedReturnDate}
                    onChange={(e) =>
                      setIssueData({
                        ...issueData,
                        expectedReturnDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Remarks
                  </label>
                  <textarea
                    value={issueData.remarks}
                    onChange={(e) =>
                      setIssueData({ ...issueData, remarks: e.target.value })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Additional notes..."
                    disabled={submitting}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowIssueModal(false)}
                  className="btn-secondary focus-ring"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleIssue}
                  disabled={
                    submitting ||
                    !issueData.issuedTo ||
                    issueData.quantity <= 0 ||
                    issueData.quantity > availableStock
                  }
                  className="px-4 py-2 bg-secondary-600 hover:bg-secondary-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 focus-ring"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Issuing...
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4" />
                      Issue Item
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRestockModal && (
          <div className="fixed inset-0 z-modal flex items-center justify-center animate-fade-in">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowRestockModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative card-brand shadow-card-hover max-w-md w-full m-4 animate-slide-up"
            >
              <button
                onClick={() => setShowRestockModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Restock Item
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Current stock:{' '}
                <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                  {quantity}
                </span>
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    value={restockData.quantity}
                    onChange={(e) =>
                      setRestockData({
                        ...restockData,
                        quantity: parseInt(e.target.value) || 1,
                      })
                    }
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums"
                    disabled={submitting}
                  />
                  <p className="mt-1 text-sm text-success-600 dark:text-success-400 tabular-nums">
                    New stock will be: {quantity + restockData.quantity}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Supplier
                  </label>
                  <input
                    type="text"
                    value={restockData.supplier}
                    onChange={(e) =>
                      setRestockData({
                        ...restockData,
                        supplier: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Supplier name"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Unit Price
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      value={restockData.unitPrice}
                      onChange={(e) =>
                        setRestockData({
                          ...restockData,
                          unitPrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      min="0"
                      step="0.01"
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums"
                      placeholder="0.00"
                      disabled={submitting}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={restockData.purchaseDate}
                    onChange={(e) =>
                      setRestockData({
                        ...restockData,
                        purchaseDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={restockData.notes}
                    onChange={(e) =>
                      setRestockData({ ...restockData, notes: e.target.value })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Additional notes..."
                    disabled={submitting}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowRestockModal(false)}
                  className="btn-secondary focus-ring"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestock}
                  disabled={submitting || restockData.quantity <= 0}
                  className="px-4 py-2 bg-success-600 hover:bg-success-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 focus-ring"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Restocking...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Restock Item
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-modal flex items-center justify-center animate-fade-in">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowDeleteModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative card-brand shadow-card-hover max-w-md w-full m-4 animate-slide-up"
            >
              <button
                onClick={() => setShowDeleteModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              <div className="text-center">
                <div className="w-16 h-16 bg-danger-100 dark:bg-danger-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-danger-600 dark:text-danger-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Delete Item
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Are you sure you want to delete{' '}
                  <strong className="text-gray-900 dark:text-white">
                    {item.product.name}
                  </strong>
                  ?
                </p>
                <p className="text-sm text-danger-600 dark:text-danger-400 mb-4">
                  This action cannot be undone. All associated data will be
                  permanently removed.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="btn-secondary focus-ring"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={submitting}
                  className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 focus-ring"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Item
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showImageModal && selectedImage && (
          <div className="fixed inset-0 z-modal flex items-center justify-center p-4 animate-fade-in">
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
                className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors focus-ring rounded-full p-1"
                aria-label="Close image"
              >
                <X className="w-8 h-8" />
              </button>
              <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-card-hover">
                <div className="flex justify-center p-4 bg-black/5 dark:bg-black/20">
                  <img
                    src={selectedImage}
                    alt={item.product.name}
                    className="max-w-full max-h-[70vh] object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        '/images/placeholder-image.png';
                    }}
                  />
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-center text-sm font-medium text-gray-900 dark:text-white">
                    {item.product.name}
                  </p>
                  <p className="text-center text-2xs text-gray-500 dark:text-gray-400">
                    {item.product.sku ? `SKU: ${item.product.sku}` : ''}
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

export default InventoryDetail;
