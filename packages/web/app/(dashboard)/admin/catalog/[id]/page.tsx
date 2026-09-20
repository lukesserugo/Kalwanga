'use client';

// packages/web/app/(dashboard)/admin/catalog/[id]/page.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Edit, Trash2, Package, DollarSign, Barcode,
  Tag, Layers, Star, ShoppingBag, TrendingUp,
  Loader2, Copy, Check, Lock,
  AlertTriangle, X, RefreshCw, Sun, Moon, AlertCircle,
  QrCode, Printer, Download, Info,
  ChevronLeft, ChevronRight, Share2,
  Link2, Unlink, GitBranch,
  Save,
} from 'lucide-react';

import { usePermission } from '../../../../../hooks/usePermission';
import { productService } from '../../../../../services/productService';
import { toast } from '../../../../../utils/toast-manager';
import {
  formatCurrency,
  formatDate,
} from '../../../../../utils/formatters';
import { PermissionResource } from '../../../../../types/enums';
import { useThemeStore } from '../../../../stores/themeStore';

// ============================================
// TYPES
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

/**
 * Stable tab identifiers — using a union means a typo like
 * `setActiveTab('varients')` fails at compile time instead of
 * silently rendering an empty panel.
 */
type TabId = 'overview' | 'inventory' | 'variants' | 'sales' | 'reviews';

// ============================================
// CONSTANTS
// ============================================

const PLACEHOLDER_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// ============================================
// PAGE
// ============================================

export default function AdminProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string | undefined;

  const {
    canView,
    canEdit,
    canDelete,
    canManage,
    isLoading: permissionLoading,
  } = usePermission();
  const { isDark, toggleTheme } = useThemeStore();

  // ── Core state ─────────────────────────────
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // ── Copy feedback ──────────────────────────
  const [copied, setCopied] = useState(false);

  // ── Delete / unlink ────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  // ── Image error tracking ───────────────────
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [variantImageErrors, setVariantImageErrors] = useState<
    Record<string, boolean>
  >({});

  // ── Barcode ────────────────────────────────
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeInfo, setBarcodeInfo] = useState<BarcodeInfo | null>(null);
  const [generatingBarcode, setGeneratingBarcode] = useState(false);

  // ── Gallery ────────────────────────────────
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);

  // ── Variant editing ────────────────────────
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [showEditVariantModal, setShowEditVariantModal] = useState(false);
  const [savingVariant, setSavingVariant] = useState(false);

  // ── Permissions ────────────────────────────
  const canViewProducts =
    canView(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);
  const canEditProducts =
    canEdit(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);
  const canDeleteProducts =
    canDelete(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);
  const canManageBarcodes =
    canEdit(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !id || !canViewProducts) return;
    loadProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isClient, canViewProducts]);

  // ============================================
  // IMAGE HANDLERS
  // ============================================

  const handleImageError = useCallback((imageUrl: string) => {
    setImageErrors((prev) => ({ ...prev, [imageUrl]: true }));
  }, []);

  const handleVariantImageError = useCallback((imageUrl: string) => {
    setVariantImageErrors((prev) => ({ ...prev, [imageUrl]: true }));
  }, []);

  const getValidImage = useCallback(
    (imageUrl: string): string => {
      if (!imageUrl) return PLACEHOLDER_IMAGE;
      if (imageErrors[imageUrl]) return PLACEHOLDER_IMAGE;
      return imageUrl;
    },
    [imageErrors]
  );

  const getValidVariantImage = useCallback(
    (imageUrl: string): string => {
      if (!imageUrl) return PLACEHOLDER_IMAGE;
      if (variantImageErrors[imageUrl]) return PLACEHOLDER_IMAGE;
      return imageUrl;
    },
    [variantImageErrors]
  );

  // ============================================
  // LOAD
  // ============================================

  const loadProduct = useCallback(
    async (showLoading = true) => {
      if (!id) {
        router.push('/admin/catalog');
        return;
      }

      try {
        if (showLoading) setLoading(true);
        setError(null);

        // Reset every transient per-product flag so stale data never
        // bleeds from the previous product into this one.
        setImageErrors({});
        setVariantImageErrors({});
        setSelectedImageIndex(0);
        setBarcodeInfo(null);

        const data = await productService.getProductById(id);
        const mappedProduct = mapServiceProductToDetailProduct(data);
        setProduct(mappedProduct);
      } catch (err: any) {
        console.error('Failed to load product:', err);
        if (err?.response?.status === 404) {
          setError('Product not found');
          setProduct(null);
        } else {
          setError('Failed to load product. Please try again.');
          toast.error('Failed to load product');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, router]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadProduct(false);
      toast.success('Product refreshed');
    } catch {
      // loadProduct sets its own error state + toast; nothing more
      // to do here.
    }
  }, [loadProduct]);

  // ============================================
  // DELETE / UNLINK
  // ============================================

  const handleDelete = useCallback(async () => {
    if (!canDeleteProducts) {
      toast.error("You don't have permission to delete products");
      return;
    }
    setDeleting(true);
    try {
      await productService.deleteProduct(id!);
      toast.success('Product deleted successfully');
      router.push('/admin/catalog');
    } catch (err: any) {
      console.error('Failed to delete product:', err);
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to delete product';
      toast.error(message);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }, [id, canDeleteProducts, router]);

  const handleUnlinkFromInventory = useCallback(async () => {
    if (!product || !product.inventoryId) return;

    setUnlinking(true);
    try {
      const result = await productService.unlinkProductFromInventory(
        product.id,
        true
      );
      toast.success(result.message || 'Product unlinked from inventory');
      await loadProduct(false);
      setShowUnlinkModal(false);
    } catch (err: any) {
      console.error('Failed to unlink product:', err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to unlink product'
      );
    } finally {
      setUnlinking(false);
    }
  }, [product, loadProduct]);

  // ============================================
  // COPY HELPERS
  // ============================================

  const showCopied = useCallback(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleCopySKU = useCallback(() => {
    if (!product) return;
    navigator.clipboard
      .writeText(product.sku)
      .then(() => {
        showCopied();
        toast.success('SKU copied');
      })
      .catch(() => toast.error('Failed to copy SKU'));
  }, [product, showCopied]);

  const handleCopyBarcode = useCallback(() => {
    if (!product?.barcode) return;
    navigator.clipboard
      .writeText(product.barcode)
      .then(() => {
        showCopied();
        toast.success('Barcode copied');
      })
      .catch(() => toast.error('Failed to copy barcode'));
  }, [product, showCopied]);

  // ============================================
  // BARCODE
  // ============================================

  const handleGenerateBarcode = useCallback(async () => {
    if (!product || !canManageBarcodes) {
      toast.error("You don't have permission to manage barcodes");
      return;
    }

    setGeneratingBarcode(true);
    setShowBarcodeModal(true);

    try {
      // The service's `getProductBarcode` throws on 404 (no barcode).
      // Treat that as "generate a new one" rather than an error.
      let info: BarcodeInfo;
      try {
        info = await productService.getProductBarcode(product.id);
      } catch (err: any) {
        if (err?.response?.status === 404 || !product.barcode) {
          info = await productService.generateBarcode(product.id);
          setProduct((prev) =>
            prev ? { ...prev, barcode: info.barcode } : null
          );
          toast.success('Barcode generated successfully');
        } else {
          throw err;
        }
      }

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
    } catch (err: any) {
      console.error('Failed to generate barcode:', err);
      toast.error(err?.message || 'Failed to generate barcode');
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
            .price { font-size: 20px; font-weight: bold; color: #EA580C; margin: 5px 0; }
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
            ${
              barcodeInfo.barcodeUrl
                ? `<img src="${barcodeInfo.barcodeUrl}" alt="Barcode" class="barcode-img" onerror="this.style.display='none'" />`
                : ''
            }
            ${
              barcodeInfo.qrCodeUrl
                ? `<img src="${barcodeInfo.qrCodeUrl}" alt="QR Code" class="qr-img" onerror="this.style.display='none'" />`
                : ''
            }
            <div class="price">${formatCurrency(product.unitPrice || 0)}</div>
            <div class="info">
              <span>${barcodeInfo.barcode}</span>
              ${product.category?.name ? `<span>| ${product.category.name}</span>` : ''}
            </div>
            <div class="no-print" style="margin-top: 15px; font-size: 12px; color: #999;">
              <button onclick="window.print()" style="padding: 8px 16px; background: #EA580C; color: white; border: none; border-radius: 4px; cursor: pointer;">Print</button>
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
      navigator
        .share({
          title: product.name,
          text: `Check out ${product.name}`,
          url,
        })
        .catch(() => {
          /* user cancelled — no-op */
        });
    } else {
      navigator.clipboard
        .writeText(url)
        .then(() => toast.success('Product link copied'))
        .catch(() => toast.error('Failed to copy link'));
    }
  }, [product]);

  // ============================================
  // VARIANT EDITING
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
    } catch (err: any) {
      console.error('Failed to update variant:', err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to update variant'
      );
    } finally {
      setSavingVariant(false);
    }
  }, [editingVariant, loadProduct]);

  const handleDeleteVariant = useCallback(
    async (variantId: string) => {
      if (!confirm('Are you sure you want to delete this variant?')) return;

      try {
        await productService.deleteVariant(variantId);
        toast.success('Variant deleted successfully');
        await loadProduct(false);
      } catch (err: any) {
        console.error('Failed to delete variant:', err);
        toast.error(
          err?.response?.data?.message ||
            err?.message ||
            'Failed to delete variant'
        );
      }
    },
    [loadProduct]
  );

  // ============================================
  // DERIVED
  // ============================================

  const inventory = product?.inventory;
  const availableStock = inventory
    ? inventory.quantity - (inventory.reserved || 0)
    : 0;
  const isLowStock =
    availableStock <= (product?.minStock || 5) && availableStock > 0;
  const isOutOfStock = availableStock <= 0;

  const totalVariants = product?.variants?.length || 0;
  const activeVariants =
    product?.variants?.filter((v) => v.isActive).length || 0;
  const totalVariantStock =
    product?.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;

  const profitMargin = useMemo(() => {
    if (!product?.unitPrice || !product?.costPrice) return null;
    if (product.unitPrice === 0) return null;
    return (
      ((product.unitPrice - product.costPrice) / product.unitPrice) * 100
    );
  }, [product?.unitPrice, product?.costPrice]);

  const isLinkedToInventory = !!product?.inventoryId;

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'variants', label: 'Variants', icon: Layers },
    { id: 'sales', label: 'Sales', icon: TrendingUp },
    { id: 'reviews', label: 'Reviews', icon: Star },
  ];

  // ============================================
  // EARLY RETURNS
  // ============================================

  if (permissionLoading || !isClient || (loading && !product)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 dark:border-brand-400 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading product...
          </p>
        </div>
      </div>
    );
  }

  if (!canViewProducts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view products. Please contact your
          administrator.
        </p>
        <button
          onClick={() => router.push('/admin/catalog')}
          className="mt-4 px-6 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors flex items-center gap-2 focus-ring"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Catalog
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-danger-100 dark:bg-danger-900/20 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-12 h-12 text-danger-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          {error === 'Product not found'
            ? 'Product Not Found'
            : 'Error Loading Product'}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          {error === 'Product not found'
            ? "The product you're looking for doesn't exist or has been removed."
            : error}
        </p>
        <div className="flex items-center gap-3 mt-4">
          {error !== 'Product not found' && (
            <button
              onClick={() => loadProduct(true)}
              className="px-6 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors flex items-center gap-2 focus-ring"
            >
              <Loader2 className="w-4 h-4" />
              Retry
            </button>
          )}
          <button
            onClick={() => router.push('/admin/catalog')}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 focus-ring"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Catalog
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-400">
          Product not found
        </h2>
        <button
          onClick={() => router.push('/admin/catalog')}
          className="mt-4 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors flex items-center gap-2 focus-ring"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Catalog
        </button>
      </div>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/catalog')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
              aria-label="Back to catalog"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 cursor-pointer"
                onClick={() =>
                  product.images?.[0] && setShowLightbox(true)
                }
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
                    <span className="text-sm text-brand-500">
                      <Star className="w-4 h-4 fill-current inline" />
                    </span>
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
                    {copied ? (
                      <Check className="w-4 h-4 text-success-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
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
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      product.isActive
                        ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                        : 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
                    }`}
                  >
                    {product.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {isLinkedToInventory && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 flex items-center gap-1">
                      <Link2 className="w-3 h-3" />
                      Linked to Inventory
                    </span>
                  )}
                  {product.rating && product.rating > 0 && (
                    <span className="flex items-center gap-1 text-brand-500">
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
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
              aria-label="Refresh product"
            >
              <RefreshCw
                className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus-ring"
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-warning-500" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600" />
              )}
            </button>

            <button
              onClick={handleShare}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus-ring"
              aria-label="Share product"
            >
              <Share2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>

            {canManageBarcodes && (
              <button
                onClick={handleGenerateBarcode}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus-ring"
                aria-label="View Barcode"
              >
                <QrCode className="w-5 h-5 text-brand-500" />
              </button>
            )}

            {isLinkedToInventory && canEditProducts && (
              <button
                onClick={() => setShowUnlinkModal(true)}
                className="px-4 py-2 bg-warning-600 hover:bg-warning-700 text-white rounded-lg flex items-center gap-2 transition-colors focus-ring"
                title="Unlink from inventory"
              >
                <Unlink className="w-4 h-4" />
                Unlink
              </button>
            )}

            {canEditProducts && (
              <Link
                href={`/admin/catalog/edit/${product.id}`}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg flex items-center gap-2 transition-colors focus-ring"
              >
                <Edit className="w-4 h-4" />
                Edit
              </Link>
            )}
            {canDeleteProducts && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg flex items-center gap-2 transition-colors focus-ring"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Status alerts */}
        {isOutOfStock && (
          <div className="mb-6 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-danger-500 flex-shrink-0" />
            <span className="text-danger-700 dark:text-danger-300">
              This product is out of stock.
            </span>
          </div>
        )}
        {isLowStock && !isOutOfStock && (
          <div className="mb-6 p-4 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-warning-500 flex-shrink-0" />
            <span className="text-warning-700 dark:text-warning-300">
              Low stock alert. Only {availableStock} units remaining.
            </span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={DollarSign}
            color="brand"
            label="Unit Price"
            value={formatCurrency(product.unitPrice)}
            subtext={
              profitMargin !== null
                ? `${profitMargin >= 0 ? '+' : ''}${profitMargin.toFixed(1)}% margin`
                : undefined
            }
            subtextTone={
              profitMargin !== null && profitMargin < 0 ? 'negative' : 'positive'
            }
          />
          <StatCard
            icon={Package}
            color={
              availableStock <= 0
                ? 'danger'
                : isLowStock
                ? 'warning'
                : 'success'
            }
            label="In Stock"
            value={String(availableStock)}
          />
          <StatCard
            icon={Layers}
            color="secondary"
            label="Variants"
            value={String(totalVariants)}
            subtext={
              totalVariants > 0 ? `${activeVariants} active` : undefined
            }
          />
          <StatCard
            icon={ShoppingBag}
            color="brand-accent"
            label="Total Sales"
            value={String(product._count?.saleItems || 0)}
          />
        </div>

        {/* Inventory link */}
        {isLinkedToInventory && (
          <div className="mb-6 p-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-brand-700 dark:text-brand-300">
              <Link2 className="w-4 h-4" />
              <span>
                This product is linked to an inventory item. Stock is
                managed from inventory.
              </span>
            </div>
            <span className="text-xs font-mono text-brand-600 dark:text-brand-400">
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
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 border-b-2 font-medium text-sm transition-colors capitalize whitespace-nowrap focus-ring ${
                    activeTab === id
                      ? 'border-brand-500 text-brand-600 dark:text-brand-400'
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
            {/* OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {product.images && product.images.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                      Images
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {product.images.map((image, index) => (
                        <div
                          key={`${image.slice(0, 32)}-${index}`}
                          className={`w-20 h-20 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                            selectedImageIndex === index
                              ? 'border-brand-500 ring-2 ring-brand-500 ring-opacity-50'
                              : 'border-gray-200 dark:border-gray-600 hover:border-brand-400'
                          }`}
                          onClick={() => {
                            setSelectedImageIndex(index);
                            setShowLightbox(true);
                          }}
                        >
                          <img
                            src={getValidImage(image)}
                            alt={`${product.name} ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={() => handleImageError(image)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Description
                  </h3>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {product.description || 'No description provided'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Product Details
                    </h3>
                    <div className="space-y-2">
                      <DetailRow
                        label="Category"
                        value={product.category?.name || 'Uncategorized'}
                      />
                      <DetailRow
                        label="Supplier"
                        value={product.supplier?.name || 'N/A'}
                      />
                      <DetailRow
                        label="Type"
                        value={product.isDigital ? 'Digital' : 'Physical'}
                      />
                      {product.weight !== null &&
                        product.weight !== undefined && (
                          <DetailRow
                            label="Weight"
                            value={`${product.weight} kg`}
                          />
                        )}
                      <DetailRow
                        label="Tax Rate"
                        value={`${product.taxRate || 0}%`}
                      />
                      <DetailRow
                        label="Created"
                        value={formatDate(product.createdAt)}
                      />
                      <DetailRow
                        label="Updated"
                        value={formatDate(product.updatedAt)}
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Pricing & Inventory
                    </h3>
                    <div className="space-y-2">
                      <DetailRow
                        label="Unit Price"
                        value={formatCurrency(product.unitPrice)}
                        emphasize
                      />
                      <DetailRow
                        label="Cost Price"
                        value={formatCurrency(product.costPrice || 0)}
                      />
                      <DetailRow
                        label="Min Stock"
                        value={String(product.minStock || 5)}
                      />
                      <DetailRow
                        label="Current Stock"
                        value={String(availableStock)}
                        tone={
                          availableStock <= 0
                            ? 'negative'
                            : isLowStock
                            ? 'warning'
                            : 'positive'
                        }
                      />
                      <DetailRow
                        label="Location"
                        value={inventory?.location || 'Warehouse'}
                      />
                      {isLinkedToInventory && (
                        <DetailRow
                          label="Inventory Status"
                          value={
                            <span className="text-brand-600 dark:text-brand-400 inline-flex items-center gap-1">
                              <Link2 className="w-3 h-3" />
                              Linked
                            </span>
                          }
                        />
                      )}
                    </div>
                  </div>
                </div>

                {product.tags && product.tags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Tags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {product.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-full text-xs font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {product.attributes &&
                  Object.keys(product.attributes).length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Attributes
                      </h3>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 overflow-x-auto sidebar-scroll">
                        <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all font-mono">
                          {JSON.stringify(product.attributes, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* INVENTORY */}
            {activeTab === 'inventory' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Total Stock
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                      {inventory?.quantity || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Reserved
                    </p>
                    <p className="text-2xl font-bold text-warning-600 dark:text-warning-400 tabular-nums">
                      {inventory?.reserved || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Available
                    </p>
                    <p
                      className={`text-2xl font-bold tabular-nums ${
                        availableStock <= 0
                          ? 'text-danger-600 dark:text-danger-400'
                          : isLowStock
                          ? 'text-warning-600 dark:text-warning-400'
                          : 'text-success-600 dark:text-success-400'
                      }`}
                    >
                      {availableStock}
                    </p>
                  </div>
                </div>

                {isLinkedToInventory && (
                  <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-brand-800 dark:text-brand-300 flex items-center gap-2 mb-2">
                      <Link2 className="w-4 h-4" />
                      Inventory Link
                    </h4>
                    <div className="space-y-1 text-sm text-brand-700 dark:text-brand-300">
                      <p>
                        Inventory ID:{' '}
                        <code className="bg-brand-100 dark:bg-brand-900/50 px-2 py-0.5 rounded text-xs font-mono">
                          {product.inventoryId}
                        </code>
                      </p>
                      <p>Stock is managed through the inventory system.</p>
                      <p className="text-xs">
                        Changes to stock should be made in the inventory
                        section.
                      </p>
                    </div>
                  </div>
                )}

                {totalVariants > 0 && (
                  <div className="bg-secondary-50 dark:bg-secondary-900/20 border border-secondary-200 dark:border-secondary-800 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-secondary-800 dark:text-secondary-300 mb-2 flex items-center gap-2">
                      <GitBranch className="w-4 h-4" />
                      Variant Stock Summary
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Total Variants
                        </span>
                        <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                          {totalVariants}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Active Variants
                        </span>
                        <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                          {activeVariants}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Variant Stock
                        </span>
                        <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                          {totalVariantStock}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Total Combined
                        </span>
                        <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                          {(inventory?.quantity || 0) + totalVariantStock}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-warning-800 dark:text-warning-300 mb-2">
                    Inventory Settings
                  </h4>
                  <div className="space-y-1 text-sm text-warning-700 dark:text-warning-300">
                    <p>
                      Reorder Point:{' '}
                      {inventory?.reorderPoint || product.minStock || 5}
                    </p>
                    <p>Location: {inventory?.location || 'Warehouse'}</p>
                    <p>Status: {inventory?.status || 'ACTIVE'}</p>
                    <p className="mt-2 text-xs">
                      Products will be notified when stock falls below{' '}
                      {product.minStock || 5} units.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* VARIANTS */}
            {activeTab === 'variants' && (
              <div>
                {product.variants && product.variants.length > 0 ? (
                  <div className="space-y-4">
                    {product.variants.map((variant) => (
                      <div
                        key={variant.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                              {variant.images && variant.images.length > 0 ? (
                                <img
                                  src={getValidVariantImage(variant.images[0])}
                                  alt={variant.name}
                                  className="w-full h-full object-cover"
                                  onError={() =>
                                    handleVariantImageError(variant.images![0])
                                  }
                                />
                              ) : (
                                <Layers className="w-full h-full p-3 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {variant.name}
                              </p>
                              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                                <span className="font-mono">
                                  SKU: {variant.sku}
                                </span>
                                <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                                  {formatCurrency(variant.price)}
                                </span>
                                <span className="tabular-nums">
                                  Stock: {variant.stock}
                                </span>
                                {variant.barcode && (
                                  <span className="text-xs font-mono">
                                    Barcode: {variant.barcode}
                                  </span>
                                )}
                                {variant.inventoryId && (
                                  <span className="text-xs text-brand-500 flex items-center gap-1">
                                    <Link2 className="w-3 h-3" />
                                    Inventory Linked
                                  </span>
                                )}
                              </div>
                              {variant.images && variant.images.length > 1 && (
                                <div className="flex gap-1 mt-2">
                                  {variant.images
                                    .slice(1, 4)
                                    .map((img, idx) => (
                                      <div
                                        key={`${img.slice(0, 24)}-${idx}`}
                                        className="w-10 h-10 rounded-md overflow-hidden border border-gray-200 dark:border-gray-600"
                                      >
                                        <img
                                          src={getValidVariantImage(img)}
                                          alt={`${variant.name} ${idx + 2}`}
                                          className="w-full h-full object-cover"
                                          onError={() =>
                                            handleVariantImageError(img)
                                          }
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
                              {variant.attributes &&
                                Object.keys(variant.attributes).length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {Object.entries(variant.attributes).map(
                                      ([key, val]) => (
                                        <span
                                          key={key}
                                          className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300"
                                        >
                                          {key}: {String(val)}
                                        </span>
                                      )
                                    )}
                                  </div>
                                )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                variant.isActive
                                  ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                                  : 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
                              }`}
                            >
                              {variant.isActive ? 'Active' : 'Inactive'}
                            </span>
                            {canEditProducts && (
                              <button
                                onClick={() => handleEditVariant(variant)}
                                className="p-1.5 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded-lg transition-colors focus-ring"
                                title="Edit variant"
                              >
                                <Edit className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                              </button>
                            )}
                            {canDeleteProducts && (
                              <button
                                onClick={() => handleDeleteVariant(variant.id)}
                                className="p-1.5 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded-lg transition-colors focus-ring"
                                title="Delete variant"
                              >
                                <Trash2 className="w-4 h-4 text-danger-600 dark:text-danger-400" />
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
                    <p className="text-gray-500 dark:text-gray-400">
                      No variants for this product
                    </p>
                    {canEditProducts && (
                      <Link
                        href={`/admin/catalog/edit/${product.id}`}
                        className="mt-4 inline-block px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors focus-ring"
                      >
                        Add Variants
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SALES */}
            {activeTab === 'sales' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Total Orders
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                      {product._count?.orderItems || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Total Sale Items
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                      {product._count?.saleItems || 0}
                    </p>
                  </div>
                </div>
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <TrendingUp className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p>Detailed sales history coming soon</p>
                </div>
              </div>
            )}

            {/* REVIEWS */}
            {activeTab === 'reviews' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Average Rating
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                      {product.rating?.toFixed(1) || 'N/A'}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Total Reviews
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                      {product._count?.reviews || 0}
                    </p>
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
          <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
              onClick={() => setShowEditVariantModal(false)}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setShowEditVariantModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>

              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Edit Variant
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editingVariant.name}
                    onChange={(e) =>
                      setEditingVariant({
                        ...editingVariant,
                        name: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SKU
                  </label>
                  <input
                    type="text"
                    value={editingVariant.sku}
                    onChange={(e) =>
                      setEditingVariant({
                        ...editingVariant,
                        sku: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingVariant.price}
                      onChange={(e) =>
                        setEditingVariant({
                          ...editingVariant,
                          price: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Stock
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingVariant.stock}
                      onChange={(e) =>
                        setEditingVariant({
                          ...editingVariant,
                          stock: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingVariant.isActive}
                    onChange={(e) =>
                      setEditingVariant({
                        ...editingVariant,
                        isActive: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Active
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowEditVariantModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveVariant}
                  disabled={savingVariant}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors focus-ring"
                >
                  {savingVariant ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {savingVariant ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BARCODE MODAL */}
        {showBarcodeModal && product && (
          <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
              onClick={() => setShowBarcodeModal(false)}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setShowBarcodeModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-brand-100 dark:bg-brand-900/30 rounded-lg">
                  {product.barcode ? (
                    <QrCode className="w-6 h-6 text-brand-600" />
                  ) : (
                    <Barcode className="w-6 h-6 text-brand-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {product.barcode ? 'Product Barcode' : 'Generate Barcode'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {product.name}
                  </p>
                </div>
              </div>

              {generatingBarcode ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Generating barcode...
                  </p>
                </div>
              ) : barcodeInfo ? (
                <div className="space-y-4">
                  <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                    <div className="flex flex-wrap items-center justify-center gap-6">
                      <div className="text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Barcode
                        </p>
                        {barcodeInfo.barcodeUrl ? (
                          <img
                            src={barcodeInfo.barcodeUrl}
                            alt="Barcode"
                            className="h-12 w-auto"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                'none';
                            }}
                          />
                        ) : (
                          <div className="h-12 flex items-center justify-center text-gray-400">
                            No barcode
                          </div>
                        )}
                        <p className="text-xs font-mono text-gray-600 dark:text-gray-400 mt-1 text-center">
                          {barcodeInfo.barcode}
                        </p>
                      </div>
                      {barcodeInfo.qrCodeUrl && (
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            QR Code
                          </p>
                          <img
                            src={barcodeInfo.qrCodeUrl}
                            alt="QR Code"
                            className="w-20 h-20 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                'none';
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
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm focus-ring"
                    >
                      <Copy className="w-4 h-4" />
                      Copy
                    </button>
                    <button
                      onClick={handleDownloadBarcode}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm focus-ring"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    <button
                      onClick={handlePrintBarcode}
                      className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors flex items-center gap-2 text-sm focus-ring"
                    >
                      <Printer className="w-4 h-4" />
                      Print
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Barcode className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">
                    No barcode available
                  </p>
                  <button
                    onClick={handleGenerateBarcode}
                    className="mt-4 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors focus-ring"
                  >
                    Generate Barcode
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* IMAGE LIGHTBOX */}
        {showLightbox && product.images && product.images.length > 0 && (
          <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/90 p-4">
            <button
              onClick={() => setShowLightbox(false)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors focus-ring"
              aria-label="Close"
            >
              <X className="w-8 h-8" />
            </button>
            <button
              onClick={() =>
                setSelectedImageIndex((prev) => Math.max(0, prev - 1))
              }
              className={`absolute left-4 text-white hover:text-gray-300 transition-colors focus-ring ${
                selectedImageIndex === 0
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
              disabled={selectedImageIndex === 0}
              aria-label="Previous image"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
            <div className="max-w-4xl max-h-[80vh]">
              <img
                src={getValidImage(product.images[selectedImageIndex])}
                alt={`${product.name} ${selectedImageIndex + 1}`}
                className="w-full h-full object-contain"
                onError={() =>
                  handleImageError(product.images[selectedImageIndex])
                }
              />
            </div>
            <button
              onClick={() =>
                setSelectedImageIndex((prev) =>
                  Math.min(product.images.length - 1, prev + 1)
                )
              }
              className={`absolute right-4 text-white hover:text-gray-300 transition-colors focus-ring ${
                selectedImageIndex === product.images.length - 1
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
              disabled={selectedImageIndex === product.images.length - 1}
              aria-label="Next image"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
            <div className="absolute bottom-8 text-white text-sm tabular-nums">
              {selectedImageIndex + 1} / {product.images.length}
            </div>
          </div>
        )}

        {/* DELETE MODAL */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
              onClick={() => setShowDeleteModal(false)}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-danger-100 dark:bg-danger-900/30 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-danger-600 dark:text-danger-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Delete Product
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete{' '}
                <strong className="text-gray-900 dark:text-white">
                  {product.name}
                </strong>
                ? This will permanently remove the product and all associated
                data.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-ring"
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {deleting ? 'Deleting...' : 'Delete Product'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* UNLINK MODAL */}
        {showUnlinkModal && (
          <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
              onClick={() => setShowUnlinkModal(false)}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <button
                onClick={() => setShowUnlinkModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-warning-100 dark:bg-warning-900/30 rounded-lg">
                  <Unlink className="w-6 h-6 text-warning-600 dark:text-warning-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Unlink from Inventory
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This will remove the inventory link
                  </p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to unlink{' '}
                <strong className="text-gray-900 dark:text-white">
                  {product.name}
                </strong>{' '}
                from its inventory? The inventory item will be preserved but
                no longer linked to this product.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowUnlinkModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnlinkFromInventory}
                  disabled={unlinking}
                  className="px-4 py-2 bg-warning-600 hover:bg-warning-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-ring"
                >
                  {unlinking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Unlink className="w-4 h-4" />
                  )}
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

// ============================================
// SMALL PRESENTATIONAL COMPONENTS
// ============================================

interface StatCardProps {
  icon: React.ElementType;
  color:
    | 'brand'
    | 'brand-accent'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'danger';
  label: string;
  value: string;
  subtext?: string;
  subtextTone?: 'positive' | 'negative' | 'neutral';
}

const STAT_COLORS: Record<StatCardProps['color'], string> = {
  brand:
    'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400',
  'brand-accent':
    'bg-brand-accent-100 dark:bg-brand-accent-900/30 text-brand-accent-600 dark:text-brand-accent-400',
  secondary:
    'bg-secondary-100 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-400',
  success:
    'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400',
  warning:
    'bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400',
  danger:
    'bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400',
};

function StatCard({
  icon: Icon,
  color,
  label,
  value,
  subtext,
  subtextTone = 'neutral',
}: StatCardProps) {
  const toneClass =
    subtextTone === 'positive'
      ? 'text-success-600 dark:text-success-400'
      : subtextTone === 'negative'
      ? 'text-danger-600 dark:text-danger-400'
      : 'text-gray-500 dark:text-gray-400';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${STAT_COLORS[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
            {value}
          </p>
          {subtext && (
            <p className={`text-xs ${toneClass} tabular-nums`}>{subtext}</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  emphasize?: boolean;
  tone?: 'positive' | 'negative' | 'warning' | 'neutral';
}

function DetailRow({
  label,
  value,
  emphasize = false,
  tone = 'neutral',
}: DetailRowProps) {
  const toneClass =
    tone === 'positive'
      ? 'text-success-600 dark:text-success-400'
      : tone === 'negative'
      ? 'text-danger-600 dark:text-danger-400'
      : tone === 'warning'
      ? 'text-warning-600 dark:text-warning-400'
      : 'text-gray-900 dark:text-white';

  return (
    <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span className={`${emphasize ? 'font-medium' : ''} ${toneClass}`}>
        {value}
      </span>
    </div>
  );
}

// ============================================
// SERVICE ADAPTER
// ============================================

/**
 * Map the `productService` return shape (canonical `Product` type)
 * into the local `Product` interface the page uses. Extracted so the
 * fetch callback stays readable and so any future change to the
 * canonical type only needs one update site.
 */
function mapServiceProductToDetailProduct(data: any): Product {
  return {
    id: data.id,
    name: data.name,
    sku: data.sku,
    description: data.description,
    unitPrice: data.unitPrice,
    costPrice: data.costPrice,
    barcode: data.barcode,
    images: Array.isArray(data.images) ? data.images : [],
    category: data.category,
    supplier: data.supplier,
    inventory: data.inventory
      ? {
          id: data.inventory.id,
          quantity: data.inventory.quantity || 0,
          reserved: data.inventory.reserved || 0,
          available:
            (data.inventory.quantity || 0) -
            (data.inventory.reserved || 0),
          reorderPoint: data.inventory.reorderPoint || 5,
          location: data.inventory.location || 'Warehouse',
          status: data.inventory.status || 'ACTIVE',
        }
      : null,
    variants: Array.isArray(data.variants)
      ? data.variants.map((v: any) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          price: v.price,
          stock: v.stock || 0,
          isActive: v.isActive !== undefined ? v.isActive : true,
          images: Array.isArray(v.images) ? v.images : [],
          attributes: v.attributes || {},
          barcode: v.barcode || null,
          inventoryId: v.inventoryId || null,
        }))
      : null,
    isActive: data.isActive,
    isDigital: data.isDigital,
    weight: data.weight,
    taxRate: data.taxRate,
    minStock: data.minStock,
    attributes: data.attributes,
    rating: data.rating,
    reviewCount: data.reviewCount,
    tags: Array.isArray(data.tags) ? data.tags : null,
    featured: data.featured,
    inventoryId: data.inventoryId || null,
    _count: data._count
      ? {
          saleItems: data._count.saleItems || 0,
          orderItems: data._count.orderItems || 0,
          reviews: data._count.reviews || 0,
        }
      : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}
