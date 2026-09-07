'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Heart, ShoppingCart, Eye, Star, Share2,
  Truck, Shield, RotateCcw, CreditCard, Package,
  ChevronLeft, ChevronRight, ZoomIn, X, Minus, Plus,
  Loader2, Check, AlertCircle, Clock, TrendingUp,
  Tags, Hash, Info, Award, Gift, Sparkles, Zap,
  Barcode, QrCode, Scan, Printer, Download, Copy,
  ThumbsUp, MessageCircle, Users, Calendar,
  Link2, Database, Layers, GitBranch, Boxes,
  CheckCircle2, Circle, BadgeCheck, Truck as TruckIcon,
  Flame, Crown, Lock, Timer, ImageIcon, Wallet,
  Smartphone, Building, Landmark, DollarSign
} from 'lucide-react';
import PublicNavigation from '../../../components/PublicNavigation';
import { productService } from '../../../services/productService';
import { barcodeService } from '../../../services/barcodeService';
import { toast } from '../../../utils/toast-manager';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { WishlistButton } from '../../../components/products/WishlistButton';
import { RecentlyViewed } from '../../../components/products/RecentlyViewed';
import { ProductReviews } from '../../../components/products/ProductReviews';
import { useThemeStore } from '../../stores/themeStore';
import { useAuth } from '../../../hooks/useAuth';
import { ProductCard } from '../../../components/products/ProductCard';
import { cartService } from '../../../services/cartService';
import { paymentService } from '../../../services/paymentService';

// ============================================
// INTERFACES
// ============================================

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
  inventory?: { id: string; quantity: number; reserved: number; available?: number } | null;
  variants?: Array<{
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
  }> | null;
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

// ============================================
// CONSTANTS
// ============================================

const SIZES = {
  container: 'max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16',
  headerHeight: 'pt-24 md:pt-28 lg:pt-32',
  spacing: {
    section: 'py-8 md:py-12 lg:py-16',
    grid: 'gap-5 md:gap-6 lg:gap-8 xl:gap-10',
  },
  borderRadius: {
    card: 'rounded-2xl xl:rounded-3xl',
    button: 'rounded-xl xl:rounded-2xl',
    input: 'rounded-xl xl:rounded-2xl',
  },
  shadows: {
    card: 'shadow-sm hover:shadow-xl xl:hover:shadow-2xl',
    sticky: 'shadow-lg shadow-orange-100/50 dark:shadow-gray-900/50',
    modal: 'shadow-2xl xl:shadow-3xl',
  },
  transitions: {
    default: 'transition-all duration-300 ease-in-out',
    fast: 'transition-all duration-200 ease-in-out',
    slow: 'transition-all duration-500 ease-in-out',
  },
  typography: {
    hero: 'text-4xl md:text-5xl lg:text-6xl 2xl:text-7xl',
    title: 'text-2xl md:text-3xl lg:text-4xl 2xl:text-5xl',
    subtitle: 'text-lg md:text-xl lg:text-2xl',
    body: 'text-sm md:text-base lg:text-lg',
    small: 'text-xs md:text-sm',
  },
};

const COLORS = {
  gradient: {
    primary: 'from-orange-500 via-red-500 to-rose-500',
    primaryHover: 'hover:from-orange-600 hover:via-red-600 hover:to-rose-600',
    secondary: 'from-emerald-500 via-teal-500 to-green-500',
    secondaryHover: 'hover:from-emerald-600 hover:via-teal-600 hover:to-green-600',
    accent: 'from-amber-400 via-yellow-500 to-orange-400',
    trust: 'from-blue-500 via-sky-500 to-cyan-500',
    hero: 'from-orange-600 via-red-500 to-rose-600',
    dark: 'from-gray-900 via-gray-800 to-gray-900',
  },
  solid: {
    primary: 'bg-orange-500',
    primaryHover: 'hover:bg-orange-600',
    urgency: 'bg-red-500',
    urgencyHover: 'hover:bg-red-600',
    success: 'bg-emerald-500',
    successHover: 'hover:bg-emerald-600',
    premium: 'bg-amber-400',
    trust: 'bg-blue-500',
    trustHover: 'hover:bg-blue-600',
  },
  glass: {
    light: 'bg-white/20 backdrop-blur-md border border-white/30',
    warm: 'bg-orange-100/20 backdrop-blur-md border border-orange-200/30',
    dark: 'bg-black/20 backdrop-blur-md border border-white/10',
  },
};

const PLACEHOLDER_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

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
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [activeTab, setActiveTab] = useState('description');
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeInfo, setBarcodeInfo] = useState<BarcodeInfo | null>(null);
  const [loadingBarcode, setLoadingBarcode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedAttributes, setExpandedAttributes] = useState<Set<string>>(new Set());
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);

  // Image error states
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [variantImageErrors, setVariantImageErrors] = useState<Record<string, boolean>>({});

  // ✅ FIXED: Use refs to prevent duplicate requests
  const productLoadedRef = useRef(false);
  const relatedLoadedRef = useRef(false);

  // ============================================
  // ✅ FIXED: Image error handlers
  // ============================================

  const handleImageError = useCallback((imageUrl: string) => {
    setImageErrors(prev => ({ ...prev, [imageUrl]: true }));
  }, []);

  const handleVariantImageError = useCallback((imageUrl: string) => {
    setVariantImageErrors(prev => ({ ...prev, [imageUrl]: true }));
  }, []);

  const getValidImage = useCallback((imageUrl: string | undefined): string => {
    if (!imageUrl) return PLACEHOLDER_IMAGE;
    if (imageErrors[imageUrl]) return PLACEHOLDER_IMAGE;
    return imageUrl;
  }, [imageErrors]);

  const getValidVariantImage = useCallback((imageUrl: string | undefined): string => {
    if (!imageUrl) return PLACEHOLDER_IMAGE;
    if (variantImageErrors[imageUrl]) return PLACEHOLDER_IMAGE;
    return imageUrl;
  }, [variantImageErrors]);

  // ============================================
  // ✅ FIXED: CART & PAYMENT HANDLERS with useCallback
  // ============================================

  const fetchCartData = useCallback(async () => {
    try {
      const response = await cartService.getCart();
      if (response) {
        setCartCount(response.items?.length || 0);
        setCartTotal(response.total || 0);
      }
    } catch (error) {
      // Silently fail - cart data is not critical
    }
  }, []);

  const handleAddToCart = useCallback(async () => {
    if (!product) return;
    setAddingToCart(true);
    try {
      await cartService.addItem({
        productId: product.id,
        variantId: selectedVariant || undefined,
        quantity: quantity,
      });
      toast.success(`${product.name} added to cart`);
      await fetchCartData();
      window.dispatchEvent(new CustomEvent('cart:updated'));
    } catch (error: any) {
      console.error('Failed to add to cart:', error);
      toast.error(error?.response?.data?.message || 'Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  }, [product, selectedVariant, quantity, fetchCartData]);

  const handleBuyNow = useCallback(() => {
    if (!product) return;
    handleAddToCart();
    setTimeout(() => {
      router.push('/checkout');
    }, 500);
  }, [product, handleAddToCart, router]);

  const handleQuickCheckout = useCallback(() => {
    if (!product) return;
    router.push('/checkout');
  }, [product, router]);

  // ============================================
  // ✅ FIXED: DATA FETCHING with useCallback and refs
  // ============================================

  const loadRelatedProducts = useCallback(async (productId: string) => {
    if (relatedLoadedRef.current) return;
    
    try {
      setLoadingRelated(true);
      const data = await productService.getRelatedProducts(productId, 4);
      
      const transformedRelated = (data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        description: item.description,
        unitPrice: item.unitPrice,
        costPrice: item.costPrice,
        barcode: item.barcode,
        images: item.images || [],
        category: item.category,
        categoryId: item.categoryId,
        supplier: item.supplier,
        inventory: item.inventory ? {
          id: item.inventory.id,
          quantity: item.inventory.quantity || 0,
          reserved: item.inventory.reserved || 0,
          available: (item.inventory.quantity || 0) - (item.inventory.reserved || 0),
        } : null,
        variants: item.variants?.map((v: any) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          price: v.price || 0,
          stock: v.stock || 0,
          isActive: v.isActive !== undefined ? v.isActive : true,
          images: v.images || [],
          attributes: v.attributes || {},
          barcode: v.barcode || null,
          inventoryId: v.inventoryId || null,
        })) || null,
        isActive: item.isActive,
        isDigital: item.isDigital || false,
        weight: item.weight,
        taxRate: item.taxRate || 0,
        minStock: item.minStock ?? undefined,
        attributes: item.attributes || null,
        rating: item.rating,
        reviewCount: item.reviewCount,
        tags: item.tags || [],
        featured: item.featured || false,
        inventoryId: item.inventoryId || null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));
      
      setRelatedProducts(transformedRelated);
      relatedLoadedRef.current = true;
    } catch (error) {
      console.error('Failed to load related products:', error);
    } finally {
      setLoadingRelated(false);
    }
  }, []);

  const fetchProduct = useCallback(async () => {
    if (productLoadedRef.current) return;
    
    try {
      setLoading(true);
      setError(null);
      setImageErrors({});
      setVariantImageErrors({});
      
      const data = await productService.getProductById(id);
      
      const transformedProduct: Product = {
        id: data.id,
        name: data.name,
        sku: data.sku,
        description: data.description,
        unitPrice: data.unitPrice,
        costPrice: data.costPrice,
        barcode: data.barcode,
        images: data.images || [],
        category: data.category,
        categoryId: data.categoryId,
        supplier: data.supplier,
        inventory: data.inventory ? {
          id: data.inventory.id,
          quantity: data.inventory.quantity || 0,
          reserved: data.inventory.reserved || 0,
          available: (data.inventory.quantity || 0) - (data.inventory.reserved || 0),
        } : null,
        variants: data.variants?.map((v: any) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          price: v.price || 0,
          stock: v.stock || 0,
          isActive: v.isActive !== undefined ? v.isActive : true,
          images: v.images || [],
          attributes: v.attributes || {},
          barcode: v.barcode || null,
          inventoryId: v.inventoryId || null,
        })) || null,
        isActive: data.isActive,
        isDigital: data.isDigital || false,
        weight: data.weight,
        taxRate: data.taxRate || 0,
        minStock: data.minStock || 5,
        attributes: data.attributes || null,
        rating: data.rating,
        reviewCount: data.reviewCount,
        tags: data.tags || [],
        featured: data.featured || false,
        inventoryId: data.inventoryId || null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
      
      setProduct(transformedProduct);
      setLightboxImages(transformedProduct.images || []);
      productLoadedRef.current = true;
      
      if (isAuthenticated) {
        try {
          await productService.addRecentlyViewed(id);
        } catch (error) {
          console.error('Failed to add to recently viewed:', error);
        }
      }
      
      await loadRelatedProducts(id);
      await fetchCartData();
    } catch (error: any) {
      console.error('Error fetching product:', error);
      setProduct(null);
      setError(error?.response?.status === 404 ? 'Product not found' : 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [id, isAuthenticated, fetchCartData, loadRelatedProducts]);

  // ============================================
  // ✅ FIXED: useEffect with proper dependencies
  // ============================================

  useEffect(() => {
    if (id) {
      // Reset refs when product ID changes
      productLoadedRef.current = false;
      relatedLoadedRef.current = false;
      fetchProduct();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ============================================
  // ✅ FIXED: HANDLERS
  // ============================================

  const handleQuantityChange = useCallback((delta: number) => {
    setQuantity(prev => Math.max(1, Math.min(prev + delta, 99)));
  }, []);

  const handleViewBarcode = useCallback(async () => {
    if (!product) return;
    setLoadingBarcode(true);
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
      console.error('Failed to get barcode:', error);
      toast.error(error?.message || 'Failed to load barcode');
      setShowBarcodeModal(false);
    } finally {
      setLoadingBarcode(false);
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
            .price { font-size: 20px; font-weight: bold; color: #f97316; margin: 5px 0; }
            .info { margin-top: 10px; font-size: 12px; color: #666; }
            .info span { margin: 0 8px; }
            .linked-badge { display: inline-block; background: #fff7ed; color: #ea580c; padding: 2px 8px; border-radius: 12px; font-size: 10px; margin-top: 5px; }
            @media print {
              .container { border: none; padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="product-name">${product.name || 'Product'}</div>
            <div class="sku">SKU: ${product.sku || 'N/A'}</div>
            ${product.inventoryId ? `<div class="linked-badge">🔗 Linked to Inventory</div>` : ''}
            ${barcodeInfo.barcodeUrl ? `<img src="${barcodeInfo.barcodeUrl}" alt="Barcode" class="barcode-img" onerror="this.style.display='none'" />` : ''}
            ${barcodeInfo.qrCodeUrl ? `<img src="${barcodeInfo.qrCodeUrl}" alt="QR Code" class="qr-img" onerror="this.style.display='none'" />` : ''}
            <div class="price">${formatCurrency(product.unitPrice || 0)}</div>
            <div class="info">
              <span>${barcodeInfo.barcode}</span>
              ${product.category?.name ? `<span>| ${product.category.name}</span>` : ''}
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

  const toggleAttribute = useCallback((key: string) => {
    setExpandedAttributes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }, []);

  const handleOpenVariantLightbox = useCallback((variant: any) => {
    if (variant?.images && variant.images.length > 0) {
      setLightboxImages(variant.images);
      setLightboxIndex(0);
      setShowLightbox(true);
    }
  }, []);

  // ============================================
  // HELPERS
  // ============================================

  const getStockStatus = useCallback(() => {
    if (!product) return { status: 'No Stock', color: 'bg-gray-100 text-gray-600', icon: '📦' };
    
    const inventory = product.inventory;
    let available = 0;
    
    if (inventory) {
      available = inventory.quantity - (inventory.reserved || 0);
    }
    
    if (available === 0 && product.variants && product.variants.length > 0) {
      available = product.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    }
    
    if (available <= 0) return { status: 'Out of Stock', color: 'bg-gradient-to-r from-red-600 to-rose-600 text-white', icon: '❌' };
    if (available <= (product.minStock || 5)) return { status: `Only ${available} Left!`, color: 'bg-gradient-to-r from-red-500 to-orange-500 text-white', icon: '🔥' };
    return { status: 'In Stock', color: 'bg-gradient-to-r from-emerald-500 to-green-600 text-white', icon: '✅' };
  }, [product]);

  const renderStars = useCallback((rating: number = 0) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 xl:w-5 xl:h-5 ${star <= Math.round(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'}`}
          />
        ))}
        {rating > 0 && (
          <span className="text-sm xl:text-base text-gray-500 dark:text-gray-400 ml-1">({rating.toFixed(1)})</span>
        )}
      </div>
    );
  }, []);

  const renderStarsLarge = useCallback((rating: number = 0) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-6 h-6 xl:w-8 xl:h-8 ${star <= Math.round(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'}`}
          />
        ))}
        {rating > 0 && (
          <span className="text-sm xl:text-base text-gray-500 dark:text-gray-400 ml-2">
            {rating.toFixed(1)} ({product?.reviewCount || 0} reviews)
          </span>
        )}
      </div>
    );
  }, [product?.reviewCount]);

  // Memoized values
  const stock = useMemo(() => getStockStatus(), [getStockStatus]);
  const inventory = product?.inventory;
  const available = useMemo(() => {
    return inventory ? inventory.quantity - (inventory.reserved || 0) : 0;
  }, [inventory]);
  const images = product?.images || [];
  const hasImages = images.length > 0;
  const selectedVariantData = useMemo(() => {
    return selectedVariant 
      ? product?.variants?.find(v => v.id === selectedVariant) 
      : null;
  }, [selectedVariant, product?.variants]);

  const displayPrice = useMemo(() => {
    if (selectedVariantData) {
      return selectedVariantData.price;
    }
    return product?.unitPrice || 0;
  }, [selectedVariantData, product?.unitPrice]);

  const isLinkedToInventory = !!product?.inventoryId;

  // ✅ FIXED: Memoize related product cards
  const relatedProductCards = useMemo(() => {
    if (relatedProducts.length === 0) return null;
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-16"
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-orange-500" />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {relatedProducts.map((relatedProduct, index) => {
            const cardProduct = {
              ...relatedProduct,
              costPrice: relatedProduct.costPrice ?? undefined,
              images: relatedProduct.images || [],
              description: relatedProduct.description || undefined,
              category: relatedProduct.category || undefined,
              inventory: relatedProduct.inventory ? [{
                quantity: relatedProduct.inventory.quantity,
                reserved: relatedProduct.inventory.reserved,
              }] : undefined,
              minStock: relatedProduct.minStock ?? undefined,
            };
            return (
              <motion.div
                key={relatedProduct.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <ProductCard
                  product={cardProduct}
                  index={index}
                  variant="default"
                  showWishlist={true}
                  showAddToCart={true}
                />
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    );
  }, [relatedProducts]);

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'dark bg-gray-950' : 'bg-orange-50'} transition-colors duration-300`}>
        <PublicNavigation />
        <div className={`${SIZES.container} ${SIZES.headerHeight} pb-16`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 xl:gap-12">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm aspect-square animate-pulse"></div>
            <div className="space-y-6">
              <div className="h-8 xl:h-10 bg-orange-100 dark:bg-gray-800 rounded-lg w-3/4 animate-pulse"></div>
              <div className="h-6 bg-orange-100 dark:bg-gray-800 rounded-lg w-1/2 animate-pulse"></div>
              <div className="h-12 xl:h-14 bg-orange-100 dark:bg-gray-800 rounded-lg w-1/3 animate-pulse"></div>
              <div className="h-32 bg-orange-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
              <div className="h-12 bg-orange-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className={`min-h-screen ${isDark ? 'dark bg-gray-950' : 'bg-orange-50'} transition-colors duration-300`}>
        <PublicNavigation />
        <div className={`${SIZES.container} ${SIZES.headerHeight} pb-16`}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-white dark:bg-gray-900 ${SIZES.borderRadius.card} shadow-sm p-16 xl:p-20 text-center`}
          >
            <div className="inline-flex items-center justify-center w-24 h-24 xl:w-32 xl:h-32 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/20 dark:to-amber-900/20 rounded-full mb-6">
              <Package className="w-12 h-12 xl:w-16 xl:h-16 text-orange-500" />
            </div>
            <h1 className="text-3xl xl:text-4xl font-bold text-gray-900 dark:text-white mb-3">
              {error === 'Product not found' ? 'Product Not Found' : 'Something Went Wrong'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8 text-base xl:text-lg">
              {error === 'Product not found'
                ? "The product you're looking for doesn't exist or has been removed."
                : "We couldn't load this product. Please try again later."}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/shop" 
                className="inline-flex items-center gap-2 px-8 py-3 xl:px-10 xl:py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-medium transition-all duration-200 shadow-lg"
              >
                <ShoppingCart className="w-5 h-5" />
                Browse All Products
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-8 py-3 xl:px-10 xl:py-4 border border-gray-200 dark:border-gray-700 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 text-gray-700 dark:text-gray-300"
              >
                <RotateCcw className="w-5 h-5" />
                Retry
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-gray-950' : 'bg-gradient-to-b from-orange-50 via-white to-amber-50'} transition-colors duration-300`}>
      <PublicNavigation />
      
      <div className={`${SIZES.container} ${SIZES.headerHeight} pb-16`}>
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm xl:text-base text-gray-500 dark:text-gray-400 mb-8 overflow-x-auto">
          <Link href="/" className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors whitespace-nowrap flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            Home
          </Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/shop" className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors whitespace-nowrap">
            Shop
          </Link>
          <ChevronRight className="w-4 h-4" />
          {product.category && (
            <>
              <Link href={`/shop?category=${product.category.id}`} className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors whitespace-nowrap">
                {product.category.name}
              </Link>
              <ChevronRight className="w-4 h-4" />
            </>
          )}
          <span className="text-gray-700 dark:text-gray-300 font-medium truncate">{product.name}</span>
        </nav>

        {/* ✅ Cart Status Bar */}
        {cartCount > 0 && (
          <div className="mb-6 p-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {cartCount} item{cartCount > 1 ? 's' : ''} in cart
              </span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {formatCurrency(cartTotal)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/cart')}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                View Cart
              </button>
              <button
                onClick={handleQuickCheckout}
                className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-lg font-medium transition-all duration-200 shadow-md flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Checkout Now
              </button>
            </div>
          </div>
        )}

        {/* Product Main Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 xl:gap-16"
        >
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className={`relative bg-white dark:bg-gray-900 ${SIZES.borderRadius.card} shadow-sm border border-orange-100 dark:border-gray-700 overflow-hidden aspect-square group`}>
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
                  <Package className="w-32 h-32 xl:w-40 xl:h-40 text-gray-300 dark:text-gray-600" />
                </div>
              )}
              
              {/* Top Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {product.featured && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 xl:px-4 xl:py-2 bg-gradient-to-r from-amber-400 to-yellow-500 text-white text-xs xl:text-sm font-medium rounded-full shadow-lg">
                    <Crown className="w-3.5 h-3.5 xl:w-4 xl:h-4" />
                    Featured
                  </span>
                )}
                {isLinkedToInventory && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 xl:px-4 xl:py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs xl:text-sm font-medium rounded-full shadow-lg">
                    <Link2 className="w-3.5 h-3.5 xl:w-4 xl:h-4" />
                    Inventory Linked
                  </span>
                )}
                {!product.isActive && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 xl:px-4 xl:py-2 bg-gradient-to-r from-red-600 to-rose-600 text-white text-xs xl:text-sm font-medium rounded-full shadow-lg">
                    <AlertCircle className="w-3.5 h-3.5 xl:w-4 xl:h-4" />
                    Inactive
                  </span>
                )}
              </div>

              {/* Zoom Button */}
              <button
                onClick={() => {
                  setLightboxImages(images);
                  setLightboxIndex(selectedImage);
                  setShowLightbox(true);
                }}
                className="absolute bottom-4 right-4 p-3 xl:p-4 bg-black/50 hover:bg-black/70 text-white rounded-xl backdrop-blur-sm transition-all duration-200 opacity-0 group-hover:opacity-100"
                aria-label="Zoom image"
              >
                <ZoomIn className="w-5 h-5 xl:w-6 xl:h-6" />
              </button>
            </div>

            {/* Thumbnails */}
            {hasImages && images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                {images.map((image: string, index: number) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`w-24 h-24 xl:w-28 xl:h-28 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all duration-200 ${
                      selectedImage === index
                        ? 'border-orange-500 ring-2 ring-orange-500 ring-opacity-50 shadow-lg'
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

          {/* Product Info */}
          <div className="space-y-6">
            {/* Title & Rating */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <h1 className={`${SIZES.typography.title} font-bold text-gray-900 dark:text-white`}>
                  {product.name}
                </h1>
                <WishlistButton productId={product.id} variant="icon" size="lg" />
              </div>
              {product.rating && product.rating > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  {renderStarsLarge(product.rating)}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-3 text-sm xl:text-base text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5">
                  <Hash className="w-4 h-4" />
                  SKU: {product.sku}
                </span>
                {product.barcode && (
                  <button
                    onClick={handleViewBarcode}
                    className="inline-flex items-center gap-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 transition-colors font-medium"
                  >
                    <Barcode className="w-4 h-4" />
                    View Barcode
                  </button>
                )}
                {product.tags && product.tags.length > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Tags className="w-4 h-4" />
                    {product.tags.slice(0, 3).join(', ')}
                    {product.tags.length > 3 && ` +${product.tags.length - 3}`}
                  </span>
                )}
              </div>
            </div>

            {/* Price Card */}
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-2xl xl:rounded-3xl p-6 xl:p-8 border border-orange-100 dark:border-orange-900/30">
              <div className="flex flex-wrap items-end gap-3">
                <span className="text-4xl md:text-5xl xl:text-6xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                  {formatCurrency(displayPrice)}
                </span>
                {selectedVariantData && selectedVariantData.price !== product.unitPrice && (
                  <span className="text-lg xl:text-xl text-gray-400 line-through">
                    {formatCurrency(product.unitPrice)}
                  </span>
                )}
                {product.costPrice && product.costPrice > displayPrice && (
                  <>
                    <span className="text-lg xl:text-xl text-gray-400 line-through">
                      {formatCurrency(product.costPrice)}
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 xl:px-4 xl:py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm xl:text-base font-medium">
                      <TrendingUp className="w-4 h-4" />
                      Save {formatCurrency(product.costPrice - displayPrice)}
                    </span>
                  </>
                )}
              </div>
              {product.taxRate !== undefined && product.taxRate !== null && product.taxRate > 0 && (
                <p className="text-sm xl:text-base text-gray-500 dark:text-gray-400 mt-2">
                  Tax included ({product.taxRate}%)
                </p>
              )}
            </div>

            {/* Stock Status */}
            <div className="flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center gap-2 px-4 py-2 xl:px-5 xl:py-2.5 rounded-full text-sm xl:text-base font-medium ${stock.color} shadow-sm`}>
                {stock.icon} {stock.status}
              </span>
              {available > 0 && available <= 10 && (
                <span className="inline-flex items-center gap-1.5 text-sm xl:text-base text-red-600 dark:text-red-400 font-semibold animate-pulse">
                  <Flame className="w-4 h-4 xl:w-5 xl:h-5" />
                  Selling Fast! Only {available} left!
                </span>
              )}
              {isLinkedToInventory && (
                <span className="inline-flex items-center gap-1.5 text-sm xl:text-base text-emerald-600 dark:text-emerald-400 font-medium">
                  <Shield className="w-4 h-4 xl:w-5 xl:h-5" />
                  Inventory Managed
                </span>
              )}
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center gap-2 text-xs xl:text-sm text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-emerald-500" />
                Secure Checkout
              </span>
              <span className="text-gray-300">|</span>
              <span className="inline-flex items-center gap-1.5">
                <TruckIcon className="w-4 h-4 text-blue-500" />
                Free Shipping
              </span>
              <span className="text-gray-300">|</span>
              <span className="inline-flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-orange-500" />
                30-Day Returns
              </span>
            </div>

            {/* Description */}
            {product.description && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm xl:text-base">
                  {product.description.length > 300 
                    ? `${product.description.slice(0, 300)}...` 
                    : product.description}
                </p>
                {product.description.length > 300 && (
                  <button
                    onClick={() => setActiveTab('description')}
                    className="text-orange-600 dark:text-orange-400 text-sm font-medium hover:underline"
                  >
                    Read more
                  </button>
                )}
              </div>
            )}

            {/* Key Features Grid */}
            <div className="grid grid-cols-2 gap-3 xl:gap-4">
              {[
                { icon: <CreditCard className="w-5 h-5 xl:w-6 xl:h-6 text-orange-500" />, label: product.isDigital ? 'Digital Product' : 'Physical Product' },
                { icon: <Package className="w-5 h-5 xl:w-6 xl:h-6 text-amber-500" />, label: product.weight ? `${product.weight} kg` : 'Standard Weight' },
                { icon: <TruckIcon className="w-5 h-5 xl:w-6 xl:h-6 text-emerald-500" />, label: 'Free Shipping' },
                { icon: <RotateCcw className="w-5 h-5 xl:w-6 xl:h-6 text-blue-500" />, label: '30 Day Returns' },
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-3 p-4 xl:p-5 bg-white dark:bg-gray-900 rounded-xl xl:rounded-2xl shadow-sm border border-orange-50 dark:border-gray-700">
                  {feature.icon}
                  <span className="text-sm xl:text-base font-medium text-gray-700 dark:text-gray-300">{feature.label}</span>
                </div>
              ))}
            </div>

            {/* Variants */}
            {product.variants && product.variants.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl xl:rounded-3xl p-6 shadow-sm border border-orange-50 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm xl:text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-orange-500" />
                    Available Variants
                  </p>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {product.variants.filter(v => v.isActive).length} active
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {product.variants.filter(v => v.isActive).map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedVariant(selectedVariant === variant.id ? null : variant.id)}
                      className={`px-4 py-2.5 xl:px-5 xl:py-3 rounded-xl border-2 text-sm xl:text-base font-medium transition-all duration-200 flex items-center gap-2 ${
                        selectedVariant === variant.id
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 shadow-md'
                          : 'border-gray-200 dark:border-gray-700 hover:border-orange-400 dark:hover:border-orange-400 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {variant.images && variant.images.length > 0 && (
                        <div 
                          className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenVariantLightbox(variant);
                          }}
                        >
                          <img 
                            src={getValidVariantImage(variant.images?.[0])} 
                            alt={variant.name} 
                            className="w-full h-full object-cover"
                            onError={() => handleVariantImageError(variant.images?.[0] || '')}
                          />
                        </div>
                      )}
                      <span>{variant.name}</span>
                      {variant.price !== product.unitPrice && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({formatCurrency(variant.price)})
                        </span>
                      )}
                      {variant.stock <= 0 && (
                        <span className="text-xs text-red-600">Out</span>
                      )}
                      {variant.inventoryId && (
                        <Link2 className="w-3 h-3 text-emerald-500" />
                      )}
                    </button>
                  ))}
                </div>
                {selectedVariantData && selectedVariantData.attributes && 
                  Object.keys(selectedVariantData.attributes).length > 0 && (
                  <div className="mt-4 p-4 bg-orange-50 dark:bg-gray-800 rounded-xl">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Variant Attributes</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedVariantData.attributes).map(([key, value]) => (
                        <span key={key} className="text-xs bg-white dark:bg-gray-700 px-3 py-1 rounded-full text-gray-700 dark:text-gray-300 shadow-sm">
                          {key}: {String(value)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {product.tags.map((tag: string) => (
                    <Link
                      key={tag}
                      href={`/shop?search=${tag}`}
                      className="px-3 py-1.5 xl:px-4 xl:py-2 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-gray-800 dark:to-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs xl:text-sm font-medium hover:from-orange-100 hover:to-amber-100 dark:hover:from-orange-900/20 dark:hover:to-amber-900/20 transition-all duration-200"
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity & Actions */}
            <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center bg-white dark:bg-gray-900 border-2 border-orange-200 dark:border-gray-700 rounded-xl overflow-hidden">
                  <button
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                    className="px-4 py-3 hover:bg-orange-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <span className="w-16 text-center text-lg xl:text-xl font-semibold text-gray-900 dark:text-white">{quantity}</span>
                  <button
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= 99}
                    className="px-4 py-3 hover:bg-orange-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={handleAddToCart}
                  disabled={available <= 0 || addingToCart}
                  className="flex-1 min-w-[200px] px-6 py-3.5 xl:px-8 xl:py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {addingToCart ? (
                    <Loader2 className="w-5 h-5 xl:w-6 xl:h-6 animate-spin" />
                  ) : (
                    <ShoppingCart className="w-5 h-5 xl:w-6 xl:h-6" />
                  )}
                  {addingToCart ? 'Adding...' : 'Add to Cart'}
                </button>
              </div>
              
              {/* Buy Now & Quick Checkout */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleBuyNow}
                  disabled={available <= 0}
                  className="flex-1 px-6 py-3.5 xl:px-8 xl:py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  <Zap className="w-5 h-5 xl:w-6 xl:h-6" />
                  Buy Now
                </button>
                <button
                  onClick={handleQuickCheckout}
                  className="flex-1 px-6 py-3.5 xl:px-8 xl:py-4 bg-gradient-to-r from-blue-500 to-sky-600 hover:from-blue-600 hover:to-sky-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
                >
                  <CreditCard className="w-5 h-5 xl:w-6 xl:h-6" />
                  Quick Checkout
                </button>
              </div>
            </div>

            {/* Share & Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-4">
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-500 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-800 rounded-xl transition-all duration-200 font-medium text-sm xl:text-base"
              >
                <Share2 className="w-4 h-4 xl:w-5 xl:h-5" />
                Share
              </button>
              {product.barcode && (
                <button
                  onClick={handleViewBarcode}
                  className="inline-flex items-center gap-2 px-4 py-2 text-gray-500 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-800 rounded-xl transition-all duration-200 font-medium text-sm xl:text-base"
                >
                  <QrCode className="w-4 h-4 xl:w-5 xl:h-5" />
                  QR Code
                </button>
              )}
              {isLinkedToInventory && (
                <span className="inline-flex items-center gap-2 px-4 py-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl font-medium text-sm xl:text-base">
                  <Database className="w-4 h-4 xl:w-5 xl:h-5" />
                  Inventory Managed
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className={`mt-16 bg-white dark:bg-gray-900 ${SIZES.borderRadius.card} shadow-sm border border-orange-50 dark:border-gray-700 overflow-hidden`}
        >
          <div className="border-b border-gray-200 dark:border-gray-700 px-6 overflow-x-auto">
            <nav className="flex gap-8">
              {[
                { id: 'description', label: 'Description', icon: Info },
                { id: 'specifications', label: 'Specifications', icon: Hash },
                { id: 'reviews', label: 'Reviews', icon: Star },
                { id: 'attributes', label: 'Attributes', icon: Tags },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-2 px-2 py-5 border-b-2 font-medium text-sm xl:text-base transition-all duration-200 whitespace-nowrap ${
                    activeTab === id
                      ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                  {id === 'reviews' && product.reviewCount && product.reviewCount > 0 && (
                    <span className="ml-1 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full">
                      {product.reviewCount}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6 md:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'description' && (
                  <div className="space-y-6">
                    <div className="prose prose-sm sm:prose dark:prose-invert max-w-none">
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed text-sm xl:text-base">
                        {product.description || 'No description provided'}
                      </p>
                    </div>
                    {product.variants && product.variants.length > 0 && (
                      <div className="mt-8">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2 text-sm xl:text-base">
                          <Layers className="w-5 h-5 text-orange-500" />
                          Available Variants
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {product.variants.filter(v => v.isActive).map((variant) => (
                            <div key={variant.id} className="flex justify-between items-center py-3 px-4 bg-orange-50 dark:bg-gray-800 rounded-xl">
                              <div className="flex items-center gap-2">
                                {variant.images && variant.images.length > 0 && (
                                  <div 
                                    className="w-8 h-8 rounded-full overflow-hidden cursor-pointer"
                                    onClick={() => handleOpenVariantLightbox(variant)}
                                  >
                                    <img 
                                      src={getValidVariantImage(variant.images?.[0])} 
                                      alt={variant.name} 
                                      className="w-full h-full object-cover"
                                      onError={() => handleVariantImageError(variant.images?.[0] || '')}
                                    />
                                  </div>
                                )}
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{variant.name}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {formatCurrency(variant.price)}
                                </span>
                                <span className={`inline-flex items-center gap-1 text-xs font-medium ${variant.stock > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {variant.stock > 0 ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3" />
                                      {variant.stock} in stock
                                    </>
                                  ) : (
                                    <>
                                      <AlertCircle className="w-3 h-3" />
                                      Out of stock
                                    </>
                                  )}
                                </span>
                                {variant.inventoryId && (
                                  <Link2 className="w-4 h-4 text-emerald-500" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'specifications' && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2 text-sm xl:text-base">
                      <Database className="w-5 h-5 text-orange-500" />
                      Product Specifications
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[
                        { label: 'SKU', value: product.sku, mono: true },
                        { label: 'Barcode', value: product.barcode || 'N/A', mono: true },
                        { label: 'Category', value: product.category?.name || 'N/A' },
                        { label: 'Supplier', value: product.supplier?.name || 'N/A' },
                        { label: 'Weight', value: product.weight ? `${product.weight} kg` : 'N/A' },
                        { label: 'Type', value: product.isDigital ? 'Digital' : 'Physical' },
                        { label: 'Added', value: formatDate(product.createdAt) },
                        { label: 'Inventory', value: isLinkedToInventory ? 'Linked' : 'Not Linked' },
                        { label: 'Rating', value: product.rating ? `${product.rating.toFixed(1)} (${product.reviewCount || 0})` : 'No rating' },
                        { label: 'Variants', value: `${product.variants?.filter(v => v.isActive).length || 0} active` },
                      ].map((spec, index) => (
                        <div key={index} className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-4">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                            {spec.label}
                          </p>
                          <p className={`text-sm font-semibold text-gray-900 dark:text-white ${spec.mono ? 'font-mono' : ''}`}>
                            {spec.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'reviews' && (
                  <ProductReviews productId={product.id} canManage={false} />
                )}

                {activeTab === 'attributes' && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2 text-sm xl:text-base">
                      <Tags className="w-5 h-5 text-orange-500" />
                      Product Attributes
                    </h4>
                    {product.attributes && Object.keys(product.attributes).length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {Object.entries(product.attributes).map(([key, value]) => (
                          <div key={key} className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-5">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400 capitalize">{key}</span>
                              <button
                                onClick={() => toggleAttribute(key)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                              >
                                <ChevronRight className={`w-5 h-5 transition-transform ${expandedAttributes.has(key) ? 'rotate-90' : ''}`} />
                              </button>
                            </div>
                            <div className={`mt-2 overflow-hidden transition-all ${expandedAttributes.has(key) ? 'max-h-40' : 'max-h-6'}`}>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white break-all">
                                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-center py-12">
                        No attributes available for this product
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Related Products - ✅ FIXED: Using memoized version */}
        {relatedProductCards}

        {/* Recently Viewed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-16"
        >
          <RecentlyViewed limit={6} />
        </motion.div>

        {/* Lightbox */}
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(prev => (prev > 0 ? prev - 1 : lightboxImages.length - 1));
                }}
                className="absolute left-6 p-3 text-white hover:bg-white/20 rounded-xl transition-all duration-200"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <motion.img
                key={lightboxIndex}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                src={getValidImage(lightboxImages[lightboxIndex])}
                alt={product.name}
                className="max-w-[90vw] max-h-[90vh] object-contain"
                onClick={(e) => e.stopPropagation()}
                onError={() => handleImageError(lightboxImages[lightboxIndex])}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(prev => (prev < lightboxImages.length - 1 ? prev + 1 : 0));
                }}
                className="absolute right-6 p-3 text-white hover:bg-white/20 rounded-xl transition-all duration-200"
                aria-label="Next image"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2">
                {lightboxImages.map((_: any, index: number) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex(index);
                    }}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      lightboxIndex === index ? 'bg-white w-8' : 'bg-white/50 w-2 hover:bg-white/75'
                    }`}
                    aria-label={`Go to image ${index + 1}`}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Barcode Modal */}
        <AnimatePresence>
          {showBarcodeModal && product && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setShowBarcodeModal(false)} />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className={`relative bg-white dark:bg-gray-900 ${SIZES.borderRadius.card} shadow-2xl max-w-md w-full p-8 max-h-[90vh] overflow-y-auto`}
              >
                <button
                  onClick={() => setShowBarcodeModal(false)}
                  className="absolute top-4 right-4 p-2 hover:bg-orange-50 dark:hover:bg-gray-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
                
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-xl">
                    <Barcode className="w-8 h-8 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Product Barcode</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{product.name}</p>
                    {isLinkedToInventory && (
                      <span className="text-xs text-emerald-500 flex items-center gap-1 mt-1">
                        <Link2 className="w-3 h-3" /> Linked to Inventory
                      </span>
                    )}
                  </div>
                </div>

                {loadingBarcode ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-10 h-10 animate-spin text-orange-600" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Loading barcode...</p>
                  </div>
                ) : barcodeInfo ? (
                  <div className="space-y-6">
                    <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-800 dark:to-gray-700 rounded-xl">
                      <div className="flex flex-wrap items-center justify-center gap-8">
                        <div className="text-center">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Barcode</p>
                          {barcodeInfo.barcodeUrl ? (
                            <img 
                              src={barcodeInfo.barcodeUrl} 
                              alt="Barcode" 
                              className="h-16 w-auto"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="h-16 flex items-center justify-center text-gray-400">No barcode</div>
                          )}
                          <p className="text-xs font-mono text-gray-600 dark:text-gray-400 mt-2">
                            {barcodeInfo.barcode}
                          </p>
                        </div>
                        {barcodeInfo.qrCodeUrl && (
                          <div className="text-center">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">QR Code</p>
                            <img 
                              src={barcodeInfo.qrCodeUrl} 
                              alt="QR Code" 
                              className="w-24 h-24 object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-3">
                      <button
                        onClick={handleCopyBarcode}
                        className="inline-flex items-center gap-2 px-6 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:bg-orange-50 dark:hover:bg-gray-800 transition-all duration-200 font-medium text-gray-700 dark:text-gray-300"
                      >
                        {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                      <button
                        onClick={handlePrintBarcode}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl transition-all duration-200 font-medium shadow-lg"
                      >
                        <Printer className="w-5 h-5" />
                        Print
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Barcode className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 mb-6">No barcode available</p>
                    <button
                      onClick={handleViewBarcode}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl transition-all duration-200 font-medium shadow-lg"
                    >
                      <Barcode className="w-5 h-5" />
                      Generate Barcode
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Custom Scrollbar Styles */}
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
