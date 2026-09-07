'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Edit, Trash2, Package, DollarSign, Barcode,
  Tag, Layers, Star, ShoppingBag, TrendingUp, Calendar,
  Loader2, Copy, Check, Eye, Users, Clock, Lock,
  AlertTriangle, X, Heart, Share2, Truck, Shield,
  RotateCcw, CreditCard, ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, Minus, Plus, ShoppingCart,
  QrCode, Scan, Download, Printer, RefreshCw,
  FileText, Box, Weight, Ruler, Building2, User,
  CalendarDays, Hash, Link2, AlertCircle, Info,
  CheckCircle, XCircle, HelpCircle, Sparkles,
  Zap, Award, Gift, ThumbsUp, MessageCircle,
  TrendingDown, BarChart3, PieChart, Clock as ClockIcon,
  ImageIcon
} from 'lucide-react';
import { productService } from '../../services/productService';
import { barcodeService } from '../../services/barcodeService';
import { inventoryService } from '../../services/inventoryService';
import { toast } from '../../utils/toast-manager';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';
import { usePermission } from '../../hooks/usePermission';
import { PermissionResource } from '../../types/enums';
import { BarcodeDisplay } from '../barcode/BarcodeDisplay';
import { WishlistButton } from './WishlistButton';
import { RecentlyViewed } from './RecentlyViewed';
import { ProductReviews } from './ProductReviews';
import { useThemeStore } from '../../app/stores/themeStore';
import { ProductCard } from './ProductCard';

// Types
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

// ============================================
// CONSTANTS
// ============================================

const PLACEHOLDER_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// Sales Analytics Component
const ProductSalesAnalytics: React.FC<{ productId: string }> = ({ productId }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const salesData = await productService.getSalesByProduct(productId);
        setData(salesData);
      } catch (error) {
        console.error('Failed to load sales analytics:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [productId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
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
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(data.totalRevenue || 0)}
          </p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Units Sold</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {data.totalQuantity || 0}
          </p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Average Price</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {formatCurrency(data.averagePrice || 0)}
          </p>
        </div>
      </div>
      {data.items && data.items.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Recent Sales</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.items.slice(0, 10).map((item: any, index: number) => (
              <div key={index} className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 py-2">
                <span className="text-gray-600 dark:text-gray-400">{item.date}</span>
                <span className="text-gray-600 dark:text-gray-400">{item.customerName}</span>
                <span className="font-medium text-gray-900 dark:text-white">
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

export function ProductDetail({ product: initialProduct, isAdmin = false }: ProductDetailProps) {
  const router = useRouter();
  const { canEdit, canDelete, canManage } = usePermission();
  const { isDark } = useThemeStore();
  
  const [product, setProduct] = useState<Product>(initialProduct);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
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
  
  // Barcode/QR Code states
  const [barcodeInfo, setBarcodeInfo] = useState<BarcodeInfo | null>(null);
  const [loadingBarcode, setLoadingBarcode] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [inventoryHistory, setInventoryHistory] = useState<InventoryHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [barcodeCopied, setBarcodeCopied] = useState(false);

  // ✅ FIXED: Image error states
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [variantImageErrors, setVariantImageErrors] = useState<Record<string, boolean>>({});

  const canEditProduct = canEdit(PermissionResource.PRODUCT) || canManage(PermissionResource.PRODUCT);
  const canDeleteProduct = canDelete(PermissionResource.PRODUCT) || canManage(PermissionResource.PRODUCT);

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

  // Load product data
  const loadProduct = useCallback(async (productId: string, showLoading = true) => {
    if (!productId) {
      router.push(isAdmin ? '/admin/catalog' : '/shop');
      return;
    }

    try {
      if (showLoading) setLoading(true);
      setError(null);
      // Reset image errors on load
      setImageErrors({});
      setVariantImageErrors({});
      
      const data = await productService.getProductById(productId);
      
      // Validate and clean images
      const validImages = (data.images || []).filter((img: string) => {
        if (!img || typeof img !== 'string') return false;
        if (img === PLACEHOLDER_IMAGE) return false;
        if (img.length < 100) return false;
        return true;
      });
      
      const images = validImages.length > 0 ? validImages : [];
      
      // Map variants with valid images
      const mappedVariants: Variant[] = (data.variants || []).map((v: any) => {
        const variantImages = (v.images || []).filter((img: string) => {
          if (!img || typeof img !== 'string') return false;
          if (img === PLACEHOLDER_IMAGE) return false;
          if (img.length < 100) return false;
          return true;
        });
        
        return {
          id: v.id,
          name: v.name,
          sku: v.sku,
          price: v.price,
          costPrice: v.costPrice ?? undefined,
          stock: v.stock || 0,
          isActive: v.isActive !== undefined ? v.isActive : true,
          images: variantImages.length > 0 ? variantImages : [],
          attributes: v.attributes || {},
          barcode: v.barcode ?? undefined,
          inventoryId: v.inventoryId ?? undefined,
        };
      });
      
      // Fix: Handle null/undefined values properly
      const mappedProduct: Product = {
        id: data.id,
        name: data.name,
        sku: data.sku,
        description: data.description || '',
        unitPrice: data.unitPrice,
        costPrice: data.costPrice ?? undefined,
        barcode: data.barcode ?? undefined,
        images: images,
        category: data.category ?? undefined,
        supplier: data.supplier ?? undefined,
        inventory: data.inventory ? {
          id: data.inventory.id,
          quantity: data.inventory.quantity || 0,
          reserved: data.inventory.reserved || 0,
          available: (data.inventory.quantity || 0) - (data.inventory.reserved || 0),
          reorderPoint: (data.inventory as any).reorderPoint || 5,
          location: (data.inventory as any).location || 'Warehouse',
          status: (data.inventory as any).status || 'ACTIVE'
        } : null,
        variants: mappedVariants,
        isActive: data.isActive,
        isDigital: data.isDigital || false,
        weight: data.weight ?? undefined,
        taxRate: data.taxRate || 0,
        minStock: data.minStock ?? undefined,
        maxStock: data.maxStock ?? undefined,
        attributes: data.attributes || {},
        rating: data.rating ?? undefined,
        reviewCount: data.reviewCount || 0,
        tags: data.tags ?? null,
        featured: data.featured || false,
        inventoryId: data.inventoryId ?? undefined,
        _count: (data as any)._count ? {
          saleItems: (data as any)._count.saleItems || 0,
          orderItems: (data as any)._count.orderItems || 0,
          reviews: (data as any)._count.reviews || 0
        } : undefined,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
      
      setProduct(mappedProduct);
      
      // Load barcode info if exists
      if (mappedProduct.barcode) {
        await loadBarcodeInfo(mappedProduct.id);
      }
      
      // Load inventory history for admin
      if (isAdmin) {
        await loadInventoryHistory(mappedProduct.id);
      }
      
    } catch (error: any) {
      setError(error?.message || 'Failed to load product');
      console.error('Failed to load product:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, router]);

  const loadBarcodeInfo = async (productId: string) => {
    try {
      setLoadingBarcode(true);
      const productData = await productService.getProductById(productId);
      if (productData.barcode) {
        const barcodeImg = await barcodeService.generateBarcodeImage(productData.barcode);
        const qrData = await barcodeService.generateQRCode({
          product: productData.name,
          sku: productData.sku,
          barcode: productData.barcode,
          price: productData.unitPrice,
        });
        setBarcodeInfo({
          barcode: productData.barcode,
          barcodeUrl: barcodeImg.barcodeUrl,
          qrCodeUrl: qrData.qrCodeUrl || '',
        });
      }
    } catch (error) {
      console.warn('No barcode found for this product:', error);
    } finally {
      setLoadingBarcode(false);
    }
  };

  const loadInventoryHistory = async (productId: string) => {
    try {
      setLoadingHistory(true);
      const inventory = await inventoryService.getInventoryItem(productId);
      if (inventory && inventory.transactions) {
        setInventoryHistory(inventory.transactions.map((t: any) => ({
          date: t.createdAt,
          type: t.type || 'adjust',
          quantity: t.quantity,
          previous: t.previousQuantity || 0,
          current: t.currentQuantity || 0,
          reason: t.reason || '',
          user: t.user?.name || 'System',
        })));
      }
    } catch (error) {
      console.error('Failed to load inventory history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadRelatedProducts = async (productId: string) => {
    try {
      setLoadingRelated(true);
      const data = await productService.getRelatedProducts(productId, 4);
      // Map the data to match our Product type
      const mappedData = (data || []).map((item: any) => ({
        ...item,
        description: item.description || '',
        costPrice: item.costPrice ?? undefined,
        barcode: item.barcode ?? undefined,
        weight: item.weight ?? undefined,
        maxStock: item.maxStock ?? undefined,
        rating: item.rating ?? undefined,
        category: item.category ?? undefined,
        supplier: item.supplier ?? undefined,
        inventoryId: item.inventoryId ?? undefined,
      }));
      setRelatedProducts(mappedData);
    } catch (error) {
      console.error('Failed to load related products:', error);
    } finally {
      setLoadingRelated(false);
    }
  };

  const addToRecentlyViewed = async (productId: string) => {
    try {
      await productService.addRecentlyViewed(productId);
    } catch (error) {
      console.error('Failed to add to recently viewed:', error);
    }
  };

  // Initialize product data
  useEffect(() => {
    if (initialProduct?.id) {
      // Map variants with images
      const mappedProduct: Product = {
        ...initialProduct,
        description: initialProduct.description || '',
        costPrice: initialProduct.costPrice ?? undefined,
        barcode: initialProduct.barcode ?? undefined,
        weight: initialProduct.weight ?? undefined,
        maxStock: initialProduct.maxStock ?? undefined,
        rating: initialProduct.rating ?? undefined,
        category: initialProduct.category ?? undefined,
        supplier: initialProduct.supplier ?? undefined,
        inventoryId: initialProduct.inventoryId ?? undefined,
        variants: (initialProduct.variants || []).map((v: any) => ({
          ...v,
          images: v.images || [],
          attributes: v.attributes || {},
          barcode: v.barcode ?? undefined,
          inventoryId: v.inventoryId ?? undefined,
        })),
      };
      setProduct(mappedProduct);
      setSelectedImage(0);
      loadRelatedProducts(mappedProduct.id);
      addToRecentlyViewed(mappedProduct.id);
      
      if (mappedProduct.barcode) {
        loadBarcodeInfo(mappedProduct.id);
      }
      
      if (isAdmin) {
        loadInventoryHistory(mappedProduct.id);
      }
    }
  }, [initialProduct, isAdmin]);

  const handleCopySKU = () => {
    if (!product) return;
    navigator.clipboard.writeText(product.sku);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('SKU copied');
  };

  const handleCopyBarcode = async () => {
    if (!barcodeInfo?.barcode) return;
    try {
      await navigator.clipboard.writeText(barcodeInfo.barcode);
      setBarcodeCopied(true);
      setTimeout(() => setBarcodeCopied(false), 2000);
      toast.success('Barcode copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleDownloadBarcode = () => {
    if (!barcodeInfo?.barcodeUrl) return;
    const link = document.createElement('a');
    link.href = barcodeInfo.barcodeUrl;
    link.download = `barcode-${product?.sku || product?.barcode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Barcode downloaded');
  };

  const handlePrintBarcodeLabel = () => {
    if (!barcodeInfo || !product) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Barcode Label - ${product.name}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              min-height: 100vh; 
              margin: 0; 
              background: white; 
            }
            .label { 
              text-align: center; 
              padding: 20px; 
              border: 1px solid #ddd; 
              border-radius: 8px; 
              max-width: 350px;
              background: white;
            }
            .product-name { 
              margin: 0 0 5px 0; 
              font-size: 16px; 
              font-weight: bold;
              color: #1a1a1a;
            }
            .sku { 
              color: #666; 
              font-size: 12px; 
              margin: 0 0 10px 0; 
            }
            .barcode-img { 
              max-width: 280px; 
              margin: 10px 0; 
            }
            .qr-img { 
              max-width: 120px; 
              margin: 5px 0; 
            }
            .price { 
              font-size: 20px; 
              font-weight: bold; 
              color: #2563eb; 
              margin: 5px 0;
            }
            .info { 
              margin-top: 10px; 
              font-size: 12px;
              color: #666;
            }
            .info span { 
              margin: 0 5px; 
            }
            .divider {
              border-top: 1px dashed #ddd;
              margin: 10px 0;
            }
            .stock {
              font-size: 12px;
              color: #666;
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="product-name">${product.name}</div>
            <div class="sku">SKU: ${product.sku || 'N/A'}</div>
            ${barcodeInfo.barcodeUrl ? `<img src="${barcodeInfo.barcodeUrl}" alt="Barcode" class="barcode-img" onerror="this.style.display='none'" />` : ''}
            ${barcodeInfo.qrCodeUrl ? `<img src="${barcodeInfo.qrCodeUrl}" alt="QR Code" class="qr-img" onerror="this.style.display='none'" />` : ''}
            <div class="price">${formatCurrency(product.unitPrice)}</div>
            <div class="stock">Stock: ${product.inventory?.quantity || 0}</div>
            <div class="divider"></div>
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
  };

  const handleGenerateBarcode = async () => {
    if (!product?.id) return;
    try {
      setLoadingBarcode(true);
      const result = await barcodeService.generateUniqueBarcode({
        productName: product.name,
        sku: product.sku,
      });
      
      await productService.updateProduct(product.id, { barcode: result.barcode });
      setProduct((prev: Product) => ({ ...prev, barcode: result.barcode }));
      
      const barcodeImg = await barcodeService.generateBarcodeImage(result.barcode);
      const qrData = await barcodeService.generateQRCode({
        product: product.name,
        sku: product.sku,
        barcode: result.barcode,
        price: product.unitPrice,
      });
      
      setBarcodeInfo({
        barcode: result.barcode,
        barcodeUrl: barcodeImg.barcodeUrl,
        qrCodeUrl: qrData.qrCodeUrl || '',
      });
      
      toast.success('Barcode generated successfully');
      setShowBarcode(true);
    } catch (error: any) {
      console.error('Failed to generate barcode:', error);
      toast.error(error?.message || 'Failed to generate barcode');
    } finally {
      setLoadingBarcode(false);
    }
  };

  const handleScanBarcode = () => {
    const scanned = prompt('Enter barcode to scan:');
    if (scanned) {
      router.push(`/admin/inventory/scan/${scanned}`);
    }
  };

  const handleDelete = async () => {
    if (!canDeleteProduct) {
      toast.error('You don\'t have permission to delete products');
      return;
    }
    setDeleting(true);
    try {
      await productService.deleteProduct(product.id);
      toast.success('Product deleted successfully');
      router.push(isAdmin ? '/admin/catalog' : '/shop');
    } catch (error) {
      console.error('Failed to delete product:', error);
      toast.error('Failed to delete product');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleAddToCart = async () => {
    if (!product) return;
    setAddingToCart(true);
    try {
      toast.success(`${product.name} added to cart`);
    } catch (error) {
      toast.error('Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleQuantityChange = (delta: number) => {
    setQuantity(prev => Math.max(1, Math.min(prev + delta, 99)));
  };

  const handleShare = () => {
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
  };

  const handleOpenVariantLightbox = (variant: Variant) => {
    if (variant.images && variant.images.length > 0) {
      setLightboxImages(variant.images);
      setLightboxIndex(0);
      setShowLightbox(true);
    }
  };

  const getStockStatus = useCallback(() => {
    if (!product) return { status: 'No Stock', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400', icon: HelpCircle };
    const inventory = product.inventory;
    if (!inventory) return { status: 'No Stock', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400', icon: XCircle };
    const available = inventory.quantity - (inventory.reserved || 0);
    if (available <= 0) return { status: 'Out of Stock', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: XCircle };
    if (available <= (product.minStock || 5)) return { status: 'Low Stock', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300', icon: AlertCircle };
    return { status: 'In Stock', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle };
  }, [product]);

  const renderStars = (rating: number = 0) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= Math.round(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'}`}
          />
        ))}
        {rating > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">({rating.toFixed(1)})</span>
        )}
      </div>
    );
  };

  const renderStarsLarge = (rating: number = 0) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-5 h-5 ${star <= Math.round(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'}`}
          />
        ))}
        {rating > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
            {rating.toFixed(1)} ({product?.reviewCount || 0} reviews)
          </span>
        )}
      </div>
    );
  };

  const stock = getStockStatus();
  const inventory = product?.inventory;
  const available = inventory ? inventory.quantity - (inventory.reserved || 0) : 0;
  const images = product?.images || [];
  const hasImages = images.length > 0;
  const hasBarcode = !!barcodeInfo || !!product?.barcode;
  const selectedVariantData = selectedVariant 
    ? product?.variants?.find((v: Variant) => v.id === selectedVariant) 
    : null;

  const displayPrice = useMemo(() => {
    if (selectedVariantData) {
      return selectedVariantData.price;
    }
    return product?.unitPrice || 0;
  }, [selectedVariantData, product?.unitPrice]);

  const totalVariants = product?.variants?.length || 0;
  const activeVariants = product?.variants?.filter((v: Variant) => v.isActive).length || 0;
  const totalVariantStock = product?.variants?.reduce((sum: number, v: Variant) => sum + (v.stock || 0), 0) || 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading product...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 bg-gray-50 dark:bg-gray-900">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Error Loading Product</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">{error}</p>
        <button
          onClick={() => router.push(isAdmin ? '/admin/catalog' : '/shop')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
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
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Product Not Found</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">The product you're looking for doesn't exist.</p>
        <button
          onClick={() => router.push(isAdmin ? '/admin/catalog' : '/shop')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          {isAdmin ? 'Back to Catalog' : 'Back to Shop'}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6 flex-wrap">
          <Link href="/" className="hover:text-gray-700 dark:hover:text-gray-300">Home</Link>
          <span>/</span>
          <Link href={isAdmin ? '/admin/catalog' : '/shop'} className="hover:text-gray-700 dark:hover:text-gray-300">
            {isAdmin ? 'Catalog' : 'Shop'}
          </Link>
          <span>/</span>
          {product.category && (
            <>
              <Link href={`/shop?category=${product.category.id}`} className="hover:text-gray-700 dark:hover:text-gray-300">
                {product.category.name}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-gray-700 dark:text-gray-300 font-medium truncate">{product.name}</span>
        </nav>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(isAdmin ? '/admin/catalog' : '/shop')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex items-center gap-4">
              {/* ✅ FIXED: Product thumbnail with error handling */}
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
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
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{product.name}</h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Hash className="w-4 h-4" />
                    SKU: {product.sku}
                  </span>
                  <button
                    onClick={handleCopySKU}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Copy SKU"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                  {hasBarcode && (
                    <span className="flex items-center gap-1">
                      <Barcode className="w-4 h-4" />
                      Barcode: {barcodeInfo?.barcode || product.barcode}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    product.isActive
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  }`}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {product.featured && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Featured
                    </span>
                  )}
                  {product.inventoryId && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 flex items-center gap-1">
                      <Link2 className="w-3 h-3" />
                      Inventory Linked
                    </span>
                  )}
                  {totalVariants > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
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
                <WishlistButton productId={product.id} variant="full" size="sm" />
                <button
                  onClick={handleShare}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </>
            )}
            {isAdmin && canEditProduct && (
              <Link
                href={`/admin/catalog/edit/${product.id}`}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit
              </Link>
            )}
            {isAdmin && canDeleteProduct && (
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
        {isAdmin && !product.isActive && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700 dark:text-red-300">This product is currently inactive and not visible to customers.</span>
          </div>
        )}
        {available <= 0 && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700 dark:text-red-300">This product is out of stock.</span>
          </div>
        )}
        {isAdmin && available <= (product.minStock || 5) && available > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
            <span className="text-yellow-700 dark:text-yellow-300">
              Low stock alert. Only {available} units remaining.
            </span>
          </div>
        )}

        {/* Product Main Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Image Gallery - ✅ FIXED with error handling */}
          <div className="space-y-4">
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden aspect-square">
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
                className="absolute bottom-4 right-4 p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              {product.featured && (
                <div className="absolute top-4 left-4 px-3 py-1 bg-yellow-500 text-white text-xs rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Featured
                </div>
              )}
            </div>

            {/* Thumbnails - ✅ FIXED with error handling */}
            {hasImages && images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                {images.map((image: string, index: number) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all ${
                      selectedImage === index
                        ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50'
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

          {/* Product Info */}
          <div className="space-y-6">
            {/* Title & Rating */}
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{product.name}</h1>
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
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(displayPrice)}
                </span>
                {selectedVariantData && selectedVariantData.price !== product.unitPrice && (
                  <span className="text-sm text-gray-400 line-through">
                    {formatCurrency(product.unitPrice)}
                  </span>
                )}
                {product.costPrice && product.costPrice > 0 && product.costPrice > displayPrice && (
                  <>
                    <span className="text-sm text-gray-400 line-through">
                      {formatCurrency(product.costPrice)}
                    </span>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      Save {formatCurrency(product.costPrice - displayPrice)}
                    </span>
                  </>
                )}
              </div>
              {product.taxRate > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Tax included ({product.taxRate}%)
                </p>
              )}
            </div>

            {/* Stock Status */}
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${stock.color} flex items-center gap-1`}>
                <stock.icon className="w-4 h-4" />
                {stock.status}
              </span>
              {available > 0 && available <= 10 && (
                <span className="text-sm text-yellow-600 dark:text-yellow-400">
                  Only {available} left in stock
                </span>
              )}
            </div>

            {/* Barcode Section */}
            {isAdmin && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Barcode className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Barcode / QR Code</p>
                      {hasBarcode ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          {barcodeInfo?.barcode || product.barcode}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400">No barcode assigned</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!hasBarcode && (
                      <button
                        onClick={handleGenerateBarcode}
                        disabled={loadingBarcode}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-1 disabled:opacity-50 transition-colors"
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
                          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm flex items-center gap-1"
                        >
                          <QrCode className="w-4 h-4" />
                          {showBarcode ? 'Hide' : 'Show'}
                        </button>
                        <button
                          onClick={handlePrintBarcodeLabel}
                          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm flex items-center gap-1"
                        >
                          <Printer className="w-4 h-4" />
                          Print
                        </button>
                        <button
                          onClick={handleDownloadBarcode}
                          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm flex items-center gap-1"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {isAdmin && (
                      <button
                        onClick={handleScanBarcode}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm flex items-center gap-1 transition-colors"
                      >
                        <Scan className="w-4 h-4" />
                        Scan
                      </button>
                    )}
                  </div>
                </div>

                {/* Barcode Display */}
                <AnimatePresence>
                  {showBarcode && barcodeInfo && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/30 overflow-hidden"
                    >
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
                          <button
                            onClick={handleCopyBarcode}
                            className="mt-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 mx-auto"
                          >
                            {barcodeCopied ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            {barcodeCopied ? 'Copied' : 'Copy'}
                          </button>
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
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Scan to view product</p>
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
                    className="text-blue-600 dark:text-blue-400 text-sm hover:underline"
                  >
                    Read more
                  </button>
                )}
              </div>
            )}

            {/* Key Features */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
              {product.isDigital && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <CreditCard className="w-4 h-4 text-blue-500" />
                  <span>Digital Product</span>
                </div>
              )}
              {product.weight && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Weight className="w-4 h-4 text-purple-500" />
                  <span>{product.weight} kg</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Truck className="w-4 h-4 text-green-500" />
                <span>Free Shipping</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <RotateCcw className="w-4 h-4 text-orange-500" />
                <span>30 Day Returns</span>
              </div>
            </div>

            {/* Variants with Image Support - ✅ FIXED with error handling */}
            {product.variants && product.variants.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Variants</p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.filter((v: Variant) => v.isActive).map((variant: Variant) => (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedVariant(selectedVariant === variant.id ? null : variant.id)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors flex items-center gap-2 ${
                        selectedVariant === variant.id
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-400'
                      }`}
                    >
                      {/* ✅ FIXED: Variant image with optional chaining */}
                      {variant.images && variant.images.length > 0 && (
                        <div 
                          className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 cursor-pointer"
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
                      {variant.name}
                      {variant.price !== product.unitPrice && (
                        <span className="ml-1 text-xs">
                          ({formatCurrency(variant.price)})
                        </span>
                      )}
                      {variant.stock <= 0 && (
                        <span className="ml-1 text-xs text-red-500">(Out of stock)</span>
                      )}
                    </button>
                  ))}
                </div>
                {selectedVariantData && selectedVariantData.attributes && 
                  Object.keys(selectedVariantData.attributes).length > 0 && (
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Variant Attributes</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {Object.entries(selectedVariantData.attributes).map(([key, value]) => (
                        <span key={key} className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded">
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
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Tags:</p>
                <div className="flex flex-wrap gap-2">
                  {product.tags.map((tag: string) => (
                    <Link
                      key={tag}
                      href={`/shop?search=${tag}`}
                      className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity & Add to Cart */}
            {!isAdmin && (
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg">
                    <button
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1}
                      className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center text-gray-900 dark:text-white">{quantity}</span>
                    <button
                      onClick={() => handleQuantityChange(1)}
                      disabled={quantity >= 99}
                      className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={handleAddToCart}
                    disabled={available <= 0 || addingToCart}
                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addingToCart ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ShoppingCart className="w-5 h-5" />
                    )}
                    {addingToCart ? 'Adding...' : 'Add to Cart'}
                  </button>
                  <WishlistButton productId={product.id} variant="icon" size="md" />
                </div>
                <button
                  onClick={() => router.push('/checkout')}
                  disabled={available <= 0}
                  className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShoppingBag className="w-5 h-5" />
                  Buy Now
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 overflow-x-auto">
            <nav className="flex gap-4">
              {[
                { id: 'overview', label: 'Overview', icon: Info },
                { id: 'specifications', label: 'Specifications', icon: Hash },
                { id: 'variants', label: 'Variants', icon: Layers },
                { id: 'inventory', label: 'Inventory', icon: Package },
                { id: 'reviews', label: 'Reviews', icon: Star },
                ...(isAdmin ? [{ id: 'analytics', label: 'Analytics', icon: TrendingUp }] : []),
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-4 py-3 border-b-2 font-medium text-sm transition-colors capitalize whitespace-nowrap ${
                    activeTab === id
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {id === 'variants' && totalVariants > 0 && (
                    <span className="ml-1 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                      {totalVariants}
                    </span>
                  )}
                  {id === 'reviews' && product.reviewCount && product.reviewCount > 0 && (
                    <span className="ml-1 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
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
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Description</h3>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
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
                        <span className="text-gray-600 dark:text-gray-400">Tax Rate</span>
                        <span className="text-gray-900 dark:text-white">{product.taxRate || 0}%</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">Min Stock</span>
                        <span className="text-gray-900 dark:text-white">{product.minStock || 5}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">Max Stock</span>
                        <span className="text-gray-900 dark:text-white">{product.maxStock || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">Available</span>
                        <span className={`font-medium ${
                          available <= 0 ? 'text-red-600 dark:text-red-400' : 
                          available <= (product.minStock || 5) ? 'text-yellow-600 dark:text-yellow-400' : 
                          'text-green-600 dark:text-green-400'
                        }`}>
                          {available}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

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

            {activeTab === 'specifications' && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Specifications</h3>
                {product.attributes && Object.keys(product.attributes).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(product.attributes).map(([key, value]) => (
                      <div key={key} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{key.replace(/_/g, ' ')}</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white break-all">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No specifications available</p>
                )}
              </div>
            )}

            {activeTab === 'variants' && (
              <div>
                {product.variants && product.variants.length > 0 ? (
                  <div className="space-y-4">
                    {product.variants.map((variant: Variant) => (
                      <div key={variant.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <div className="flex items-center gap-4">
                          {/* ✅ FIXED: Variant detail image with optional chaining */}
                          {variant.images && variant.images.length > 0 && (
                            <div 
                              className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 cursor-pointer"
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
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{variant.name}</p>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <Hash className="w-3 h-3" />
                                SKU: {variant.sku}
                              </span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {formatCurrency(variant.price)}
                              </span>
                              <span>Stock: {variant.stock}</span>
                              {variant.barcode && <span className="text-xs">Barcode: {variant.barcode}</span>}
                              {variant.inventoryId && (
                                <span className="text-xs text-blue-500 flex items-center gap-1">
                                  <Link2 className="w-3 h-3" />
                                  Inventory Linked
                                </span>
                              )}
                              {variant.attributes && Object.keys(variant.attributes).length > 0 && (
                                <span className="text-xs text-gray-400">
                                  {Object.entries(variant.attributes).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                </span>
                              )}
                            </div>
                            {variant.images && variant.images.length > 1 && (
                              <div className="flex gap-1 mt-2">
                                {variant.images.slice(1, 4).map((img, idx) => (
                                  <div 
                                    key={idx} 
                                    className="w-10 h-10 rounded-md overflow-hidden border border-gray-200 dark:border-gray-600 cursor-pointer"
                                    onClick={() => handleOpenVariantLightbox(variant)}
                                  >
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
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          variant.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                          {variant.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">No variants for this product</p>
                )}
              </div>
            )}

            {activeTab === 'inventory' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
                      available <= 0 ? 'text-red-600 dark:text-red-400' : 
                      available <= (product.minStock || 5) ? 'text-yellow-600 dark:text-yellow-400' : 
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {available}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Reorder Point</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{inventory?.reorderPoint || product.minStock || 5}</p>
                  </div>
                </div>

                {/* Variant Stock Summary */}
                {totalVariants > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Variant Stock Summary</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Total Variants</span>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{totalVariants}</p>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Active Variants</span>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{activeVariants}</p>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Combined Stock</span>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {(inventory?.quantity || 0) + totalVariantStock}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex flex-wrap gap-4 text-sm text-yellow-700 dark:text-yellow-300">
                    <span>📍 Location: {inventory?.location || 'Warehouse'}</span>
                    <span>📦 SKU: {product.sku}</span>
                    {product.barcode && <span>🔲 Barcode: {product.barcode}</span>}
                    <span className="text-xs">
                      Low stock threshold: {product.minStock || 5} units
                    </span>
                  </div>
                </div>

                {/* Inventory History */}
                {isAdmin && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <ClockIcon className="w-4 h-4" />
                      Inventory History
                    </h4>
                    {loadingHistory ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                      </div>
                    ) : inventoryHistory.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                              <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">Date</th>
                              <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">Type</th>
                              <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">Quantity</th>
                              <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">Previous</th>
                              <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">Current</th>
                              <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">Reason</th>
                              <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">User</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {inventoryHistory.map((entry, index) => (
                              <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{formatDate(entry.date)}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    entry.type === 'in' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                    entry.type === 'out' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                    entry.type === 'adjust' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                  }`}>
                                    {entry.type}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white">
                                  {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">{entry.previous}</td>
                                <td className="px-3 py-2 text-right text-gray-900 dark:text-white">{entry.current}</td>
                                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{entry.reason || '-'}</td>
                                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{entry.user || 'System'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 dark:text-gray-400 py-4">No inventory history available</p>
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

        {/* Related Products */}
        {!isAdmin && relatedProducts.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">You May Also Like</h2>
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
                    showWishlist={true}
                    showAddToCart={true}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Recently Viewed */}
        {!isAdmin && (
          <div className="mt-8">
            <RecentlyViewed limit={6} />
          </div>
        )}

        {/* Lightbox with variant image support - ✅ FIXED with error handling */}
        <AnimatePresence>
          {showLightbox && lightboxImages.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
              onClick={() => setShowLightbox(false)}
            >
              <button
                onClick={() => setShowLightbox(false)}
                className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Close lightbox"
              >
                <X className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(prev => (prev > 0 ? prev - 1 : lightboxImages.length - 1));
                }}
                className="absolute left-4 p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <img
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
                className="absolute right-4 p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Next image"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                {lightboxImages.map((_: any, index: number) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex(index);
                    }}
                    className={`w-2 h-2 rounded-full transition-all ${
                      lightboxIndex === index ? 'bg-white w-4' : 'bg-white/50'
                    }`}
                    aria-label={`Go to image ${index + 1}`}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Modal */}
        <AnimatePresence>
          {showDeleteModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
              >
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
                  This will permanently remove the product and all associated data, including variants, inventory, and sales history.
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
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
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
