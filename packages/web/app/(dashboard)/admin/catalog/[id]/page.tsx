'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Edit, Trash2, Package, DollarSign, Barcode,
  Tag, Layers, Star, ShoppingBag, TrendingUp, Calendar,
  Loader2, Copy, Check, Eye, Users, Clock, Lock,
  AlertTriangle, X, RefreshCw, Sun, Moon, AlertCircle,
  QrCode, Scan, Printer, Download, Plus, Minus, Info,
  ChevronDown, ChevronRight, ExternalLink, Share2,
  Heart, Truck, Shield, Award, Gift, Clock as ClockIcon,
  Settings, Database, Link2, Unlink, GitBranch, ChevronLeft,
  Wand2, Upload, ImageIcon, Save
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { productService, Product as ServiceProduct } from '../../../../../services/productService';
import { inventoryService } from '../../../../../services/inventoryService';
import { barcodeService } from '../../../../../services/barcodeService';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency, formatDate, formatNumber } from '../../../../../utils/formatters';
import { PermissionResource } from '../../../../../types/enums';
import { useThemeStore } from '../../../../stores/themeStore';

// ============================================
// INTERFACES
// ============================================

interface InventoryItem {
  id: string;
  quantity: number;
  reserved: number;
  available: number;
  reorderPoint?: number;
  location?: string;
  status?: string;
}

interface Variant {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  isActive: boolean;
  images?: string[];
  attributes?: Record<string, any>;
  barcode?: string | null;
  inventoryId?: string | null;
}

interface ProductCounts {
  saleItems: number;
  orderItems: number;
  reviews: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  description?: string | null;
  unitPrice: number;
  costPrice?: number | null;
  barcode?: string | null;
  images: string[];
  category?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
  inventory?: InventoryItem | null;
  variants?: Variant[] | null;
  isActive: boolean;
  isDigital?: boolean;
  weight?: number | null;
  taxRate?: number | null;
  minStock?: number | null;
  attributes?: Record<string, any> | null;
  rating?: number | null;
  reviewCount?: number | null;
  tags?: string[] | null;
  featured?: boolean;
  inventoryId?: string | null;
  _count?: ProductCounts;
  createdAt: string;
  updatedAt: string;
}

interface BarcodeInfo {
  barcode: string;
  barcodeUrl: string;
  qrCodeUrl: string;
  productId?: string;
  productName?: string;
  sku?: string;
  price?: number;
  format?: string;
  generatedAt?: string;
}

// ============================================
// CONSTANTS
// ============================================

const PLACEHOLDER_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { canView, canEdit, canDelete, canManage, isLoading: permissionLoading } = usePermission();
  const { isDark, toggleTheme } = useThemeStore();
  
  // State
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [copied, setCopied] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  
  // ✅ FIXED: Image error states per image
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [variantImageErrors, setVariantImageErrors] = useState<Record<string, boolean>>({});
  
  // Barcode states
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeInfo, setBarcodeInfo] = useState<BarcodeInfo | null>(null);
  const [loadingBarcode, setLoadingBarcode] = useState(false);
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  
  // Image gallery state
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);

  // Editing state for variants
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [showEditVariantModal, setShowEditVariantModal] = useState(false);
  const [savingVariant, setSavingVariant] = useState(false);

  // Permissions
  const canViewProducts = canView(PermissionResource.PRODUCT) || canManage(PermissionResource.PRODUCT);
  const canEditProducts = canEdit(PermissionResource.PRODUCT) || canManage(PermissionResource.PRODUCT);
  const canDeleteProducts = canDelete(PermissionResource.PRODUCT) || canManage(PermissionResource.PRODUCT);
  const canManageBarcodes = canEdit(PermissionResource.PRODUCT) || canManage(PermissionResource.PRODUCT);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && id && canViewProducts) {
      loadProduct();
    }
  }, [id, isClient, canViewProducts]);

  // ============================================
  // ✅ FIXED: Image error handlers
  // ============================================

  const handleImageError = useCallback((imageUrl: string) => {
    setImageErrors(prev => ({ ...prev, [imageUrl]: true }));
  }, []);

  const handleVariantImageError = useCallback((imageUrl: string) => {
    setVariantImageErrors(prev => ({ ...prev, [imageUrl]: true }));
  }, []);

  const getValidImage = useCallback((imageUrl: string): string => {
    if (!imageUrl) return PLACEHOLDER_IMAGE;
    if (imageErrors[imageUrl]) return PLACEHOLDER_IMAGE;
    return imageUrl;
  }, [imageErrors]);

  const getValidVariantImage = useCallback((imageUrl: string): string => {
    if (!imageUrl) return PLACEHOLDER_IMAGE;
    if (variantImageErrors[imageUrl]) return PLACEHOLDER_IMAGE;
    return imageUrl;
  }, [variantImageErrors]);

  // ============================================
  // DATA FETCHING
  // ============================================

  const loadProduct = useCallback(async (showLoading = true) => {
    if (!id) {
      router.push('/admin/catalog');
      return;
    }

    try {
      if (showLoading) setLoading(true);
      setError(null);
      // Reset image errors on load
      setImageErrors({});
      setVariantImageErrors({});
      
      const data = await productService.getProductById(id);
      
      // Map the data to our Product interface with variant images
      const mappedProduct: Product = {
        id: data.id,
        name: data.name,
        sku: data.sku,
        description: data.description,
        unitPrice: data.unitPrice,
        costPrice: data.costPrice,
        barcode: data.barcode,
        images: data.images || [],
        category: data.category,
        supplier: data.supplier,
        inventory: data.inventory ? {
          id: data.inventory.id,
          quantity: data.inventory.quantity || 0,
          reserved: data.inventory.reserved || 0,
          available: (data.inventory.quantity || 0) - (data.inventory.reserved || 0),
          reorderPoint: (data.inventory as any).reorderPoint || 5,
          location: (data.inventory as any).location || 'Warehouse',
          status: (data.inventory as any).status || 'ACTIVE'
        } : null,
        variants: data.variants ? data.variants.map((v: any) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          price: v.price,
          stock: v.stock || 0,
          isActive: v.isActive !== undefined ? v.isActive : true,
          images: v.images || [],
          attributes: v.attributes || {},
          barcode: v.barcode || null,
          inventoryId: v.inventoryId || null,
        })) : null,
        isActive: data.isActive,
        isDigital: data.isDigital,
        weight: data.weight,
        taxRate: data.taxRate,
        minStock: data.minStock,
        attributes: data.attributes,
        rating: data.rating,
        reviewCount: data.reviewCount,
        tags: data.tags || null,
        featured: data.featured,
        inventoryId: data.inventoryId || null,
        _count: (data as any)._count ? {
          saleItems: (data as any)._count.saleItems || 0,
          orderItems: (data as any)._count.orderItems || 0,
          reviews: (data as any)._count.reviews || 0
        } : undefined,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
      
      setProduct(mappedProduct);
    } catch (error: any) {
      console.error('Failed to load product:', error);
      if (error?.response?.status === 404) {
        setError('Product not found');
        setProduct(null);
      } else {
        setError('Failed to load product. Please try again.');
      }
      toast.error('Failed to load product');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, router]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProduct(false);
    toast.success('Product refreshed');
  }, [loadProduct]);

  // ============================================
  // DELETE FUNCTIONS
  // ============================================

  const handleDelete = useCallback(async () => {
    if (!canDeleteProducts) {
      toast.error('You don\'t have permission to delete products');
      return;
    }
    setDeleting(true);
    try {
      await productService.deleteProduct(id);
      toast.success('Product deleted successfully');
      router.push('/admin/catalog');
    } catch (error: any) {
      console.error('Failed to delete product:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to delete product';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }, [id, canDeleteProducts, router]);

  const handleUnlinkFromInventory = useCallback(async () => {
    if (!product || !product.inventoryId) return;
    
    setUnlinking(true);
    try {
      const result = await productService.unlinkProductFromInventory(product.id, true);
      toast.success(result.message || 'Product unlinked from inventory');
      await loadProduct(false);
      setShowUnlinkModal(false);
    } catch (error: any) {
      console.error('Failed to unlink product:', error);
      toast.error(error?.response?.data?.message || error?.message || 'Failed to unlink product');
    } finally {
      setUnlinking(false);
    }
  }, [product, loadProduct]);

  // ============================================
  // COPY FUNCTIONS
  // ============================================

  const handleCopySKU = useCallback(() => {
    if (!product) return;
    navigator.clipboard.writeText(product.sku).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('SKU copied');
    }).catch(() => {
      toast.error('Failed to copy SKU');
    });
  }, [product]);

  const handleCopyBarcode = useCallback(() => {
    if (!product?.barcode) return;
    navigator.clipboard.writeText(product.barcode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Barcode copied');
    }).catch(() => {
      toast.error('Failed to copy barcode');
    });
  }, [product]);

  // ============================================
  // BARCODE FUNCTIONS
  // ============================================

  const handleGenerateBarcode = useCallback(async () => {
    if (!product || !canManageBarcodes) {
      toast.error('You don\'t have permission to manage barcodes');
      return;
    }
    
    setGeneratingBarcode(true);
    setShowBarcodeModal(true);
    
    try {
      if (product.barcode) {
        const info = await productService.getProductBarcode(product.id);
        setBarcodeInfo({
          barcode: info.barcode,
          barcodeUrl: info.barcodeUrl,
          qrCodeUrl: info.qrCodeUrl,
          productId: info.productId,
          productName: info.productName,
          sku: info.sku,
          price: info.price,
          format: info.format,
          generatedAt: info.generatedAt,
        });
      } else {
        const result = await productService.generateBarcode(product.id);
        setBarcodeInfo({
          barcode: result.barcode,
          barcodeUrl: result.barcodeUrl,
          qrCodeUrl: result.qrCodeUrl,
          productId: result.productId,
          productName: result.productName,
          sku: result.sku,
          price: result.price,
          format: result.format,
          generatedAt: result.generatedAt,
        });
        setProduct(prev => prev ? { ...prev, barcode: result.barcode } : null);
        toast.success('Barcode generated successfully');
      }
    } catch (error: any) {
      console.error('Failed to generate barcode:', error);
      toast.error(error?.message || 'Failed to generate barcode');
      setShowBarcodeModal(false);
    } finally {
      setGeneratingBarcode(false);
    }
  }, [product, canManageBarcodes]);

  const handlePrintBarcode = useCallback(() => {
    if (!barcodeInfo || !product) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Barcode - ${product.name}</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: white; }
            .container { text-align: center; padding: 30px; border: 1px solid #ddd; border-radius: 8px; max-width: 400px; }
            .product-name { margin: 0 0 5px 0; font-size: 16px; font-weight: bold; }
            .sku { color: #666; font-size: 12px; margin: 0 0 15px 0; }
            .barcode-img { max-width: 300px; margin: 10px 0; }
            .qr-img { max-width: 120px; margin: 10px 0; }
            .price { font-size: 20px; font-weight: bold; color: #2563eb; margin: 5px 0; }
            .info { margin-top: 10px; font-size: 12px; color: #666; }
            .info span { margin: 0 8px; }
            @media print {
              .container { border: none; padding: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="product-name">${product.name || 'Product'}</div>
            <div class="sku">SKU: ${product.sku || 'N/A'}</div>
            ${barcodeInfo.barcodeUrl ? `<img src="${barcodeInfo.barcodeUrl}" alt="Barcode" class="barcode-img" onerror="this.style.display='none'" />` : ''}
            ${barcodeInfo.qrCodeUrl ? `<img src="${barcodeInfo.qrCodeUrl}" alt="QR Code" class="qr-img" onerror="this.style.display='none'" />` : ''}
            <div class="price">${formatCurrency(product.unitPrice || 0)}</div>
            <div class="info">
              <span>${barcodeInfo.barcode}</span>
              ${product.category?.name ? `<span>| ${product.category.name}</span>` : ''}
            </div>
            <div class="no-print" style="margin-top: 15px; font-size: 12px; color: #999;">
              <button onclick="window.print()" style="padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer;">Print</button>
              <button onclick="window.close()" style="padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 8px;">Close</button>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [barcodeInfo, product]);

  const handleDownloadBarcode = useCallback(() => {
    if (!barcodeInfo?.barcodeUrl) return;
    const link = document.createElement('a');
    link.href = barcodeInfo.barcodeUrl;
    link.download = `barcode-${product?.sku || product?.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Barcode downloaded');
  }, [barcodeInfo, product]);

  const handleShare = useCallback(() => {
    if (!product) return;
    const url = `${window.location.origin}/shop/${product.id}`;
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `Check out ${product.name}`,
        url: url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        toast.success('Product link copied');
      }).catch(() => {
        toast.error('Failed to copy link');
      });
    }
  }, [product]);

  // ============================================
  // VARIANT EDITING FUNCTIONS
  // ============================================

  const handleEditVariant = useCallback((variant: Variant) => {
    setEditingVariant({ ...variant });
    setShowEditVariantModal(true);
  }, []);

  const handleSaveVariant = useCallback(async () => {
    if (!editingVariant) return;
    
    setSavingVariant(true);
    try {
      await productService.updateVariant(editingVariant.id, {
        name: editingVariant.name,
        sku: editingVariant.sku,
        price: editingVariant.price,
        stock: editingVariant.stock,
        images: editingVariant.images || [],
        attributes: editingVariant.attributes || {},
        isActive: editingVariant.isActive,
      });
      toast.success('Variant updated successfully');
      setShowEditVariantModal(false);
      await loadProduct(false);
    } catch (error: any) {
      console.error('Failed to update variant:', error);
      toast.error(error?.response?.data?.message || error?.message || 'Failed to update variant');
    } finally {
      setSavingVariant(false);
    }
  }, [editingVariant, loadProduct]);

  const handleDeleteVariant = useCallback(async (variantId: string) => {
    if (!confirm('Are you sure you want to delete this variant?')) return;
    
    try {
      await productService.deleteVariant(variantId);
      toast.success('Variant deleted successfully');
      await loadProduct(false);
    } catch (error: any) {
      console.error('Failed to delete variant:', error);
      toast.error(error?.response?.data?.message || error?.message || 'Failed to delete variant');
    }
  }, [loadProduct]);

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const inventory = product?.inventory;
  const availableStock = inventory ? inventory.quantity - (inventory.reserved || 0) : 0;
  const isLowStock = availableStock <= (product?.minStock || 5) && availableStock > 0;
  const isOutOfStock = availableStock <= 0;

  const totalVariants = product?.variants?.length || 0;
  const activeVariants = product?.variants?.filter(v => v.isActive).length || 0;
  const totalVariantStock = product?.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;

  const profitMargin = product?.unitPrice && product?.costPrice 
    ? ((product.unitPrice - product.costPrice) / product.unitPrice * 100)
    : null;

  const isLinkedToInventory = !!product?.inventoryId;

  // Tabs configuration
  const tabs = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'variants', label: 'Variants', icon: Layers },
    { id: 'sales', label: 'Sales', icon: TrendingUp },
    { id: 'reviews', label: 'Reviews', icon: Star },
  ];

  // ============================================
  // RENDER - Loading State
  // ============================================

  if (permissionLoading || !isClient || (loading && !product)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading product...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER - Permission Denied
  // ============================================

  if (!canViewProducts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view products. Please contact your administrator.
        </p>
        <button
          onClick={() => router.push('/admin/catalog')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Catalog
        </button>
      </div>
    );
  }

  // ============================================
  // RENDER - Error State
  // ============================================

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          {error === 'Product not found' ? 'Product Not Found' : 'Error Loading Product'}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          {error === 'Product not found' 
            ? 'The product you\'re looking for doesn\'t exist or has been removed.'
            : error
          }
        </p>
        <div className="flex items-center gap-3 mt-4">
          {error !== 'Product not found' && (
            <button
              onClick={() => loadProduct(true)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Loader2 className="w-4 h-4" />
              Retry
            </button>
          )}
          <button
            onClick={() => router.push('/admin/catalog')}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Catalog
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER - Product Not Found
  // ============================================

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-400">Product not found</h2>
        <button
          onClick={() => router.push('/admin/catalog')}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Catalog
        </button>
      </div>
    );
  }

  // ============================================
  // RENDER - Main
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/catalog')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Back to catalog"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex items-center gap-4">
              {/* ✅ FIXED: Product thumbnail with error handling */}
              <div 
                className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 cursor-pointer"
                onClick={() => product.images?.[0] && setShowLightbox(true)}
              >
                {product.images?.[0] ? (
                  <img 
                    src={getValidImage(product.images[0])} 
                    alt={product.name} 
                    className="w-full h-full object-cover"
                    onError={() => handleImageError(product.images[0])}
                  />
                ) : (
                  <Package className="w-full h-full p-3 text-gray-400 dark:text-gray-500" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  {product.name}
                  {product.featured && (
                    <span className="text-sm text-yellow-500">⭐</span>
                  )}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Barcode className="w-4 h-4" />
                    SKU: {product.sku}
                  </span>
                  <button
                    onClick={handleCopySKU}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    aria-label="Copy SKU"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                  {product.barcode && (
                    <>
                      <span className="flex items-center gap-1">
                        <Tag className="w-4 h-4" />
                        Barcode: {product.barcode}
                      </span>
                      <button
                        onClick={handleCopyBarcode}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        aria-label="Copy Barcode"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    product.isActive
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  }`}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {isLinkedToInventory && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 flex items-center gap-1">
                      <Link2 className="w-3 h-3" />
                      Linked to Inventory
                    </span>
                  )}
                  {product.rating && product.rating > 0 && (
                    <span className="flex items-center gap-1 text-yellow-500">
                      <Star className="w-4 h-4 fill-current" />
                      {product.rating.toFixed(1)} ({product.reviewCount || 0})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              aria-label="Refresh product"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-yellow-500" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600" />
              )}
            </button>

            <button
              onClick={handleShare}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Share product"
            >
              <Share2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>

            {canManageBarcodes && (
              <button
                onClick={handleGenerateBarcode}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="View Barcode"
              >
                <QrCode className="w-5 h-5 text-blue-500" />
              </button>
            )}

            {isLinkedToInventory && canEditProducts && (
              <button
                onClick={() => setShowUnlinkModal(true)}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                title="Unlink from inventory"
              >
                <Unlink className="w-4 h-4" />
                Unlink
              </button>
            )}

            {canEditProducts && (
              <Link
                href={`/admin/catalog/edit/${product.id}`}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit
              </Link>
            )}
            {canDeleteProducts && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Status Alerts */}
        {isOutOfStock && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700 dark:text-red-300">This product is out of stock.</span>
          </div>
        )}
        {isLowStock && !isOutOfStock && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
            <span className="text-yellow-700 dark:text-yellow-300">
              Low stock alert. Only {availableStock} units remaining.
            </span>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Unit Price</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(product.unitPrice)}</p>
                {profitMargin !== null && (
                  <p className={`text-xs ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {profitMargin >= 0 ? '+' : ''}{profitMargin.toFixed(1)}% margin
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">In Stock</p>
                <p className={`text-lg font-bold ${
                  availableStock <= 0 ? 'text-red-600 dark:text-red-400' : 
                  isLowStock ? 'text-yellow-600 dark:text-yellow-400' : 
                  'text-green-600 dark:text-green-400'
                }`}>
                  {availableStock}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Layers className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Variants</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {totalVariants}
                  {totalVariants > 0 && (
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                      ({activeVariants} active)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <ShoppingBag className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Sales</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {product._count?.saleItems || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Inventory Link Status */}
        {isLinkedToInventory && (
          <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
              <Link2 className="w-4 h-4" />
              <span>This product is linked to an inventory item. Stock is managed from inventory.</span>
            </div>
            <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
              Inventory ID: {product.inventoryId}
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 overflow-x-auto">
            <nav className="flex gap-2 sm:gap-4 py-2">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 border-b-2 font-medium text-sm transition-colors capitalize whitespace-nowrap ${
                    activeTab === id
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-4 sm:p-6">
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* ✅ FIXED: Image Gallery with error handling */}
                {product.images && product.images.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Images</h3>
                    <div className="flex flex-wrap gap-3">
                      {product.images.map((image, index) => {
                        const validImage = getValidImage(image);
                        return (
                          <div
                            key={index}
                            className={`w-20 h-20 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                              selectedImageIndex === index
                                ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50'
                                : 'border-gray-200 dark:border-gray-600 hover:border-blue-400'
                            }`}
                            onClick={() => {
                              setSelectedImageIndex(index);
                              setShowLightbox(true);
                            }}
                          >
                            <img 
                              src={validImage} 
                              alt={`${product.name} ${index + 1}`} 
                              className="w-full h-full object-cover"
                              onError={() => handleImageError(image)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Description */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Description</h3>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {product.description || 'No description provided'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Product Details</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">Category</span>
                        <span className="text-gray-900 dark:text-white">{product.category?.name || 'Uncategorized'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">Supplier</span>
                        <span className="text-gray-900 dark:text-white">{product.supplier?.name || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">Type</span>
                        <span className="text-gray-900 dark:text-white">{product.isDigital ? 'Digital' : 'Physical'}</span>
                      </div>
                      {product.weight && (
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                          <span className="text-gray-600 dark:text-gray-400">Weight</span>
                          <span className="text-gray-900 dark:text-white">{product.weight} kg</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">Tax Rate</span>
                        <span className="text-gray-900 dark:text-white">{product.taxRate || 0}%</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">Created</span>
                        <span className="text-gray-900 dark:text-white">{formatDate(product.createdAt)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">Updated</span>
                        <span className="text-gray-900 dark:text-white">{formatDate(product.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Pricing & Inventory</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">Unit Price</span>
                        <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(product.unitPrice)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">Cost Price</span>
                        <span className="text-gray-900 dark:text-white">{formatCurrency(product.costPrice || 0)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">Min Stock</span>
                        <span className="text-gray-900 dark:text-white">{product.minStock || 5}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">Current Stock</span>
                        <span className={`font-medium ${
                          availableStock <= 0 ? 'text-red-600 dark:text-red-400' : 
                          isLowStock ? 'text-yellow-600 dark:text-yellow-400' : 
                          'text-green-600 dark:text-green-400'
                        }`}>
                          {availableStock}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">Location</span>
                        <span className="text-gray-900 dark:text-white">{inventory?.location || 'Warehouse'}</span>
                      </div>
                      {isLinkedToInventory && (
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                          <span className="text-gray-600 dark:text-gray-400">Inventory Status</span>
                          <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                            <Link2 className="w-3 h-3" />
                            Linked
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tags */}
                {product.tags && product.tags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {product.tags.map((tag: string) => (
                        <span key={tag} className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attributes */}
                {product.attributes && Object.keys(product.attributes).length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Attributes</h3>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 overflow-x-auto">
                      <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all font-mono">
                        {JSON.stringify(product.attributes, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* INVENTORY TAB */}
            {activeTab === 'inventory' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Stock</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{inventory?.quantity || 0}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Reserved</p>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{inventory?.reserved || 0}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Available</p>
                    <p className={`text-2xl font-bold ${
                      availableStock <= 0 ? 'text-red-600 dark:text-red-400' : 
                      isLowStock ? 'text-yellow-600 dark:text-yellow-400' : 
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {availableStock}
                    </p>
                  </div>
                </div>

                {isLinkedToInventory && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 flex items-center gap-2 mb-2">
                      <Link2 className="w-4 h-4" />
                      Inventory Link
                    </h4>
                    <div className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                      <p>Inventory ID: <code className="bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded text-xs">{product.inventoryId}</code></p>
                      <p>Stock is managed through the inventory system.</p>
                      <p className="text-xs">Changes to stock should be made in the inventory section.</p>
                    </div>
                  </div>
                )}

                {totalVariants > 0 && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-purple-800 dark:text-purple-300 mb-2 flex items-center gap-2">
                      <GitBranch className="w-4 h-4" />
                      Variant Stock Summary
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Total Variants</span>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{totalVariants}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Active Variants</span>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{activeVariants}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Variant Stock</span>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{totalVariantStock}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Total Combined</span>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {(inventory?.quantity || 0) + totalVariantStock}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">Inventory Settings</h4>
                  <div className="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                    <p>Reorder Point: {inventory?.reorderPoint || product.minStock || 5}</p>
                    <p>Location: {inventory?.location || 'Warehouse'}</p>
                    <p>Status: {inventory?.status || 'ACTIVE'}</p>
                    <p className="mt-2 text-xs">
                      Products will be notified when stock falls below {product.minStock || 5} units.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ✅ FIXED: VARIANTS TAB with Image Support and Error Handling */}
            {activeTab === 'variants' && (
              <div>
                {product.variants && product.variants.length > 0 ? (
                  <div className="space-y-4">
                    {product.variants.map((variant) => (
                      <div key={variant.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {/* ✅ FIXED: Variant image with error handling */}
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                              {variant.images && variant.images.length > 0 ? (
                                <img 
                                  src={getValidVariantImage(variant.images[0])} 
                                  alt={variant.name} 
                                  className="w-full h-full object-cover"
                                  onError={() => handleVariantImageError(variant.images[0])}
                                />
                              ) : (
                                <Layers className="w-full h-full p-3 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{variant.name}</p>
                              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                                <span className="font-mono">SKU: {variant.sku}</span>
                                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(variant.price)}</span>
                                <span>Stock: {variant.stock}</span>
                                {variant.barcode && <span className="text-xs">Barcode: {variant.barcode}</span>}
                                {variant.inventoryId && (
                                  <span className="text-xs text-blue-500 flex items-center gap-1">
                                    <Link2 className="w-3 h-3" />
                                    Inventory Linked
                                  </span>
                                )}
                              </div>
                              {/* ✅ FIXED: Variant Image Thumbnails with error handling */}
                              {variant.images && variant.images.length > 1 && (
                                <div className="flex gap-1 mt-2">
                                  {variant.images.slice(1, 4).map((img, idx) => (
                                    <div key={idx} className="w-10 h-10 rounded-md overflow-hidden border border-gray-200 dark:border-gray-600">
                                      <img 
                                        src={getValidVariantImage(img)} 
                                        alt={`${variant.name} ${idx + 2}`} 
                                        className="w-full h-full object-cover"
                                        onError={() => handleVariantImageError(img)}
                                      />
                                    </div>
                                  ))}
                                  {variant.images.length > 4 && (
                                    <div className="w-10 h-10 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-500">
                                      +{variant.images.length - 4}
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* Variant Attributes */}
                              {variant.attributes && Object.keys(variant.attributes).length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {Object.entries(variant.attributes).map(([key, val]) => (
                                    <span key={key} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
                                      {key}: {String(val)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              variant.isActive
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            }`}>
                              {variant.isActive ? 'Active' : 'Inactive'}
                            </span>
                            {canEditProducts && (
                              <button
                                onClick={() => handleEditVariant(variant)}
                                className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                title="Edit variant"
                              >
                                <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </button>
                            )}
                            {canDeleteProducts && (
                              <button
                                onClick={() => handleDeleteVariant(variant.id)}
                                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                title="Delete variant"
                              >
                                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Layers className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No variants for this product</p>
                    {canEditProducts && (
                      <Link
                        href={`/admin/catalog/edit/${product.id}`}
                        className="mt-4 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4 inline mr-2" />
                        Add Variants
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SALES TAB */}
            {activeTab === 'sales' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Orders</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{product._count?.orderItems || 0}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Sale Items</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{product._count?.saleItems || 0}</p>
                  </div>
                </div>
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <TrendingUp className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p>Detailed sales history coming soon</p>
                </div>
              </div>
            )}

            {/* REVIEWS TAB */}
            {activeTab === 'reviews' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Average Rating</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {product.rating?.toFixed(1) || 'N/A'}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Reviews</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{product._count?.reviews || 0}</p>
                  </div>
                </div>
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Star className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p>Review management coming soon</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* EDIT VARIANT MODAL */}
        {showEditVariantModal && editingVariant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" onClick={() => setShowEditVariantModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setShowEditVariantModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
              
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Edit Variant</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={editingVariant.name}
                    onChange={(e) => setEditingVariant({ ...editingVariant, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SKU</label>
                  <input
                    type="text"
                    value={editingVariant.sku}
                    onChange={(e) => setEditingVariant({ ...editingVariant, sku: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingVariant.price}
                      onChange={(e) => setEditingVariant({ ...editingVariant, price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stock</label>
                    <input
                      type="number"
                      min="0"
                      value={editingVariant.stock}
                      onChange={(e) => setEditingVariant({ ...editingVariant, stock: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingVariant.isActive}
                    onChange={(e) => setEditingVariant({ ...editingVariant, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                </label>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowEditVariantModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveVariant}
                  disabled={savingVariant}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {savingVariant ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {savingVariant ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BARCODE MODAL */}
        {showBarcodeModal && product && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" onClick={() => setShowBarcodeModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setShowBarcodeModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  {product.barcode ? <QrCode className="w-6 h-6 text-blue-600" /> : <Barcode className="w-6 h-6 text-blue-600" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {product.barcode ? 'Product Barcode' : 'Generate Barcode'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{product.name}</p>
                </div>
              </div>

              {generatingBarcode ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Generating barcode...</p>
                </div>
              ) : barcodeInfo ? (
                <div className="space-y-4">
                  <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                    <div className="flex flex-wrap items-center justify-center gap-6">
                      <div className="text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Barcode</p>
                        {barcodeInfo.barcodeUrl ? (
                          <img 
                            src={barcodeInfo.barcodeUrl} 
                            alt="Barcode" 
                            className="h-12 w-auto"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="h-12 flex items-center justify-center text-gray-400">No barcode</div>
                        )}
                        <p className="text-xs font-mono text-gray-600 dark:text-gray-400 mt-1 text-center">
                          {barcodeInfo.barcode}
                        </p>
                      </div>
                      {barcodeInfo.qrCodeUrl && (
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">QR Code</p>
                          <img 
                            src={barcodeInfo.qrCodeUrl} 
                            alt="QR Code" 
                            className="w-20 h-20 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(barcodeInfo.barcode);
                        toast.success('Barcode copied');
                      }}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm"
                    >
                      <Copy className="w-4 h-4" />
                      Copy
                    </button>
                    <button
                      onClick={handleDownloadBarcode}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    <button
                      onClick={handlePrintBarcode}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
                    >
                      <Printer className="w-4 h-4" />
                      Print
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Barcode className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No barcode available</p>
                  <button
                    onClick={handleGenerateBarcode}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Generate Barcode
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ✅ FIXED: IMAGE LIGHTBOX with error handling */}
        {showLightbox && product.images && product.images.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
            <button
              onClick={() => setShowLightbox(false)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <button
              onClick={() => setSelectedImageIndex(prev => Math.max(0, prev - 1))}
              className={`absolute left-4 text-white hover:text-gray-300 transition-colors ${selectedImageIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={selectedImageIndex === 0}
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
            <div className="max-w-4xl max-h-[80vh]">
              <img
                src={getValidImage(product.images[selectedImageIndex])}
                alt={`${product.name} ${selectedImageIndex + 1}`}
                className="w-full h-full object-contain"
                onError={() => handleImageError(product.images[selectedImageIndex])}
              />
            </div>
            <button
              onClick={() => setSelectedImageIndex(prev => Math.min(product.images.length - 1, prev + 1))}
              className={`absolute right-4 text-white hover:text-gray-300 transition-colors ${selectedImageIndex === product.images.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={selectedImageIndex === product.images.length - 1}
            >
              <ChevronRight className="w-8 h-8" />
            </button>
            <div className="absolute bottom-8 text-white text-sm">
              {selectedImageIndex + 1} / {product.images.length}
            </div>
          </div>
        )}

        {/* DELETE MODAL */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Product</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{product.name}</strong>?
                This will permanently remove the product and all associated data.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deleting ? 'Deleting...' : 'Delete Product'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* UNLINK FROM INVENTORY MODAL */}
        {showUnlinkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" onClick={() => setShowUnlinkModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <button
                onClick={() => setShowUnlinkModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <Unlink className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Unlink from Inventory</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">This will remove the inventory link</p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to unlink <strong className="text-gray-900 dark:text-white">{product.name}</strong> from its inventory?
                The inventory item will be preserved but no longer linked to this product.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowUnlinkModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnlinkFromInventory}
                  disabled={unlinking}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {unlinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                  {unlinking ? 'Unlinking...' : 'Unlink'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
