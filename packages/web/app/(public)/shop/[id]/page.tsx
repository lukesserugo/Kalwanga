// D:\Projects\Kalwanga\packages\web\app\shop\[id]\page.tsx

'use client';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ShoppingCart,
  Star,
  Share2,
  Truck as TruckIcon,
  Shield,
  RotateCcw,
  CreditCard,
  Package,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  X,
  Minus,
  Plus,
  Loader2,
  Check,
  AlertCircle,
  Tags,
  Hash,
  Info,
  Sparkles,
  Zap,
  Barcode,
  QrCode,
  Printer,
  Copy,
  Link2,
  Layers,
  CheckCircle2,
  Crown,
  Lock,
  Flame,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react';
import PublicNavigation from '../../../../components/PublicNavigation';
import { productService } from '../../../../services/productService';
import { toast } from '../../../../utils/toast-manager';
import {
  formatCurrency,
  formatDate,
} from '../../../../utils/formatters';
import { WishlistButton } from '../../../../components/products/WishlistButton';
import { RecentlyViewed } from '../../../../components/products/RecentlyViewed';
import { ProductReviews } from '../../../../components/products/ProductReviews';
import { useThemeStore } from '../../../../components/stores/themeStore';
import { useAuth } from '../../../../hooks/useAuth';
import { ProductCard } from '../../../../components/products/ProductCard';
import { cartService } from '../../../../services/cartService';
import { guestCartService } from '../../../../services/guestCartService';
import { guestRecentlyViewedService } from '../../../../services/guestRecentlyViewedService';

// ============================================
// BACKEND CONTRACT
// ============================================
//
// The shop product page is public. It calls `getPublicProductById` and
// `getRelatedProducts`, which are registered before `requireAuth` in
// `routes/products.ts`.
//
// Cart endpoints branch on auth:
//   Authenticated → /cart/*
//   Guest         → /cart/guest/*
//
// Checkout endpoint (canonical):
//   POST /checkout   (with idempotencyKey)

interface Inventory {
  id: string;
  quantity: number;
  reserved: number;
  available?: number;
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
  inventory?: Inventory | null;
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
  categoryId?: string | null;
  supplier?: { id: string; name: string } | null;
  inventory?: Inventory | null;
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

type TabKey = 'description' | 'specifications' | 'reviews' | 'attributes';

// ============================================
// CONSTANTS
// ============================================

const SIZES = {
  container:
    'max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12',
  headerHeight: 'pt-24 md:pt-28 lg:pt-28',
};

const PLACEHOLDER_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// ============================================
// HELPERS
// ============================================

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toLocalProduct(raw: any): Product {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid product payload');
  }
  return {
    id: raw.id,
    name: raw.name,
    sku: raw.sku,
    description: raw.description ?? null,
    unitPrice: raw.unitPrice ?? 0,
    costPrice: raw.costPrice ?? null,
    barcode: raw.barcode ?? null,
    images: Array.isArray(raw.images) ? raw.images : [],
    category: raw.category ?? null,
    categoryId: raw.categoryId ?? null,
    supplier: raw.supplier ?? null,
    inventory: raw.inventory
      ? {
          id: raw.inventory.id,
          quantity: raw.inventory.quantity || 0,
          reserved: raw.inventory.reserved || 0,
          available:
            (raw.inventory.quantity || 0) -
            (raw.inventory.reserved || 0),
        }
      : null,
    variants: Array.isArray(raw.variants)
      ? raw.variants.map((v: any): Variant => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          price: v.price || 0,
          stock: v.stock || 0,
          isActive: v.isActive !== undefined ? v.isActive : true,
          images: v.images || [],
          attributes: v.attributes || {},
          barcode: v.barcode ?? null,
          inventoryId: v.inventoryId ?? null,
          inventory: v.inventory
            ? {
                id: v.inventory.id,
                quantity: v.inventory.quantity || 0,
                reserved: v.inventory.reserved || 0,
                available:
                  (v.inventory.quantity || 0) -
                  (v.inventory.reserved || 0),
              }
            : null,
        }))
      : null,
    isActive: raw.isActive !== undefined ? raw.isActive : true,
    isDigital: raw.isDigital || false,
    weight: raw.weight ?? null,
    taxRate: raw.taxRate || 0,
    minStock: raw.minStock ?? 5,
    attributes: raw.attributes || null,
    rating: raw.rating ?? null,
    reviewCount: raw.reviewCount ?? 0,
    tags: raw.tags || [],
    featured: raw.featured || false,
    inventoryId: raw.inventoryId ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ShopProductPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { isDark } = useThemeStore();
  const { isAuthenticated } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('description');
  const [openSections, setOpenSections] = useState<Record<TabKey, boolean>>({
    description: true,
    specifications: false,
    reviews: false,
    attributes: false,
  });
  const [selectedVariant, setSelectedVariant] = useState<string | null>(
    null,
  );
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeInfo, setBarcodeInfo] = useState<BarcodeInfo | null>(null);
  const [loadingBarcode, setLoadingBarcode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedAttributes, setExpandedAttributes] = useState<Set<string>>(
    new Set(),
  );
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);
  const [showCartPill, setShowCartPill] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [variantImageErrors, setVariantImageErrors] = useState<Set<string>>(
    new Set(),
  );

  const isMountedRef = useRef(true);
  const productLoadedRef = useRef(false);
  const relatedLoadedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ============================================
  // IMAGE ERROR HANDLERS
  // ============================================

  const handleImageError = useCallback((imageUrl: string) => {
    setImageErrors((prev) => {
      if (prev.has(imageUrl)) return prev;
      const next = new Set(prev);
      next.add(imageUrl);
      return next;
    });
  }, []);

  const handleVariantImageError = useCallback((imageUrl: string) => {
    setVariantImageErrors((prev) => {
      if (prev.has(imageUrl)) return prev;
      const next = new Set(prev);
      next.add(imageUrl);
      return next;
    });
  }, []);

  const getValidImage = useCallback(
    (imageUrl: string | undefined): string => {
      if (!imageUrl) return PLACEHOLDER_IMAGE;
      if (imageErrors.has(imageUrl)) return PLACEHOLDER_IMAGE;
      return imageUrl;
    },
    [imageErrors],
  );

  const getValidVariantImage = useCallback(
    (imageUrl: string | undefined): string => {
      if (!imageUrl) return PLACEHOLDER_IMAGE;
      if (variantImageErrors.has(imageUrl)) return PLACEHOLDER_IMAGE;
      return imageUrl;
    },
    [variantImageErrors],
  );

  // ============================================
  // CART HANDLERS
  // ============================================

  /**
   * Fetch the active cart from whichever service matches the current
   * auth state. The two services hit different endpoints:
   *
   *   cartService       → /cart/*
   *   guestCartService  → /cart/guest/*
   */
  const fetchCartData = useCallback(async () => {
    try {
      const cart = isAuthenticated ? cartService : guestCartService;
      const response = await cart.getCart();
      if (!isMountedRef.current) return;
      if (response) {
        setCartCount(response.items?.length || 0);
        setCartTotal(response.total || 0);
      } else {
        setCartCount(0);
        setCartTotal(0);
      }
    } catch {
      if (!isMountedRef.current) return;
      setCartCount(0);
      setCartTotal(0);
    }
  }, [isAuthenticated]);

  /**
   * Add item to cart. No price is sent — the server looks it up.
   * A 401 on an authenticated cart means the session expired; the
   * shopper is redirected to login.
   */
  const handleAddToCart = useCallback(async (): Promise<boolean> => {
    if (!product) return false;

    setAddingToCart(true);
    try {
      const cart = isAuthenticated ? cartService : guestCartService;
      await cart.addItem({
        productId: product.id,
        variantId: selectedVariant || undefined,
        quantity,
      });
      toast.success(`${product.name} added to cart`);
      await fetchCartData();
      window.dispatchEvent(new CustomEvent('cart:updated'));
      return true;
    } catch (err: any) {
      console.error('Failed to add to cart:', err);

      if (err?.response?.status === 401 && isAuthenticated) {
        router.push(
          `/login?redirect_url=${encodeURIComponent(
            `/shop/${product.id}`,
          )}`,
        );
        return false;
      }

      toast.error(
        err?.response?.data?.message || 'Failed to add to cart',
      );
      return false;
    } finally {
      if (isMountedRef.current) setAddingToCart(false);
    }
  }, [
    product,
    selectedVariant,
    quantity,
    fetchCartData,
    isAuthenticated,
    router,
  ]);

  /**
   * Buy Now. Adds to cart then routes to checkout. Guests are first
   * sent to login so the checkout page has an authenticated user.
   */
  const handleBuyNow = useCallback(async () => {
    if (!product) return;
    const ok = await handleAddToCart();
    if (!ok) return;

    if (!isAuthenticated) {
      router.push(
        `/login?redirect_url=${encodeURIComponent('/checkout')}`,
      );
      return;
    }

    router.push('/checkout');
  }, [product, handleAddToCart, router, isAuthenticated]);

  // ============================================
  // DATA FETCHING
  // ============================================

  const loadRelatedProducts = useCallback(
    async (productId: string) => {
      if (relatedLoadedRef.current) return;

      try {
        const data = await productService.getRelatedProducts(
          productId,
          4,
        );
        if (!isMountedRef.current) return;
        setRelatedProducts((data || []).map(toLocalProduct));
        relatedLoadedRef.current = true;
      } catch (err: any) {
        if (
          err?.response?.status !== 401 &&
          err?.response?.status !== 403
        ) {
          console.warn('Related products unavailable:', err?.message);
        }
      }
    },
    [],
  );

  const recordView = useCallback(
    async (productId: string) => {
      try {
        if (isAuthenticated) {
          await productService.addRecentlyViewed(productId);
        } else {
          await guestRecentlyViewedService.add(productId);
        }
      } catch {
        /* tracking is best-effort */
      }
    },
    [isAuthenticated],
  );

  const fetchProduct = useCallback(async () => {
    if (productLoadedRef.current) return;
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      setImageErrors(new Set());
      setVariantImageErrors(new Set());

      const data = await productService.getPublicProductById(id);
      const transformedProduct = toLocalProduct(data);

      if (!isMountedRef.current) return;
      setProduct(transformedProduct);
      setLightboxImages(transformedProduct.images || []);
      productLoadedRef.current = true;

      recordView(id);

      await loadRelatedProducts(id);
      await fetchCartData();
    } catch (err: any) {
      console.error('Error fetching product:', err);
      if (!isMountedRef.current) return;
      setProduct(null);
      const status = err?.response?.status;
      setError(
        status === 404
          ? 'Product not found'
          : 'Failed to load product',
      );
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [id, recordView, fetchCartData, loadRelatedProducts]);

  useEffect(() => {
    if (!id) return;

    productLoadedRef.current = false;
    relatedLoadedRef.current = false;

    setSelectedImage(0);
    setQuantity(1);
    setSelectedVariant(null);
    setActiveTab('description');
    setOpenSections({
      description: true,
      specifications: false,
      reviews: false,
      attributes: false,
    });
    setExpandedAttributes(new Set());
    setShowBarcodeModal(false);
    setBarcodeInfo(null);
    setShowLightbox(false);
    setLightboxIndex(0);

    fetchProduct();
  }, [id, fetchProduct]);

  useEffect(() => {
    fetchCartData();
  }, [fetchCartData]);

  useEffect(() => {
    const handleScroll = () => {
      setShowCartPill(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ============================================
  // HANDLERS
  // ============================================

  const handleQuantityChange = useCallback((delta: number) => {
    setQuantity((prev) => Math.max(1, Math.min(prev + delta, 99)));
  }, []);

  const handleViewBarcode = useCallback(async () => {
    if (!product) return;

    setLoadingBarcode(true);
    setShowBarcodeModal(true);

    try {
      if (product.barcode) {
        const info = await productService.getProductBarcode(product.id);
        if (!isMountedRef.current) return;
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
        if (!isMountedRef.current) return;
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
        setProduct((prev) =>
          prev ? { ...prev, barcode: result.barcode } : null,
        );
        toast.success('Barcode generated successfully');
      }
    } catch (err: any) {
      console.error('Failed to get barcode:', err);
      if (!isMountedRef.current) return;
      toast.error(err?.message || 'Failed to load barcode');
      setShowBarcodeModal(false);
    } finally {
      if (isMountedRef.current) setLoadingBarcode(false);
    }
  }, [product]);

  const handleCopyBarcode = useCallback(async () => {
    if (!barcodeInfo?.barcode) return;
    try {
      await navigator.clipboard.writeText(barcodeInfo.barcode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Barcode copied');
    } catch {
      toast.error('Failed to copy');
    }
  }, [barcodeInfo]);

  const handlePrintBarcode = useCallback(() => {
    if (!barcodeInfo || !product) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const safeName = escapeHtml(product.name || 'Product');
    const safeSku = escapeHtml(product.sku || 'N/A');
    const safeBarcode = escapeHtml(barcodeInfo.barcode);
    const safeCategory = product.category?.name
      ? escapeHtml(product.category.name)
      : '';

    printWindow.document.write(`
      <html>
        <head>
          <title>Barcode - ${safeName}</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: white; }
            .container { text-align: center; padding: 30px; border: 1px solid #ddd; border-radius: 8px; max-width: 400px; }
            .product-name { margin: 0 0 5px 0; font-size: 16px; font-weight: bold; }
            .sku { color: #666; font-size: 12px; margin: 0 0 15px 0; }
            .barcode-img { max-width: 300px; margin: 10px 0; }
            .qr-img { max-width: 120px; margin: 10px 0; }
            .price { font-size: 20px; font-weight: bold; color: #f97316; margin: 5px 0; }
            .info { margin-top: 10px; font-size: 12px; color: #666; }
            .info span { margin: 0 8px; }
            .linked-badge { display: inline-block; background: #fff7ed; color: #ea580c; padding: 2px 8px; border-radius: 12px; font-size: 10px; margin-top: 5px; }
            @media print { .container { border: none; padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="product-name">${safeName}</div>
            <div class="sku">SKU: ${safeSku}</div>
            ${product.inventoryId ? '<div class="linked-badge">Linked to Inventory</div>' : ''}
            ${barcodeInfo.barcodeUrl ? `<img src="${barcodeInfo.barcodeUrl}" alt="Barcode" class="barcode-img" onerror="this.style.display='none'" />` : ''}
            ${barcodeInfo.qrCodeUrl ? `<img src="${barcodeInfo.qrCodeUrl}" alt="QR Code" class="qr-img" onerror="this.style.display='none'" />` : ''}
            <div class="price">${formatCurrency(product.unitPrice || 0)}</div>
            <div class="info">
              <span>${safeBarcode}</span>
              ${safeCategory ? `<span>| ${safeCategory}</span>` : ''}
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
        .catch(() => {});
    } else {
      navigator.clipboard
        .writeText(url)
        .then(() => toast.success('Product link copied'))
        .catch(() => toast.error('Failed to copy link'));
    }
  }, [product]);

  const toggleAttribute = useCallback((key: string) => {
    setExpandedAttributes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleOpenVariantLightbox = useCallback((variant: Variant) => {
    if (variant.images && variant.images.length > 0) {
      setLightboxImages(variant.images);
      setLightboxIndex(0);
      setShowLightbox(true);
    }
  }, []);

  const toggleSection = useCallback((key: TabKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
    setActiveTab(key);
  }, []);

  // ============================================
  // DERIVED STATE
  // ============================================

  const stockMetrics = useMemo(
    () =>
      product
        ? productService.getProductStock(product as any)
        : {
            available: 0,
            total: 0,
            isInStock: false,
            isLowStock: false,
            variantStock: 0,
          },
    [product],
  );

  const available = stockMetrics.total;

  const stock = useMemo(() => {
    if (!product) {
      return {
        status: 'No Stock',
        color: 'bg-gray-100 text-gray-600',
      };
    }
    if (stockMetrics.total <= 0) {
      return {
        status: 'Out of Stock',
        color: 'bg-gradient-to-r from-red-600 to-rose-600 text-white',
      };
    }
    if (stockMetrics.isLowStock) {
      return {
        status: `Only ${stockMetrics.available} Left!`,
        color: 'bg-gradient-to-r from-red-500 to-orange-500 text-white',
      };
    }
    return {
      status: 'In Stock',
      color:
        'bg-gradient-to-r from-emerald-500 to-green-600 text-white',
    };
  }, [product, stockMetrics]);

  const images = product?.images || [];
  const hasImages = images.length > 0;

  const selectedVariantData = useMemo(
    () =>
      selectedVariant
        ? product?.variants?.find((v) => v.id === selectedVariant) ??
          null
        : null,
    [selectedVariant, product?.variants],
  );

  const displayPrice = useMemo(
    () => selectedVariantData?.price ?? product?.unitPrice ?? 0,
    [selectedVariantData, product?.unitPrice],
  );

  const isLinkedToInventory = !!product?.inventoryId;

  const renderStarsLarge = useCallback(
    (rating: number = 0) => (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 md:w-5 md:h-5 ${
              star <= Math.round(rating)
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
        {rating > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
            {rating.toFixed(1)} ({product?.reviewCount || 0} reviews)
          </span>
        )}
      </div>
    ),
    [product?.reviewCount],
  );

  const relatedProductCards = useMemo(() => {
    if (relatedProducts.length === 0) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-14"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-orange-500" />
            You May Also Like
          </h2>
          <Link
            href="/shop"
            className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 transition-colors inline-flex items-center gap-1"
          >
            View All
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 xl:gap-6">
          {relatedProducts.map((relatedProduct, index) => (
            <motion.div
              key={relatedProduct.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <ProductCard
                product={{
                  ...relatedProduct,
                  images: relatedProduct.images || [],
                }}
                index={index}
                variant="default"
                showWishlist={true}
                showAddToCart={true}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  }, [relatedProducts]);

  // ============================================
  // RENDER — loading skeleton
  // ============================================

  if (loading) {
    return (
      <div
        className={`min-h-screen ${
          isDark ? 'dark bg-gray-950' : 'bg-orange-50'
        } transition-colors duration-300`}
      >
        <PublicNavigation />
        <div className={`${SIZES.container} ${SIZES.headerHeight} pb-16`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 xl:gap-12">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm aspect-square animate-pulse" />
            <div className="space-y-6">
              <div className="h-8 xl:h-10 bg-orange-100 dark:bg-gray-800 rounded-lg w-3/4 animate-pulse" />
              <div className="h-6 bg-orange-100 dark:bg-gray-800 rounded-lg w-1/2 animate-pulse" />
              <div className="h-12 xl:h-14 bg-orange-100 dark:bg-gray-800 rounded-lg w-1/3 animate-pulse" />
              <div className="h-32 bg-orange-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              <div className="h-12 bg-orange-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER — error / not found
  // ============================================

  if (error || !product) {
    return (
      <div
        className={`min-h-screen ${
          isDark ? 'dark bg-gray-950' : 'bg-orange-50'
        } transition-colors duration-300`}
      >
        <PublicNavigation />
        <div className={`${SIZES.container} ${SIZES.headerHeight} pb-16`}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-12 xl:p-16 text-center max-w-xl mx-auto"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/20 dark:to-amber-900/20 rounded-full mb-5">
              <Package className="w-10 h-10 text-orange-500" />
            </div>
            <h1 className="text-2xl xl:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {error === 'Product not found'
                ? 'Product Not Found'
                : 'Something Went Wrong'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {error === 'Product not found'
                ? "The product you're looking for doesn't exist or has been removed."
                : "We couldn't load this product. Please try again later."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/shop"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-medium transition-all duration-200 shadow-lg"
              >
                <ShoppingCart className="w-4 h-4" />
                Browse Products
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-200 dark:border-gray-700 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 text-gray-700 dark:text-gray-300"
              >
                <RotateCcw className="w-4 h-4" />
                Retry
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER — product detail
  // ============================================

  return (
    <div
      className={`min-h-screen ${
        isDark
          ? 'dark bg-gray-950'
          : 'bg-gradient-to-b from-orange-50 via-white to-amber-50'
      } transition-colors duration-300`}
    >
      <PublicNavigation />

      <div className={`${SIZES.container} ${SIZES.headerHeight} pb-16`}>
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-5 overflow-x-auto">
          <Link
            href="/"
            className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors whitespace-nowrap flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          <Link
            href="/shop"
            className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors whitespace-nowrap"
          >
            Shop
          </Link>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          {product.category && (
            <>
              <Link
                href={`/shop?category=${product.category.id}`}
                className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors whitespace-nowrap"
              >
                {product.category.name}
              </Link>
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            </>
          )}
          <span className="text-gray-700 dark:text-gray-300 font-medium truncate">
            {product.name}
          </span>
        </nav>

        {/* ============================================
            PRODUCT MAIN
            ============================================ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 xl:gap-16"
        >
          {/* IMAGE GALLERY */}
          <div className="space-y-3">
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-orange-100 dark:border-gray-700 overflow-hidden aspect-square group">
              {hasImages ? (
                <img
                  src={getValidImage(images[selectedImage])}
                  alt={product.name}
                  className="w-full h-full object-contain cursor-pointer group-hover:scale-105 transition-transform duration-500"
                  onClick={() => {
                    setLightboxImages(images);
                    setLightboxIndex(selectedImage);
                    setShowLightbox(true);
                  }}
                  onError={() => handleImageError(images[selectedImage])}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-28 h-28 text-gray-300 dark:text-gray-600" />
                </div>
              )}

              <div className="absolute top-3 left-3 flex flex-col gap-2">
                {product.featured && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-amber-400 to-yellow-500 text-white text-xs font-medium rounded-full shadow-md">
                    <Crown className="w-3 h-3" />
                    Featured
                  </span>
                )}
                {isLinkedToInventory && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-medium rounded-full shadow-md">
                    <Link2 className="w-3 h-3" />
                    Inventory
                  </span>
                )}
                {!product.isActive && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-red-600 to-rose-600 text-white text-xs font-medium rounded-full shadow-md">
                    <AlertCircle className="w-3 h-3" />
                    Inactive
                  </span>
                )}
              </div>

              <button
                onClick={() => {
                  setLightboxImages(images);
                  setLightboxIndex(selectedImage);
                  setShowLightbox(true);
                }}
                className="absolute bottom-3 right-3 p-2.5 bg-black/50 hover:bg-black/70 text-white rounded-xl backdrop-blur-sm transition-all duration-200 opacity-0 group-hover:opacity-100"
                aria-label="Zoom image"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {hasImages && images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1.5 custom-scrollbar">
                {images.map((image: string, index: number) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all duration-200 ${
                      selectedImage === index
                        ? 'border-orange-500 ring-2 ring-orange-500 ring-opacity-50 shadow-md'
                        : 'border-gray-200 dark:border-gray-700 hover:border-orange-400 dark:hover:border-orange-400'
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

          {/* PRODUCT INFO */}
          <div className="space-y-5">
            <div>
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-tight">
                  {product.name}
                </h1>
                <WishlistButton
                  productId={product.id}
                  variant="icon"
                  size="lg"
                />
              </div>
              {product.rating && product.rating > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  {renderStarsLarge(product.rating)}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" />
                  {product.sku}
                </span>
                {product.barcode && isAuthenticated && (
                  <button
                    onClick={handleViewBarcode}
                    className="inline-flex items-center gap-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 transition-colors font-medium"
                  >
                    <Barcode className="w-3.5 h-3.5" />
                    Barcode
                  </button>
                )}
                {product.tags && product.tags.length > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Tags className="w-3.5 h-3.5" />
                    {product.tags.slice(0, 2).join(', ')}
                    {product.tags.length > 2 &&
                      ` +${product.tags.length - 2}`}
                  </span>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-2xl p-5 border border-orange-100 dark:border-orange-900/30">
              <div className="flex flex-wrap items-end gap-3">
                <span className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent tabular-nums">
                  {formatCurrency(displayPrice)}
                </span>
                {selectedVariantData &&
                  selectedVariantData.price !== product.unitPrice && (
                    <span className="text-base text-gray-400 line-through">
                      {formatCurrency(product.unitPrice)}
                    </span>
                  )}
              </div>
              {product.taxRate !== undefined &&
                product.taxRate !== null &&
                product.taxRate > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Tax included ({product.taxRate}%)
                  </p>
                )}
            </div>

            {/* Stock status */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${stock.color} shadow-sm`}
              >
                {stock.status}
              </span>
              {available > 0 && available <= 10 && (
                <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-semibold animate-pulse">
                  <Flame className="w-3.5 h-3.5" />
                  Selling fast
                </span>
              )}
              {isLinkedToInventory && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <Shield className="w-3.5 h-3.5" />
                  Inventory managed
                </span>
              )}
            </div>

            {/* Variants */}
            {product.variants && product.variants.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-orange-500" />
                  Variant
                  <span className="text-gray-400">
                    ({product.variants.filter((v) => v.isActive).length})
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variants
                    .filter((v) => v.isActive)
                    .map((variant) => {
                      const isSelected = selectedVariant === variant.id;
                      return (
                        <button
                          key={variant.id}
                          onClick={() =>
                            setSelectedVariant(
                              isSelected ? null : variant.id,
                            )
                          }
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 ${
                            isSelected
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 shadow-sm'
                              : 'border-gray-200 dark:border-gray-700 hover:border-orange-400 dark:hover:border-orange-400 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {variant.images && variant.images.length > 0 && (
                            <span
                              className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenVariantLightbox(variant);
                              }}
                            >
                              <img
                                src={getValidVariantImage(
                                  variant.images?.[0],
                                )}
                                alt={variant.name}
                                className="w-full h-full object-cover"
                                onError={() =>
                                  handleVariantImageError(
                                    variant.images?.[0] || '',
                                  )
                                }
                              />
                            </span>
                          )}
                          <span>{variant.name}</span>
                          {variant.stock <= 0 && (
                            <span className="text-[10px] text-red-600">
                              Out
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>

                {selectedVariantData &&
                  selectedVariantData.attributes &&
                  Object.keys(selectedVariantData.attributes).length >
                    0 && (
                    <div className="mt-3 p-3 bg-orange-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(
                          selectedVariantData.attributes,
                        ).map(([key, value]) => (
                          <span
                            key={key}
                            className="text-[11px] bg-white dark:bg-gray-700 px-2 py-0.5 rounded-full text-gray-700 dark:text-gray-300 shadow-sm"
                          >
                            {key}: {String(value)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* Description preview */}
            {product.description && (
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {product.description.length > 200
                  ? `${product.description.slice(0, 200)}...`
                  : product.description}
                {product.description.length > 200 && (
                  <button
                    onClick={() => toggleSection('description')}
                    className="ml-1 text-orange-600 dark:text-orange-400 font-medium hover:underline"
                  >
                    Read more
                  </button>
                )}
              </p>
            )}

            {/* Quantity + Add to Cart */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="flex items-center bg-white dark:bg-gray-900 border-2 border-orange-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1}
                  className="px-3 py-3 hover:bg-orange-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center text-base font-semibold text-gray-900 dark:text-white tabular-nums">
                  {quantity}
                </span>
                <button
                  onClick={() => handleQuantityChange(1)}
                  disabled={quantity >= 99}
                  className="px-3 py-3 hover:bg-orange-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={handleAddToCart}
                disabled={available <= 0 || addingToCart}
                className="flex-1 min-w-[180px] px-6 py-3.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {addingToCart ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ShoppingCart className="w-5 h-5" />
                )}
                {addingToCart ? 'Adding...' : 'Add to Cart'}
              </button>
              <button
                onClick={handleBuyNow}
                disabled={available <= 0 || addingToCart}
                className="px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                <Zap className="w-5 h-5" />
                Buy Now
              </button>
            </div>

            {/* Secondary actions */}
            <div className="flex flex-wrap items-center gap-1 pt-2">
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-500 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-800 rounded-lg transition-all duration-200 text-xs font-medium"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share
              </button>
              {product.barcode && isAuthenticated && (
                <button
                  onClick={handleViewBarcode}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-500 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-800 rounded-lg transition-all duration-200 text-xs font-medium"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  QR
                </button>
              )}
              <button
                onClick={() => toggleSection('specifications')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-500 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-800 rounded-lg transition-all duration-200 text-xs font-medium"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Specs
              </button>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400 pt-2">
              <span className="inline-flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                Secure
              </span>
              <span className="inline-flex items-center gap-1">
                <TruckIcon className="w-3.5 h-3.5 text-blue-500" />
                Free shipping
              </span>
              <span className="inline-flex items-center gap-1">
                <RotateCcw className="w-3.5 h-3.5 text-orange-500" />
                30-day returns
              </span>
              <span className="inline-flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-orange-500" />
                {product.isDigital ? 'Digital' : 'Physical'}
              </span>
              {product.weight && (
                <span className="inline-flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-amber-500" />
                  {product.weight}kg
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* ============================================
            COLLAPSIBLE INFO SECTIONS
            ============================================ */}
        <div className="mt-12 space-y-3">
          {(
            [
              {
                key: 'description' as TabKey,
                label: 'Description',
                icon: <Info className="w-4 h-4" />,
                accentClass:
                  'bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 text-orange-600 dark:text-orange-400',
              },
              {
                key: 'specifications' as TabKey,
                label: 'Specifications',
                icon: <Hash className="w-4 h-4" />,
                accentClass:
                  'bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 text-emerald-600 dark:text-emerald-400',
              },
              {
                key: 'reviews' as TabKey,
                label: `Reviews (${product.reviewCount || 0})`,
                icon: <Star className="w-4 h-4" />,
                accentClass:
                  'bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 text-yellow-600 dark:text-yellow-400',
              },
              {
                key: 'attributes' as TabKey,
                label: 'Attributes',
                icon: <Tags className="w-4 h-4" />,
                accentClass:
                  'bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 text-violet-600 dark:text-violet-400',
              },
            ] as const
          ).map(({ key, label, icon, accentClass }) => (
            <div
              key={key}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-orange-50 dark:border-gray-700 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleSection(key)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left"
              >
                <span
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${accentClass}`}
                >
                  {icon}
                </span>
                <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-white">
                  {label}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${
                    openSections[key] ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <AnimatePresence initial={false}>
                {openSections[key] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-1 border-t border-gray-100 dark:border-gray-700/50">
                      {key === 'description' && (
                        <div>
                          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed text-sm">
                            {product.description ||
                              'No description provided'}
                          </p>
                          {product.variants &&
                            product.variants.length > 0 && (
                              <div className="mt-5">
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2 text-xs uppercase tracking-wide">
                                  <Layers className="w-3.5 h-3.5 text-orange-500" />
                                  Available Variants
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {product.variants
                                    .filter((v) => v.isActive)
                                    .map((variant) => (
                                      <div
                                        key={variant.id}
                                        className="flex justify-between items-center py-2.5 px-3 bg-orange-50 dark:bg-gray-800 rounded-lg"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          {variant.images &&
                                            variant.images.length >
                                              0 && (
                                              <div
                                                className="w-6 h-6 rounded-full overflow-hidden cursor-pointer shrink-0"
                                                onClick={() =>
                                                  handleOpenVariantLightbox(
                                                    variant,
                                                  )
                                                }
                                              >
                                                <img
                                                  src={getValidVariantImage(
                                                    variant.images?.[0],
                                                  )}
                                                  alt={variant.name}
                                                  className="w-full h-full object-cover"
                                                  onError={() =>
                                                    handleVariantImageError(
                                                      variant
                                                        .images?.[0] || '',
                                                    )
                                                  }
                                                />
                                              </div>
                                            )}
                                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                                            {variant.name}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <span className="text-xs font-semibold text-gray-900 dark:text-white">
                                            {formatCurrency(
                                              variant.price,
                                            )}
                                          </span>
                                          {variant.stock > 0 ? (
                                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                          ) : (
                                            <AlertCircle className="w-3 h-3 text-red-500" />
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}
                        </div>
                      )}

                      {key === 'specifications' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {[
                            {
                              label: 'SKU',
                              value: product.sku,
                              mono: true,
                            },
                            {
                              label: 'Barcode',
                              value: product.barcode || 'N/A',
                              mono: true,
                            },
                            {
                              label: 'Category',
                              value: product.category?.name || 'N/A',
                            },
                            {
                              label: 'Supplier',
                              value: product.supplier?.name || 'N/A',
                            },
                            {
                              label: 'Weight',
                              value: product.weight
                                ? `${product.weight} kg`
                                : 'N/A',
                            },
                            {
                              label: 'Type',
                              value: product.isDigital
                                ? 'Digital'
                                : 'Physical',
                            },
                            {
                              label: 'Added',
                              value: formatDate(product.createdAt),
                            },
                            {
                              label: 'Inventory',
                              value: isLinkedToInventory
                                ? 'Linked'
                                : 'Not Linked',
                            },
                            {
                              label: 'Rating',
                              value: product.rating
                                ? `${product.rating.toFixed(
                                    1,
                                  )} (${product.reviewCount || 0})`
                                : 'No rating',
                            },
                          ].map((spec, index) => (
                            <div
                              key={index}
                              className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-3"
                            >
                              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">
                                {spec.label}
                              </p>
                              <p
                                className={`text-sm font-semibold text-gray-900 dark:text-white ${
                                  spec.mono ? 'font-mono' : ''
                                }`}
                              >
                                {spec.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {key === 'reviews' && (
                        <ProductReviews
                          productId={product.id}
                          canManage={false}
                        />
                      )}

                      {key === 'attributes' && (
                        <div>
                          {product.attributes &&
                          Object.keys(product.attributes).length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {Object.entries(product.attributes).map(
                                ([attrKey, value]) => (
                                  <div
                                    key={attrKey}
                                    className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-4"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 capitalize">
                                        {attrKey}
                                      </span>
                                      <button
                                        onClick={() =>
                                          toggleAttribute(attrKey)
                                        }
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                      >
                                        <ChevronRight
                                          className={`w-4 h-4 transition-transform ${
                                            expandedAttributes.has(
                                              attrKey,
                                            )
                                              ? 'rotate-90'
                                              : ''
                                          }`}
                                        />
                                      </button>
                                    </div>
                                    <div
                                      className={`mt-1.5 overflow-hidden transition-all ${
                                        expandedAttributes.has(attrKey)
                                          ? 'max-h-40'
                                          : 'max-h-5'
                                      }`}
                                    >
                                      <p className="text-xs font-semibold text-gray-900 dark:text-white break-all">
                                        {typeof value === 'object'
                                          ? JSON.stringify(value, null, 2)
                                          : String(value)}
                                      </p>
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-center py-8 text-sm">
                              No attributes available
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Related products */}
        {relatedProductCards}

        {/* Recently viewed */}
        {product && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-14"
          >
            <RecentlyViewed limit={6} />
          </motion.div>
        )}
      </div>

      {/* ============================================
          FLOATING CART PILL
          ============================================ */}
      <AnimatePresence>
        {cartCount > 0 && showCartPill && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-40 group"
          >
            <div className="relative">
              <button
                onClick={() => router.push('/cart')}
                className="flex items-center gap-2 pl-3 pr-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full shadow-2xl transition-all duration-200 group-hover:opacity-0 group-hover:pointer-events-none"
                aria-label="View cart"
              >
                <span className="relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20">
                  <ShoppingCart className="w-4 h-4" />
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-orange-600 text-[10px] font-bold flex items-center justify-center">
                    {cartCount}
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatCurrency(cartTotal)}
                </span>
              </button>

              <div className="absolute bottom-0 right-0 flex items-center gap-1 pl-1 pr-1 py-1 bg-white dark:bg-gray-900 rounded-full shadow-2xl border border-orange-200 dark:border-gray-700 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:scale-100 group-focus-within:pointer-events-auto transition-all duration-200 origin-bottom-right">
                <button
                  onClick={() => router.push('/cart')}
                  className="px-3 py-2 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap"
                >
                  View Cart
                </button>
                <button
                  onClick={() => router.push('/checkout')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-full text-xs font-semibold shadow-sm whitespace-nowrap"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Checkout
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================
          LIGHTBOX
          ============================================ */}
      <AnimatePresence>
        {showLightbox && lightboxImages.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center backdrop-blur-sm"
            onClick={() => setShowLightbox(false)}
          >
            <button
              onClick={() => setShowLightbox(false)}
              className="absolute top-6 right-6 p-3 text-white hover:bg-white/20 rounded-xl transition-all duration-200"
              aria-label="Close lightbox"
            >
              <X className="w-6 h-6" />
            </button>
            {lightboxImages.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) =>
                    prev > 0 ? prev - 1 : lightboxImages.length - 1,
                  );
                }}
                className="absolute left-6 p-3 text-white hover:bg-white/20 rounded-xl transition-all duration-200"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
            )}
            <motion.img
              key={lightboxIndex}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              src={getValidImage(lightboxImages[lightboxIndex])}
              alt={product.name}
              className="max-w-[90vw] max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
              onError={() =>
                handleImageError(lightboxImages[lightboxIndex])
              }
            />
            {lightboxImages.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) =>
                    prev < lightboxImages.length - 1 ? prev + 1 : 0,
                  );
                }}
                className="absolute right-6 p-3 text-white hover:bg-white/20 rounded-xl transition-all duration-200"
                aria-label="Next image"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            )}
            {lightboxImages.length > 1 && (
              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2">
                {lightboxImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex(index);
                    }}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      lightboxIndex === index
                        ? 'bg-white w-8'
                        : 'bg-white/50 w-2 hover:bg-white/75'
                    }`}
                    aria-label={`Go to image ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================
          BARCODE DRAWER
          ============================================ */}
      <AnimatePresence>
        {showBarcodeModal && product && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
          >
            <div
              className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm"
              onClick={() => setShowBarcodeModal(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{
                type: 'spring',
                damping: 30,
                stiffness: 300,
              }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-lg shrink-0">
                    <Barcode className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      Product Barcode
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {product.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBarcodeModal(false)}
                  className="p-1.5 hover:bg-orange-50 dark:hover:bg-gray-800 rounded-lg transition-colors shrink-0"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {isLinkedToInventory && (
                  <span className="text-xs text-emerald-500 flex items-center gap-1 mb-4">
                    <Link2 className="w-3 h-3" /> Linked to Inventory
                  </span>
                )}

                {loadingBarcode ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                      Loading barcode...
                    </p>
                  </div>
                ) : barcodeInfo ? (
                  <div className="space-y-5">
                    <div className="flex flex-col items-center justify-center p-5 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-800 dark:to-gray-700 rounded-xl">
                      <div className="flex flex-wrap items-center justify-center gap-6">
                        <div className="text-center">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                            Barcode
                          </p>
                          {barcodeInfo.barcodeUrl ? (
                            <img
                              src={barcodeInfo.barcodeUrl}
                              alt="Barcode"
                              className="h-14 w-auto"
                              onError={(e) => {
                                (
                                  e.target as HTMLImageElement
                                ).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="h-14 flex items-center justify-center text-gray-400 text-xs">
                              No barcode
                            </div>
                          )}
                          <p className="text-xs font-mono text-gray-600 dark:text-gray-400 mt-2">
                            {barcodeInfo.barcode}
                          </p>
                        </div>
                        {barcodeInfo.qrCodeUrl && (
                          <div className="text-center">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                              QR Code
                            </p>
                            <img
                              src={barcodeInfo.qrCodeUrl}
                              alt="QR Code"
                              className="w-20 h-20 object-contain"
                              onError={(e) => {
                                (
                                  e.target as HTMLImageElement
                                ).style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleCopyBarcode}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-orange-50 dark:hover:bg-gray-800 transition-all duration-200 text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        onClick={handlePrintBarcode}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl transition-all duration-200 text-sm font-medium shadow-md"
                      >
                        <Printer className="w-4 h-4" />
                        Print
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Barcode className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                      No barcode available
                    </p>
                    <button
                      onClick={handleViewBarcode}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl transition-all duration-200 text-sm font-medium shadow-md"
                    >
                      <Barcode className="w-4 h-4" />
                      Generate Barcode
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #fbbf24;
          border-radius: 3px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #b45309;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #f59e0b;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d97706;
        }
      `}</style>
    </div>
  );
}
