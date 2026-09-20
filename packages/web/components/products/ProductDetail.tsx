'use client';

// packages/web/components/products/ProductDetail.tsx

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Edit, Trash2, Package, Barcode,
  Tag, Layers, Star, ShoppingBag, TrendingUp,
  Loader2, Copy, Check, Eye, Lock,
  AlertTriangle, X, Share2, Truck,
  RotateCcw, CreditCard, ChevronLeft, ChevronRight,
  ZoomIn, Minus, Plus, ShoppingCart,
  QrCode, Scan, Download, Printer, RefreshCw,
  Weight, Hash, Link2, AlertCircle, Info,
  CheckCircle, XCircle, HelpCircle, Sparkles,
  BarChart3, Clock as ClockIcon,
} from 'lucide-react';

import { productService } from '../../services/productService';
import { barcodeService } from '../../services/barcodeService';
import { inventoryService } from '../../services/inventoryService';
import { cartService } from '../../services/cartService';
import { guestCartService } from '../../services/guestCartService';
import { guestRecentlyViewedService } from '../../services/guestRecentlyViewedService';
import { toast } from '../../utils/toast-manager';
import {
  formatCurrency,
  formatDate,
} from '../../utils/formatters';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../hooks/useAuth';
import { PermissionResource } from '../../types/enums';
import { WishlistButton } from './WishlistButton';
import { RecentlyViewed } from './RecentlyViewed';
import { ProductReviews } from './ProductReviews';
import { useThemeStore } from '../../app/stores/themeStore';
import { ProductCard } from './ProductCard';

// ============================================
// TYPES
// ============================================

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  unitPrice: number;
  costPrice?: number;
  barcode?: string;
  images: string[];
  category?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
  inventory?: {
    id: string;
    quantity: number;
    reserved: number;
    available: number;
    reorderPoint: number;
    location: string;
    status: string;
  } | null;
  variants?: Variant[];
  isActive: boolean;
  isDigital: boolean;
  weight?: number;
  taxRate: number;
  minStock?: number;
  maxStock?: number;
  attributes?: Record<string, any>;
  rating?: number;
  reviewCount?: number;
  tags?: string[] | null;
  featured?: boolean;
  inventoryId?: string | null;
  _count?: {
    saleItems: number;
    orderItems: number;
    reviews: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface Variant {
  id: string;
  name: string;
  sku: string;
  price: number;
  costPrice?: number;
  stock: number;
  isActive: boolean;
  images?: string[];
  attributes?: Record<string, any>;
  barcode?: string | null;
  inventoryId?: string | null;
  inventory?: { quantity?: number; reserved?: number } | null;
}

interface BarcodeInfo {
  barcode: string;
  barcodeUrl: string;
  qrCodeUrl: string;
}

interface InventoryHistory {
  date: string;
  type: 'in' | 'out' | 'adjust' | 'transfer';
  quantity: number;
  previous: number;
  current: number;
  reason: string;
  user: string;
}

interface ProductDetailProps {
  product: Product;
  isAdmin?: boolean;
}

interface StockStatus {
  status: string;
  color: string;
  icon: React.ElementType;
}

// ============================================
// CONSTANTS
// ============================================

const PLACEHOLDER_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Info },
  { id: 'specifications', label: 'Specifications', icon: Hash },
  { id: 'variants', label: 'Variants', icon: Layers },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'reviews', label: 'Reviews', icon: Star },
] as const;

type TabId =
  | 'overview'
  | 'specifications'
  | 'variants'
  | 'inventory'
  | 'reviews'
  | 'analytics';

// ============================================
// SALES ANALYTICS SUB-COMPONENT
// ============================================

interface ProductSalesAnalyticsProps {
  productId: string;
}

const ProductSalesAnalytics: React.FC<ProductSalesAnalyticsProps> = ({
  productId,
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const salesData = await productService.getSalesByProduct(productId);
        if (!cancelled) setData(salesData);
      } catch (err) {
        console.error('Failed to load sales analytics:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No sales data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-success-50 dark:bg-success-900/20 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total Revenue
          </p>
          <p className="text-2xl font-bold tabular-nums text-success-600 dark:text-success-400">
            {formatCurrency(data.totalRevenue || 0)}
          </p>
        </div>
        <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Units Sold</p>
          <p className="text-2xl font-bold tabular-nums text-primary-600 dark:text-primary-400">
            {data.totalQuantity || 0}
          </p>
        </div>
        <div className="bg-secondary-50 dark:bg-secondary-900/20 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Average Price
          </p>
          <p className="text-2xl font-bold tabular-nums text-secondary-600 dark:text-secondary-400">
            {formatCurrency(data.averagePrice || 0)}
          </p>
        </div>
      </div>

      {data.items && data.items.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Recent Sales
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
            {data.items.slice(0, 10).map((item: any, index: number) => (
              <div
                key={index}
                className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 py-2"
              >
                <span className="text-gray-600 dark:text-gray-400">
                  {item.date}
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  {item.customerName}
                </span>
                <span className="font-medium tabular-nums text-gray-900 dark:text-white">
                  {formatCurrency(item.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// COMPONENT
// ============================================

export function ProductDetail({
  product: initialProduct,
  isAdmin = false,
}: ProductDetailProps) {
  const router = useRouter();
  const { canEdit, canDelete, canManage } = usePermission();
  const { isDark } = useThemeStore();
  const { isAuthenticated } = useAuth();

  const [product, setProduct] = useState<Product>(initialProduct);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [copied, setCopied] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [barcodeInfo, setBarcodeInfo] = useState<BarcodeInfo | null>(null);
  const [loadingBarcode, setLoadingBarcode] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [barcodeCopied, setBarcodeCopied] = useState(false);

  const [inventoryHistory, setInventoryHistory] = useState<InventoryHistory[]>(
    [],
  );
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [variantImageErrors, setVariantImageErrors] = useState<
    Record<string, boolean>
  >({});

  const canEditProduct =
    canEdit(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);
  const canDeleteProduct =
    canDelete(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);

  const sideLoadedForId = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
    (imageUrl: string | undefined): string => {
      if (!imageUrl) return PLACEHOLDER_IMAGE;
      if (imageErrors[imageUrl]) return PLACEHOLDER_IMAGE;
      return imageUrl;
    },
    [imageErrors],
  );

  const getValidVariantImage = useCallback(
    (imageUrl: string | undefined): string => {
      if (!imageUrl) return PLACEHOLDER_IMAGE;
      if (variantImageErrors[imageUrl]) return PLACEHOLDER_IMAGE;
      return imageUrl;
    },
    [variantImageErrors],
  );

  // ============================================
  // PRODUCT MAPPING
  // ============================================

  const mapProduct = useCallback((data: any): Product => {
    const cleanImages = (arr: unknown): string[] =>
      (Array.isArray(arr) ? arr : []).filter((img): img is string => {
        if (!img || typeof img !== 'string') return false;
        if (img === PLACEHOLDER_IMAGE) return false;
        if (img.length < 100) return false;
        return true;
      });

    const mappedVariants: Variant[] = Array.isArray(data.variants)
      ? data.variants.map(
          (v: any): Variant => ({
            id: v.id,
            name: v.name,
            sku: v.sku,
            price: v.price ?? 0,
            costPrice: v.costPrice ?? undefined,
            stock: v.stock ?? 0,
            isActive: v.isActive !== false,
            images: cleanImages(v.images),
            attributes: v.attributes || {},
            barcode: v.barcode ?? undefined,
            inventoryId: v.inventoryId ?? undefined,
            inventory: v.inventory ?? null,
          }),
        )
      : [];

    return {
      id: data.id,
      name: data.name,
      sku: data.sku,
      description: data.description || '',
      unitPrice: data.unitPrice ?? 0,
      costPrice: data.costPrice ?? undefined,
      barcode: data.barcode ?? undefined,
      images: cleanImages(data.images),
      category: data.category ?? null,
      supplier: data.supplier ?? null,
      inventory: data.inventory
        ? {
            id: data.inventory.id,
            quantity: data.inventory.quantity ?? 0,
            reserved: data.inventory.reserved ?? 0,
            available:
              (data.inventory.quantity ?? 0) -
              (data.inventory.reserved ?? 0),
            reorderPoint: data.inventory.reorderPoint ?? 5,
            location: data.inventory.location ?? 'Warehouse',
            status: data.inventory.status ?? 'ACTIVE',
          }
        : null,
      variants: mappedVariants,
      isActive: data.isActive !== false,
      isDigital: data.isDigital || false,
      weight: data.weight ?? undefined,
      taxRate: data.taxRate ?? 0,
      minStock: data.minStock ?? undefined,
      maxStock: data.maxStock ?? undefined,
      attributes: data.attributes || {},
      rating: data.rating ?? undefined,
      reviewCount: data.reviewCount ?? 0,
      tags: Array.isArray(data.tags) ? data.tags : null,
      featured: data.featured || false,
      inventoryId: data.inventoryId ?? undefined,
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
  }, []);

  // ============================================
  // SIDE-LOADERS
  // ============================================
  //
  // Barcode info is admin-only — the routes it depends on
  // (`/products/barcode/image`, `/products/qrcode`) require auth.
  // Guests never see the barcode panel anyway (the JSX gates it on
  // `isAdmin`), so skipping the fetch is correct.

  const loadBarcodeInfo = useCallback(
    async (productId: string) => {
      if (!isAdmin) return;

      try {
        setLoadingBarcode(true);
        const productData = await productService.getProductById(productId);
        if (!productData?.barcode) return;

        const [barcodeImg, qrData] = await Promise.all([
          barcodeService.generateBarcodeImage(productData.barcode),
          barcodeService.generateQRCode({
            product: productData.name,
            sku: productData.sku,
            barcode: productData.barcode,
            price: productData.unitPrice,
          }),
        ]);

        if (!isMountedRef.current) return;
        setBarcodeInfo({
          barcode: productData.barcode,
          barcodeUrl: barcodeImg.barcodeUrl,
          qrCodeUrl: qrData.qrCodeUrl || '',
        });
      } catch (err) {
        console.warn('No barcode found for this product:', err);
      } finally {
        if (isMountedRef.current) setLoadingBarcode(false);
      }
    },
    [isAdmin],
  );

  const loadInventoryHistory = useCallback(
    async (productId: string) => {
      if (!isAdmin) return;

      try {
        setLoadingHistory(true);
        const inventory = await inventoryService.getInventoryItem(productId);

        const transactions = Array.isArray((inventory as any)?.transactions)
          ? (inventory as any).transactions
          : [];

        if (!isMountedRef.current) return;
        setInventoryHistory(
          transactions.map(
            (t: any): InventoryHistory => ({
              date: t.createdAt,
              type: t.type || 'adjust',
              quantity: t.quantity ?? 0,
              previous: t.previousQuantity ?? 0,
              current: t.currentQuantity ?? 0,
              reason: t.reason || '',
              user: t.user?.name || 'System',
            }),
          ),
        );
      } catch (err) {
        console.error('Failed to load inventory history:', err);
      } finally {
        if (isMountedRef.current) setLoadingHistory(false);
      }
    },
    [isAdmin],
  );

  // Related products is an authenticated route — no public endpoint.
  // Guests silently get an empty list; the section is hidden anyway
  // (`!isAdmin && relatedProducts.length > 0`).
  const loadRelatedProducts = useCallback(
    async (productId: string) => {
      if (!isAuthenticated) return;

      try {
        setLoadingRelated(true);
        const data = await productService.getRelatedProducts(productId, 4);
        if (!isMountedRef.current) return;
        setRelatedProducts(Array.isArray(data) ? data : []);
      } catch (err: any) {
        // 401 is expected for guests; only log unexpected errors.
        if (err?.response?.status !== 401 && err?.response?.status !== 403) {
          console.warn('Failed to load related products:', err);
        }
      } finally {
        if (isMountedRef.current) setLoadingRelated(false);
      }
    },
    [isAuthenticated],
  );

  const addToRecentlyViewed = useCallback(
    async (productId: string) => {
      try {
        if (isAuthenticated) {
          await productService.addRecentlyViewed(productId);
        } else {
          await guestRecentlyViewedService.add(productId);
        }
      } catch (err) {
        // Best-effort; don't surface failures for tracking.
        console.warn('Failed to add to recently viewed:', err);
      }
    },
    [isAuthenticated],
  );

  // ============================================
  // LOAD PRODUCT
  // ============================================
  //
  // Storefront uses the public route; admin uses the authenticated
  // route (richer relations, `_count`, supplier, etc).

  const loadProduct = useCallback(
    async (productId: string, showLoading = true) => {
      if (!productId) return;

      try {
        if (showLoading) setLoading(true);
        setError(null);
        setImageErrors({});
        setVariantImageErrors({});

        const data = isAdmin
          ? await productService.getProductById(productId)
          : await productService.getPublicProductById(productId);

        if (!isMountedRef.current) return;
        setProduct(mapProduct(data));
      } catch (err: any) {
        if (!isMountedRef.current) return;
        const status = err?.response?.status;
        setError(
          status === 404 ? 'Product not found' : 'Failed to load product',
        );
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    },
    [isAdmin, mapProduct],
  );

  // ============================================
  // MOUNT / PROP CHANGE
  // ============================================

  useEffect(() => {
    if (!initialProduct?.id) return;

    setProduct(mapProduct(initialProduct));
    setSelectedImage(0);

    if (sideLoadedForId.current === initialProduct.id) return;
    sideLoadedForId.current = initialProduct.id;

    loadRelatedProducts(initialProduct.id);
    addToRecentlyViewed(initialProduct.id);

    // Admin-only side-loads.
    if (isAdmin && initialProduct.barcode) {
      loadBarcodeInfo(initialProduct.id);
    }
    if (isAdmin) {
      loadInventoryHistory(initialProduct.id);
    }
  }, [
    initialProduct,
    isAdmin,
    mapProduct,
    loadBarcodeInfo,
    loadInventoryHistory,
    loadRelatedProducts,
    addToRecentlyViewed,
  ]);

  useEffect(() => {
    if (!initialProduct?.id && !loading) {
      router.push(isAdmin ? '/admin/catalog' : '/shop');
    }
  }, [initialProduct?.id, isAdmin, loading, router]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleCopySKU = useCallback(() => {
    if (!product) return;
    navigator.clipboard.writeText(product.sku).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('SKU copied');
      },
      () => toast.error('Failed to copy SKU'),
    );
  }, [product]);

  const handleCopyBarcode = useCallback(async () => {
    if (!barcodeInfo?.barcode) return;
    try {
      await navigator.clipboard.writeText(barcodeInfo.barcode);
      setBarcodeCopied(true);
      setTimeout(() => setBarcodeCopied(false), 2000);
      toast.success('Barcode copied');
    } catch {
      toast.error('Failed to copy');
    }
  }, [barcodeInfo]);

  const handleDownloadBarcode = useCallback(() => {
    if (!barcodeInfo?.barcodeUrl) return;
    const link = document.createElement('a');
    link.href = barcodeInfo.barcodeUrl;
    link.download = `barcode-${product?.sku || product?.barcode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Barcode downloaded');
  }, [barcodeInfo, product]);

  const handlePrintBarcodeLabel = useCallback(() => {
    if (!barcodeInfo || !product) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const escapeHtml = (v: string) =>
      v
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    printWindow.document.write(`
      <html>
        <head>
          <title>Barcode Label - ${escapeHtml(product.name)}</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: white; }
            .label { text-align: center; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 350px; background: white; }
            .product-name { margin: 0 0 5px 0; font-size: 16px; font-weight: bold; color: #1a1a1a; }
            .sku { color: #666; font-size: 12px; margin: 0 0 10px 0; }
            .barcode-img { max-width: 280px; margin: 10px 0; }
            .qr-img { max-width: 120px; margin: 5px 0; }
            .price { font-size: 20px; font-weight: bold; color: #2563eb; margin: 5px 0; }
            .info { margin-top: 10px; font-size: 12px; color: #666; }
            .info span { margin: 0 5px; }
            .divider { border-top: 1px dashed #ddd; margin: 10px 0; }
            .stock { font-size: 12px; color: #666; margin: 5px 0; }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="product-name">${escapeHtml(product.name)}</div>
            <div class="sku">SKU: ${escapeHtml(product.sku || 'N/A')}</div>
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
            <div class="price">${formatCurrency(product.unitPrice)}</div>
            <div class="stock">Stock: ${product.inventory?.quantity || 0}</div>
            <div class="divider"></div>
            <div class="info">
              <span>${escapeHtml(barcodeInfo.barcode)}</span>
              ${
                product.category?.name
                  ? `<span>| ${escapeHtml(product.category.name)}</span>`
                  : ''
              }
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

  const handleGenerateBarcode = useCallback(async () => {
    if (!isAdmin || !product?.id) return;
    try {
      setLoadingBarcode(true);
      const result = await barcodeService.generateUniqueBarcode({
        productName: product.name,
        sku: product.sku,
      });

      await productService.updateProduct(product.id, {
        barcode: result.barcode,
      });
      setProduct((prev) => ({ ...prev, barcode: result.barcode }));

      const [barcodeImg, qrData] = await Promise.all([
        barcodeService.generateBarcodeImage(result.barcode),
        barcodeService.generateQRCode({
          product: product.name,
          sku: product.sku,
          barcode: result.barcode,
          price: product.unitPrice,
        }),
      ]);

      setBarcodeInfo({
        barcode: result.barcode,
        barcodeUrl: barcodeImg.barcodeUrl,
        qrCodeUrl: qrData.qrCodeUrl || '',
      });

      toast.success('Barcode generated successfully');
      setShowBarcode(true);
    } catch (err: any) {
      console.error('Failed to generate barcode:', err);
      toast.error(err?.message || 'Failed to generate barcode');
    } finally {
      if (isMountedRef.current) setLoadingBarcode(false);
    }
  }, [isAdmin, product]);

  const handleScanBarcode = useCallback(() => {
    const scanned = prompt('Enter barcode to scan:');
    if (scanned) router.push(`/admin/inventory/scan/${scanned}`);
  }, [router]);

  const handleDelete = useCallback(async () => {
    if (!canDeleteProduct) {
      toast.error("You don't have permission to delete products");
      return;
    }
    setDeleting(true);
    try {
      await productService.deleteProduct(product.id);
      toast.success('Product deleted successfully');
      router.push(isAdmin ? '/admin/catalog' : '/shop');
    } catch (err) {
      console.error('Failed to delete product:', err);
      toast.error('Failed to delete product');
    } finally {
      if (isMountedRef.current) {
        setDeleting(false);
        setShowDeleteModal(false);
      }
    }
  }, [canDeleteProduct, product, isAdmin, router]);

  // ✅ Real cart mutation — authenticated → authenticated, guest → guest.
  const handleAddToCart = useCallback(async () => {
    if (!product) return;
    setAddingToCart(true);
    try {
      const variantId = selectedVariant || undefined;
      const cart = isAuthenticated ? cartService : guestCartService;

      await cart.addItem({
        productId: product.id,
        variantId,
        quantity,
      });

      toast.success(`${product.name} added to cart`);
      window.dispatchEvent(new CustomEvent('cart:updated'));
    } catch (err: any) {
      console.error('Failed to add to cart:', err);
      toast.error(
        err?.response?.data?.message || 'Failed to add to cart',
      );
    } finally {
      if (isMountedRef.current) setAddingToCart(false);
    }
  }, [product, selectedVariant, quantity, isAuthenticated]);

  const handleQuantityChange = useCallback((delta: number) => {
    setQuantity((prev) => Math.max(1, Math.min(prev + delta, 99)));
  }, []);

  const handleShare = useCallback(() => {
    if (!product) return;
    const url = `${window.location.origin}/shop/${product.id}`;
    if (navigator.share) {
      navigator
        .share({ title: product.name, text: `Check out ${product.name}`, url })
        .catch(() => {
          /* user cancelled */
        });
    } else {
      navigator.clipboard
        .writeText(url)
        .then(() => toast.success('Product link copied'))
        .catch(() => toast.error('Failed to copy link'));
    }
  }, [product]);

  const handleOpenVariantLightbox = useCallback((variant: Variant) => {
    if (variant.images && variant.images.length > 0) {
      setLightboxImages(variant.images);
      setLightboxIndex(0);
      setShowLightbox(true);
    }
  }, []);

  // ============================================
  // DERIVED
  // ============================================

  const inventory = product?.inventory ?? null;
  const available = inventory
    ? (inventory.quantity || 0) - (inventory.reserved || 0)
    : 0;

  const selectedVariantData = useMemo<Variant | null>(() => {
    if (!selectedVariant || !product?.variants) return null;
    return product.variants.find((v) => v.id === selectedVariant) ?? null;
  }, [selectedVariant, product?.variants]);

  const displayPrice = selectedVariantData?.price ?? product?.unitPrice ?? 0;

  const totalVariants = product?.variants?.length ?? 0;
  const activeVariants =
    product?.variants?.filter((v) => v.isActive).length ?? 0;
  const totalVariantStock =
    product?.variants?.reduce((sum, v) => {
      if (v.inventory) {
        return (
          sum +
          Math.max(
            0,
            (v.inventory.quantity ?? 0) - (v.inventory.reserved ?? 0),
          )
        );
      }
      return sum + (v.stock || 0);
    }, 0) ?? 0;

  const stockStatus: StockStatus = useMemo(() => {
    if (!inventory) {
      return {
        status: 'No Stock',
        color:
          'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
        icon: XCircle,
      };
    }
    if (available <= 0) {
      return {
        status: 'Out of Stock',
        color:
          'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
        icon: XCircle,
      };
    }
    if (available <= (product.minStock || 5)) {
      return {
        status: 'Low Stock',
        color:
          'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
        icon: AlertCircle,
      };
    }
    return {
      status: 'In Stock',
      color:
        'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
      icon: CheckCircle,
    };
  }, [inventory, available, product?.minStock]);

  const images = product?.images ?? [];
  const hasImages = images.length > 0;
  const hasBarcode = !!barcodeInfo || !!product?.barcode;

  const visibleTabs = useMemo(() => {
    if (!isAdmin) return TABS;
    return [
      ...TABS,
      { id: 'analytics' as TabId, label: 'Analytics', icon: TrendingUp },
    ];
  }, [isAdmin]);

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderStars = useCallback((rating: number = 0) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= Math.round(rating)
                ? 'text-warning-400 fill-current'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
        {rating > 0 && (
          <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400 ml-1">
            ({rating.toFixed(1)})
          </span>
        )}
      </div>
    );
  }, []);

  const renderStarsLarge = useCallback(
    (rating: number = 0) => (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-5 h-5 ${
              star <= Math.round(rating)
                ? 'text-warning-400 fill-current'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
        {rating > 0 && (
          <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400 ml-2">
            {rating.toFixed(1)} ({product?.reviewCount || 0} reviews)
          </span>
        )}
      </div>
    ),
    [product?.reviewCount],
  );

  // ============================================
  // EARLY RETURNS
  // ============================================

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-12 h-12 animate-spin text-brand-600 dark:text-brand-400" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">
          Loading product...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 bg-gray-50 dark:bg-gray-900">
        <AlertCircle className="w-16 h-16 text-danger-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Error Loading Product
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">{error}</p>
        <button
          onClick={() => router.push(isAdmin ? '/admin/catalog' : '/shop')}
          className="mt-4 btn-brand"
        >
          {isAdmin ? 'Back to Catalog' : 'Back to Shop'}
        </button>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 bg-gray-50 dark:bg-gray-900">
        <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Product Not Found
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          The product you're looking for doesn't exist.
        </p>
        <button
          onClick={() => router.push(isAdmin ? '/admin/catalog' : '/shop')}
          className="mt-4 btn-brand"
        >
          {isAdmin ? 'Back to Catalog' : 'Back to Shop'}
        </button>
      </div>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 animate-fade-in">
      <div className="max-w-container mx-auto p-4 sm:p-6 lg:px-8 xl:px-10 2xl:px-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6 flex-wrap">
          <Link
            href="/"
            className="hover:text-gray-700 dark:hover:text-gray-300 transition duration-250 focus-ring rounded"
          >
            Home
          </Link>
          <span>/</span>
          <Link
            href={isAdmin ? '/admin/catalog' : '/shop'}
            className="hover:text-gray-700 dark:hover:text-gray-300 transition duration-250 focus-ring rounded"
          >
            {isAdmin ? 'Catalog' : 'Shop'}
          </Link>
          <span>/</span>
          {product.category && (
            <>
              <Link
                href={`/shop?category=${product.category.id}`}
                className="hover:text-gray-700 dark:hover:text-gray-300 transition duration-250 focus-ring rounded"
              >
                {product.category.name}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-gray-700 dark:text-gray-300 font-medium truncate">
            {product.name}
          </span>
        </nav>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(isAdmin ? '/admin/catalog' : '/shop')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition duration-250 focus-ring"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                {hasImages ? (
                  <img
                    src={getValidImage(images[0])}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={() => handleImageError(images[0])}
                  />
                ) : (
                  <Package className="w-full h-full p-3 text-gray-400 dark:text-gray-500" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {product.name}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Hash className="w-4 h-4" />
                    SKU: <span className="tabular-nums">{product.sku}</span>
                  </span>
                  <button
                    onClick={handleCopySKU}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition duration-250 focus-ring"
                    title="Copy SKU"
                    aria-label="Copy SKU"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-success-600 dark:text-success-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  {hasBarcode && isAdmin && (
                    <span className="flex items-center gap-1 tabular-nums">
                      <Barcode className="w-4 h-4" />
                      Barcode: {barcodeInfo?.barcode || product.barcode}
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded-full text-2xs font-medium ${
                      product.isActive
                        ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                        : 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
                    }`}
                  >
                    {product.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {product.featured && (
                    <span className="px-2 py-0.5 rounded-full text-2xs font-medium bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Featured
                    </span>
                  )}
                  {product.inventoryId && (
                    <span className="px-2 py-0.5 rounded-full text-2xs font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 flex items-center gap-1">
                      <Link2 className="w-3 h-3" />
                      Inventory Linked
                    </span>
                  )}
                  {totalVariants > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-2xs font-medium bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300">
                      {totalVariants} variants
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isAdmin && (
              <>
                <WishlistButton
                  productId={product.id}
                  variant="full"
                  size="sm"
                />
                <button
                  onClick={handleShare}
                  className="btn-secondary"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </>
            )}
            {isAdmin && canEditProduct && (
              <Link
                href={`/admin/catalog/edit/${product.id}`}
                className="btn-brand"
              >
                <Edit className="w-4 h-4" />
                Edit
              </Link>
            )}
            {isAdmin && canDeleteProduct && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-danger-600 to-brand-accent-500 hover:from-danger-700 hover:to-brand-accent-600 text-white rounded-xl flex items-center gap-2 transition duration-250 focus-ring shadow-brand"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Status alerts */}
        {isAdmin && !product.isActive && (
          <div className="mb-6 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl flex items-center gap-3 animate-slide-down">
            <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0" />
            <span className="text-danger-700 dark:text-danger-300">
              This product is currently inactive and not visible to customers.
            </span>
          </div>
        )}
        {available <= 0 && (
          <div className="mb-6 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl flex items-center gap-3 animate-slide-down">
            <AlertTriangle className="w-5 h-5 text-danger-500 flex-shrink-0" />
            <span className="text-danger-700 dark:text-danger-300">
              This product is out of stock.
            </span>
          </div>
        )}
        {isAdmin && available <= (product.minStock || 5) && available > 0 && (
          <div className="mb-6 p-4 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-xl flex items-center gap-3 animate-slide-down">
            <AlertTriangle className="w-5 h-5 text-warning-500 flex-shrink-0" />
            <span className="text-warning-700 dark:text-warning-300">
              Low stock alert. Only {available} units remaining.
            </span>
          </div>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Image gallery */}
          <div className="space-y-4">
            <div className="relative card-brand shadow-soft overflow-hidden aspect-square p-0">
              {hasImages ? (
                <img
                  src={getValidImage(images[selectedImage])}
                  alt={product.name}
                  className="w-full h-full object-contain cursor-pointer"
                  onClick={() => {
                    setLightboxImages(images);
                    setLightboxIndex(selectedImage);
                    setShowLightbox(true);
                  }}
                  onError={() => handleImageError(images[selectedImage])}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-24 h-24 text-gray-300 dark:text-gray-600" />
                </div>
              )}
              <button
                onClick={() => {
                  setLightboxImages(images);
                  setLightboxIndex(selectedImage);
                  setShowLightbox(true);
                }}
                className="absolute bottom-4 right-4 p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition duration-250 focus-ring"
                title="Zoom in"
                aria-label="Zoom in"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              {product.featured && (
                <div className="absolute top-4 left-4 px-3 py-1 bg-warning-500 text-white text-2xs rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Featured
                </div>
              )}
            </div>

            {hasImages && images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {images.map((image, index) => (
                  <button
                    key={`${image.slice(0, 24)}-${index}`}
                    onClick={() => setSelectedImage(index)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 flex-shrink-0 transition duration-250 focus-ring ${
                      selectedImage === index
                        ? 'border-brand-500 ring-2 ring-brand-500/50'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                    aria-label={`Image ${index + 1}`}
                  >
                    <img
                      src={getValidImage(image)}
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={() => handleImageError(image)}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info column */}
          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {product.name}
                  </h1>
                  {product.rating && product.rating > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      {renderStarsLarge(product.rating)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Price */}
            <div>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold tabular-nums text-brand-600 dark:text-brand-400">
                  {formatCurrency(displayPrice)}
                </span>
                {selectedVariantData &&
                  selectedVariantData.price !== product.unitPrice && (
                    <span className="text-sm tabular-nums text-gray-400 dark:text-gray-500 line-through">
                      {formatCurrency(product.unitPrice)}
                    </span>
                  )}
              </div>
              {product.taxRate > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Tax included ({product.taxRate}%)
                </p>
              )}
            </div>

            {/* Stock status */}
            <div className="flex items-center gap-4">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${stockStatus.color} flex items-center gap-1`}
              >
                <stockStatus.icon className="w-4 h-4" />
                {stockStatus.status}
              </span>
              {available > 0 && available <= 10 && (
                <span className="text-sm tabular-nums text-warning-600 dark:text-warning-400">
                  Only {available} left in stock
                </span>
              )}
            </div>

            {/* Barcode section — admin only */}
            {isAdmin && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-100 dark:bg-brand-900/30 rounded-lg">
                      <Barcode className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Barcode / QR Code
                      </p>
                      {hasBarcode ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                          {barcodeInfo?.barcode || product.barcode}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          No barcode assigned
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!hasBarcode && (
                      <button
                        onClick={handleGenerateBarcode}
                        disabled={loadingBarcode}
                        className="btn-brand disabled:opacity-50"
                      >
                        {loadingBarcode ? (
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
                          className="btn-secondary"
                        >
                          <QrCode className="w-4 h-4" />
                          {showBarcode ? 'Hide' : 'Show'}
                        </button>
                        <button
                          onClick={handlePrintBarcodeLabel}
                          className="btn-secondary"
                        >
                          <Printer className="w-4 h-4" />
                          Print
                        </button>
                        <button
                          onClick={handleDownloadBarcode}
                          className="btn-secondary"
                          aria-label="Download barcode"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={handleScanBarcode}
                      className="btn-success"
                    >
                      <Scan className="w-4 h-4" />
                      Scan
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {showBarcode && barcodeInfo && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-700/30 overflow-hidden"
                    >
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
                          <p className="text-xs font-mono tabular-nums text-gray-600 dark:text-gray-400 mt-1 text-center">
                            {barcodeInfo.barcode}
                          </p>
                          <button
                            onClick={handleCopyBarcode}
                            className="mt-1 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 flex items-center gap-1 mx-auto transition duration-250 focus-ring rounded"
                          >
                            {barcodeCopied ? (
                              <Check className="w-3 h-3 text-success-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            {barcodeCopied ? 'Copied' : 'Copy'}
                          </button>
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
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Scan to view product
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Description */}
            {product.description && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {product.description.length > 300
                    ? `${product.description.slice(0, 300)}...`
                    : product.description}
                </p>
                {product.description.length > 300 && (
                  <button
                    onClick={() => setActiveTab('overview')}
                    className="text-brand-600 dark:text-brand-400 text-sm hover:underline transition duration-250 focus-ring rounded"
                  >
                    Read more
                  </button>
                )}
              </div>
            )}

            {/* Key features */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
              {product.isDigital && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <CreditCard className="w-4 h-4 text-brand-500" />
                  <span>Digital Product</span>
                </div>
              )}
              {product.weight && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Weight className="w-4 h-4 text-secondary-500" />
                  <span className="tabular-nums">{product.weight} kg</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Truck className="w-4 h-4 text-success-500" />
                <span>Free Shipping</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <RotateCcw className="w-4 h-4 text-brand-500" />
                <span>30 Day Returns</span>
              </div>
            </div>

            {/* Variants */}
            {product.variants && product.variants.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Variants
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variants
                    .filter((v) => v.isActive)
                    .map((variant) => (
                      <button
                        key={variant.id}
                        onClick={() =>
                          setSelectedVariant(
                            selectedVariant === variant.id ? null : variant.id,
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg border text-sm transition duration-250 flex items-center gap-2 focus-ring ${
                          selectedVariant === variant.id
                            ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                            : 'border-gray-300 dark:border-gray-600 hover:border-brand-400 dark:hover:border-brand-400'
                        }`}
                      >
                        {variant.images && variant.images.length > 0 && (
                          <div
                            className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenVariantLightbox(variant);
                            }}
                          >
                            <img
                              src={getValidVariantImage(variant.images[0])}
                              alt={variant.name}
                              className="w-full h-full object-cover"
                              onError={() =>
                                handleVariantImageError(variant.images![0])
                              }
                            />
                          </div>
                        )}
                        {variant.name}
                        {variant.price !== product.unitPrice && (
                          <span className="ml-1 text-xs tabular-nums">
                            ({formatCurrency(variant.price)})
                          </span>
                        )}
                        {variant.stock <= 0 && (
                          <span className="ml-1 text-xs text-danger-500">
                            (Out of stock)
                          </span>
                        )}
                      </button>
                    ))}
                </div>
                {selectedVariantData &&
                  selectedVariantData.attributes &&
                  Object.keys(selectedVariantData.attributes).length > 0 && (
                    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Variant Attributes
                      </p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {Object.entries(selectedVariantData.attributes).map(
                          ([key, value]) => (
                            <span
                              key={key}
                              className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded"
                            >
                              {key}: {String(value)}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Tags:
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/shop?search=${tag}`}
                      className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition duration-250 focus-ring"
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Add to cart — storefront only */}
            {!isAdmin && (
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg">
                    <button
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1}
                      className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition duration-250 focus-ring"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center tabular-nums text-gray-900 dark:text-white">
                      {quantity}
                    </span>
                    <button
                      onClick={() => handleQuantityChange(1)}
                      disabled={quantity >= 99}
                      className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition duration-250 focus-ring"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={handleAddToCart}
                    disabled={available <= 0 || addingToCart}
                    className="flex-1 btn-brand disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addingToCart ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ShoppingCart className="w-5 h-5" />
                    )}
                    {addingToCart ? 'Adding...' : 'Add to Cart'}
                  </button>
                  <WishlistButton
                    productId={product.id}
                    variant="icon"
                    size="md"
                  />
                </div>
                <button
                  onClick={async () => {
                    const ok = await handleAddToCart();
                    // `handleAddToCart` doesn't return; re-check state
                    // via the event. Simpler: push to checkout after a
                    // microtask so the cart is committed server-side.
                    if (!addingToCart) router.push('/checkout');
                  }}
                  disabled={available <= 0}
                  className="w-full btn-success disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShoppingBag className="w-5 h-5" />
                  Buy Now
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="card-brand shadow-soft p-0 overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 overflow-x-auto custom-scrollbar">
            <nav className="flex gap-4">
              {visibleTabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as TabId)}
                  className={`flex items-center gap-1.5 px-4 py-3 border-b-2 font-medium text-sm transition duration-250 capitalize whitespace-nowrap focus-ring ${
                    activeTab === id
                      ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {id === 'variants' && totalVariants > 0 && (
                    <span className="ml-1 text-2xs tabular-nums bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                      {totalVariants}
                    </span>
                  )}
                  {id === 'reviews' &&
                    product.reviewCount &&
                    product.reviewCount > 0 && (
                      <span className="ml-1 text-2xs tabular-nums bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                        {product.reviewCount}
                      </span>
                    )}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-4 sm:p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 eyebrow">
                    Description
                  </h3>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {product.description || 'No description provided'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 eyebrow">
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
                      {product.weight !== undefined && (
                        <DetailRow
                          label="Weight"
                          value={`${product.weight} kg`}
                        />
                      )}
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
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 eyebrow">
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
                        label="Tax Rate"
                        value={`${product.taxRate || 0}%`}
                      />
                      <DetailRow
                        label="Min Stock"
                        value={String(product.minStock || 5)}
                      />
                      <DetailRow
                        label="Max Stock"
                        value={String(product.maxStock || 'N/A')}
                      />
                      <DetailRow
                        label="Available"
                        value={String(available)}
                        tone={
                          available <= 0
                            ? 'negative'
                            : available <= (product.minStock || 5)
                            ? 'warning'
                            : 'positive'
                        }
                        emphasize
                      />
                    </div>
                  </div>
                </div>

                {product.attributes &&
                  Object.keys(product.attributes).length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 eyebrow">
                        Attributes
                      </h3>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 overflow-x-auto custom-scrollbar">
                        <pre className="text-sm font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">
                          {JSON.stringify(product.attributes, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
              </div>
            )}

            {activeTab === 'specifications' && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 eyebrow">
                  Specifications
                </h3>
                {product.attributes &&
                Object.keys(product.attributes).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(product.attributes).map(([key, value]) => (
                      <div
                        key={key}
                        className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3"
                      >
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                          {key.replace(/_/g, ' ')}
                        </p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white break-all">
                          {typeof value === 'object'
                            ? JSON.stringify(value)
                            : String(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    No specifications available
                  </p>
                )}
              </div>
            )}

            {activeTab === 'variants' && (
              <div>
                {product.variants && product.variants.length > 0 ? (
                  <div className="space-y-4">
                    {product.variants.map((variant) => (
                      <div
                        key={variant.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition duration-250"
                      >
                        <div className="flex items-center gap-4">
                          {variant.images && variant.images.length > 0 && (
                            <div
                              className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 cursor-pointer"
                              onClick={() => handleOpenVariantLightbox(variant)}
                            >
                              <img
                                src={getValidVariantImage(variant.images[0])}
                                alt={variant.name}
                                className="w-full h-full object-cover"
                                onError={() =>
                                  handleVariantImageError(variant.images![0])
                                }
                              />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {variant.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <Hash className="w-3 h-3" />
                                SKU: <span className="tabular-nums">{variant.sku}</span>
                              </span>
                              <span className="font-medium tabular-nums text-gray-900 dark:text-white">
                                {formatCurrency(variant.price)}
                              </span>
                              <span className="tabular-nums">Stock: {variant.stock}</span>
                              {variant.barcode && isAdmin && (
                                <span className="text-xs tabular-nums">
                                  Barcode: {variant.barcode}
                                </span>
                              )}
                              {variant.inventoryId && (
                                <span className="text-xs text-brand-500 dark:text-brand-400 flex items-center gap-1">
                                  <Link2 className="w-3 h-3" />
                                  Inventory Linked
                                </span>
                              )}
                              {variant.attributes &&
                                Object.keys(variant.attributes).length >
                                  0 && (
                                  <span className="text-xs text-gray-400">
                                    {Object.entries(variant.attributes)
                                      .map(([k, v]) => `${k}: ${v}`)
                                      .join(', ')}
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
                                      className="w-10 h-10 rounded-md overflow-hidden border border-gray-200 dark:border-gray-600 cursor-pointer"
                                      onClick={() =>
                                        handleOpenVariantLightbox(variant)
                                      }
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
                                  <div className="w-10 h-10 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs tabular-nums text-gray-500">
                                    +{variant.images.length - 4}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-2xs font-medium ${
                            variant.isActive
                              ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                              : 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
                          }`}
                        >
                          {variant.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                    No variants for this product
                  </p>
                )}
              </div>
            )}

            {activeTab === 'inventory' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <StatBlock
                    label="Total Stock"
                    value={inventory?.quantity || 0}
                  />
                  <StatBlock
                    label="Reserved"
                    value={inventory?.reserved || 0}
                    tone="warning"
                  />
                  <StatBlock
                    label="Available"
                    value={available}
                    tone={
                      available <= 0
                        ? 'negative'
                        : available <= (product.minStock || 5)
                        ? 'warning'
                        : 'positive'
                    }
                  />
                  <StatBlock
                    label="Reorder Point"
                    value={inventory?.reorderPoint || product.minStock || 5}
                  />
                </div>

                {totalVariants > 0 && (
                  <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl p-4">
                    <h4 className="text-sm font-medium text-primary-800 dark:text-primary-300 mb-2">
                      Variant Stock Summary
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Total Variants
                        </span>
                        <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">
                          {totalVariants}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Active Variants
                        </span>
                        <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">
                          {activeVariants}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Combined Stock
                        </span>
                        <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">
                          {(inventory?.quantity || 0) + totalVariantStock}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-xl p-4">
                  <div className="flex flex-wrap gap-4 text-sm text-warning-700 dark:text-warning-300">
                    <span>
                      Location: {inventory?.location || 'Warehouse'}
                    </span>
                    <span className="tabular-nums">SKU: {product.sku}</span>
                    {product.barcode && isAdmin && (
                      <span className="tabular-nums">Barcode: {product.barcode}</span>
                    )}
                    <span className="text-xs tabular-nums">
                      Low stock threshold: {product.minStock || 5} units
                    </span>
                  </div>
                </div>

                {isAdmin && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2 eyebrow">
                      <ClockIcon className="w-4 h-4" />
                      Inventory History
                    </h4>
                    {loadingHistory ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
                      </div>
                    ) : inventoryHistory.length > 0 ? (
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                              <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400 eyebrow">
                                Date
                              </th>
                              <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400 eyebrow">
                                Type
                              </th>
                              <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 eyebrow">
                                Quantity
                              </th>
                              <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 eyebrow">
                                Previous
                              </th>
                              <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 eyebrow">
                                Current
                              </th>
                              <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400 eyebrow">
                                Reason
                              </th>
                              <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400 eyebrow">
                                User
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {inventoryHistory.map((entry, index) => (
                              <tr
                                key={index}
                                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition duration-250"
                              >
                                <td className="px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300">
                                  {formatDate(entry.date)}
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-2xs font-medium ${
                                      entry.type === 'in'
                                        ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                                        : entry.type === 'out'
                                        ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
                                        : entry.type === 'adjust'
                                        ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300'
                                        : 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                                    }`}
                                  >
                                    {entry.type}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right font-medium tabular-nums text-gray-900 dark:text-white">
                                  {entry.quantity > 0
                                    ? `+${entry.quantity}`
                                    : entry.quantity}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                                  {entry.previous}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-white">
                                  {entry.current}
                                </td>
                                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                  {entry.reason || '-'}
                                </td>
                                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                  {entry.user || 'System'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                        No inventory history available
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <ProductReviews productId={product.id} canManage={isAdmin} />
            )}

            {activeTab === 'analytics' && isAdmin && (
              <ProductSalesAnalytics productId={product.id} />
            )}
          </div>
        </div>

        {/* Related */}
        {!isAdmin && relatedProducts.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              You May Also Like
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((relatedProduct, index) => (
                <motion.div
                  key={relatedProduct.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <ProductCard
                    product={relatedProduct}
                    index={index}
                    variant="default"
                    showWishlist
                    showAddToCart
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Recently viewed */}
        {!isAdmin && (
          <div className="mt-8">
            <RecentlyViewed limit={6} />
          </div>
        )}

        {/* Lightbox */}
        <AnimatePresence>
          {showLightbox && lightboxImages.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-modal bg-black/90 flex items-center justify-center"
              onClick={() => setShowLightbox(false)}
            >
              <button
                onClick={() => setShowLightbox(false)}
                className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-lg transition duration-250 focus-ring"
                aria-label="Close lightbox"
              >
                <X className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) =>
                    prev > 0 ? prev - 1 : lightboxImages.length - 1,
                  );
                }}
                className="absolute left-4 p-2 text-white hover:bg-white/20 rounded-lg transition duration-250 focus-ring"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <img
                src={getValidImage(lightboxImages[lightboxIndex])}
                alt={product.name}
                className="max-w-[90vw] max-h-[90vh] object-contain"
                onClick={(e) => e.stopPropagation()}
                onError={() =>
                  handleImageError(lightboxImages[lightboxIndex])
                }
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) =>
                    prev < lightboxImages.length - 1 ? prev + 1 : 0,
                  );
                }}
                className="absolute right-4 p-2 text-white hover:bg-white/20 rounded-lg transition duration-250 focus-ring"
                aria-label="Next image"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                {lightboxImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex(index);
                    }}
                    className={`w-2 h-2 rounded-full transition-all duration-250 ${
                      lightboxIndex === index ? 'bg-white w-4' : 'bg-white/50'
                    }`}
                    aria-label={`Go to image ${index + 1}`}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete modal — admin only */}
        <AnimatePresence>
          {showDeleteModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-modal flex items-center justify-center p-4"
            >
              <div
                className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
                onClick={() => setShowDeleteModal(false)}
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6"
              >
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition duration-250 focus-ring"
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
                  ? This will permanently remove the product and all
                  associated data, including variants, inventory, and sales
                  history.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 bg-gradient-to-r from-danger-600 to-brand-accent-500 hover:from-danger-700 hover:to-brand-accent-600 text-white rounded-xl flex items-center gap-2 disabled:opacity-50 transition duration-250 focus-ring shadow-brand"
                  >
                    {deleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    {deleting ? 'Deleting...' : 'Delete Product'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ProductDetail;

// ============================================
// SMALL PRESENTATIONAL HELPERS
// ============================================

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
      <span className={`${emphasize ? 'font-medium' : ''} ${toneClass} tabular-nums`}>
        {value}
      </span>
    </div>
  );
}

interface StatBlockProps {
  label: string;
  value: number;
  tone?: 'positive' | 'negative' | 'warning' | 'neutral';
}

function StatBlock({ label, value, tone = 'neutral' }: StatBlockProps) {
  const toneClass =
    tone === 'positive'
      ? 'text-success-600 dark:text-success-400'
      : tone === 'negative'
      ? 'text-danger-600 dark:text-danger-400'
      : tone === 'warning'
      ? 'text-warning-600 dark:text-warning-400'
      : 'text-gray-900 dark:text-white';

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}
