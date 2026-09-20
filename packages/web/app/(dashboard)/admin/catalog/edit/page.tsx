'use client';

// packages/web/app/(dashboard)/admin/catalog/edit/[id]/page.tsx

import React, { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Lock, ArrowLeft, Loader2, AlertCircle, X,
  Eye, RefreshCw, Sun, Moon, Trash2, AlertTriangle,
  Package, Barcode,
  Tag, Layers, Star, Copy, Check,
  ImageIcon, Link2,
} from 'lucide-react';

import { ProductForm } from '../../../../../components/products/ProductForm';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { productService } from '../../../../../services/productService';
import { toast } from '../../../../../utils/toast-manager';
import { useThemeStore } from '../../../../stores/themeStore';

// ============================================
// TYPES
// ============================================

interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  costPrice?: number;
  stock: number;
  attributes: Record<string, any>;
  isActive: boolean;
  images: string[];
  barcode?: string;
  inventoryId?: string;
}

interface ProductData {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  images: string[];
  isActive: boolean;
  unitPrice: number;
  rating?: number;
  reviewCount?: number;
  variants: ProductVariant[];
  inventoryId?: string;
  inventory?: {
    id: string;
    quantity: number;
    reserved: number;
    available?: number;
  };
  businessUnitId: string;
}

// ============================================
// CONSTANTS
// ============================================

const PLACEHOLDER_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// ============================================
// PAGE
// ============================================

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();

  // `params?.id` can be `string | string[] | undefined` in Next.js.
  // Normalise it up front so nothing downstream has to guess.
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const {
    canEdit,
    canManage,
    canDelete,
    isLoading: permissionLoading,
  } = usePermission();
  const { isDark, toggleTheme } = useThemeStore();

  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [productExists, setProductExists] = useState(true);
  const [productData, setProductData] = useState<ProductData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [variantImageErrors, setVariantImageErrors] = useState<
    Record<string, boolean>
  >({});

  const canEditProducts =
    canEdit(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);
  const canDeleteProducts =
    canDelete(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Redirect if the route has no id at all. Doing this in an effect
  // avoids calling `router.push` during render, which React warns
  // about.
  useEffect(() => {
    if (isClient && !id) {
      router.push('/admin/catalog');
    }
  }, [isClient, id, router]);

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
  // VERIFY PRODUCT
  // ============================================

  const verifyProduct = useCallback(
    async (showLoading = true) => {
      if (!id) {
        // No id — the effect above handles redirect.
        setLoading(false);
        return;
      }

      try {
        if (showLoading) setLoading(true);
        setError(null);
        setProductExists(true);

        // Reset every transient per-product flag so navigating
        // between edit routes doesn't carry stale failure markers.
        setImageErrors({});
        setVariantImageErrors({});

        const data = await productService.getProductById(id);

        if (!data || !data.id) {
          setProductExists(false);
          setError('Product not found');
          return;
        }

        const mappedData: ProductData = {
          id: data.id,
          name: data.name,
          sku: data.sku,
          barcode: data.barcode || undefined,
          images: Array.isArray(data.images) ? data.images : [],
          isActive: data.isActive,
          unitPrice: data.unitPrice,
          rating: data.rating || undefined,
          reviewCount: data.reviewCount || undefined,
          variants: Array.isArray(data.variants)
            ? data.variants.map((v: any) => ({
                id: v.id || `variant_${Math.random().toString(36).slice(2)}`,
                name: v.name || 'Unnamed Variant',
                sku: v.sku || '',
                price: v.price || 0,
                costPrice: v.costPrice || undefined,
                stock: v.stock || 0,
                attributes: v.attributes || {},
                isActive: v.isActive !== undefined ? v.isActive : true,
                images: Array.isArray(v.images) ? v.images : [],
                barcode: v.barcode || undefined,
                inventoryId: v.inventoryId || undefined,
              }))
            : [],
          inventoryId: data.inventoryId || undefined,
          inventory: data.inventory
            ? {
                id: data.inventory.id,
                quantity: data.inventory.quantity || 0,
                reserved: data.inventory.reserved || 0,
                available: data.inventory.available || 0,
              }
            : undefined,
          businessUnitId: data.businessUnitId || 'default',
        };

        setProductData(mappedData);
      } catch (err: any) {
        console.error('Failed to load product:', err);
        if (err?.response?.status === 404) {
          setProductExists(false);
          setError('Product not found');
        } else {
          setError('Failed to load product. Please try again.');
          toast.error('Failed to load product');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    if (isClient && id && canEditProducts) {
      verifyProduct();
    }
  }, [isClient, id, canEditProducts, verifyProduct]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await verifyProduct(false);
      toast.success('Product refreshed');
    } catch {
      // verifyProduct handles its own error state.
    }
  }, [verifyProduct]);

  const handleCopyId = useCallback(() => {
    if (!id) return;
    navigator.clipboard
      .writeText(id)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Product ID copied');
      })
      .catch(() => toast.error('Failed to copy ID'));
  }, [id]);

  const handleDelete = useCallback(async () => {
    if (!id) return;

    if (!canDeleteProducts) {
      toast.error("You don't have permission to delete products");
      return;
    }

    setDeleting(true);
    try {
      await productService.deleteProduct(id);
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

  // ============================================
  // DERIVED
  // ============================================

  const product = productData;
  const productName = product?.name || 'Product';
  const productSku = product?.sku || 'N/A';
  const productStatus = product?.isActive ? 'Active' : 'Inactive';
  const productStatusColor = product?.isActive
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';

  const mainStock = product?.inventory?.quantity || 0;
  const variantStock =
    product?.variants?.reduce(
      (sum: number, v: ProductVariant) => sum + (v.stock || 0),
      0
    ) || 0;
  const totalStock = mainStock + variantStock;

  const hasVariantImages = useMemo(
    () =>
      (product?.variants || []).some(
        (v) => v.images && v.images.length > 0
      ),
    [product?.variants]
  );

  const idPreview = id ? id.slice(0, 8) : '';

  // ============================================
  // EARLY RETURNS
  // ============================================

  if (!id) {
    // The redirect effect has already fired; render the loading shell
    // rather than null so the transition is smooth.
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  if (permissionLoading || !isClient || (loading && !productData)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading product...
          </p>
        </div>
      </div>
    );
  }

  if (!canEditProducts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to edit products. Please contact your
          administrator.
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

  if (!productExists) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Product Not Found
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          The product you're trying to edit doesn't exist or has been removed.
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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Error Loading Product
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          {error}
        </p>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={() => verifyProduct(true)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Loader2 className="w-4 h-4" />
            Retry
          </button>
          <button
            onClick={() => router.push('/admin/catalog')}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Back to Catalog
          </button>
        </div>
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
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Back to catalog"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Edit Product
                </h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${productStatusColor}`}
                >
                  {productStatus}
                </span>
                {product?.inventoryId && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    Linked to Inventory
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  {productName}
                </span>
                <span className="flex items-center gap-1">
                  <Tag className="w-4 h-4" />
                  SKU: {productSku}
                </span>
                <button
                  onClick={handleCopyId}
                  className="flex items-center gap-1 text-xs hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  title="Copy full product ID"
                >
                  ID: {idPreview}
                  {copied ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
                {product?.barcode && (
                  <span className="flex items-center gap-1 text-xs font-mono">
                    <Barcode className="w-3 h-3" />
                    {product.barcode}
                  </span>
                )}
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
              <RefreshCw
                className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
              />
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

            <Link
              href={`/shop/${id}`}
              target="_blank"
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="View product"
            >
              <Eye className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </Link>

            {canDeleteProducts && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="p-2 rounded-lg border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                aria-label="Delete product"
              >
                <Trash2 className="w-5 h-5 text-red-500" />
              </button>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Price</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              ${product?.unitPrice?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Total Stock
            </p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {totalStock}
              {variantStock > 0 && (
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">
                  ({mainStock} + {variantStock} variants)
                </span>
              )}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Variants
            </p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {product?.variants?.length || 0}
              {hasVariantImages && (
                <ImageIcon className="w-3 h-3 inline ml-1 text-purple-500" />
              )}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Rating</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {product?.rating?.toFixed(1) || 'N/A'}
              {product?.rating && product.rating > 0 && (
                <Star className="w-3 h-3 inline ml-1 text-yellow-400 fill-current" />
              )}
            </p>
          </div>
        </div>

        {/* Variant image summary */}
        {product?.variants && product.variants.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-500" />
              Variant Images Summary
            </h3>
            <div className="flex flex-wrap gap-3">
              {product.variants.map((variant: ProductVariant) => (
                <div
                  key={variant.id}
                  className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2"
                >
                  <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-200 dark:bg-gray-600 flex-shrink-0">
                    {variant.images && variant.images.length > 0 ? (
                      <img
                        src={getValidVariantImage(variant.images[0])}
                        alt={variant.name}
                        className="w-full h-full object-cover"
                        onError={() =>
                          handleVariantImageError(variant.images[0])
                        }
                      />
                    ) : (
                      <Layers className="w-full h-full p-2 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {variant.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {variant.images?.length || 0} image(s)
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Product Form */}
        <Suspense
          fallback={
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
              <div className="flex items-center justify-center min-h-[40vh]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto" />
                  <p className="mt-4 text-gray-600 dark:text-gray-400">
                    Loading product form...
                  </p>
                </div>
              </div>
            </div>
          }
        >
          <ProductForm
            mode="edit"
            productId={id}
            businessUnitId={product?.businessUnitId}
          />
        </Suspense>

        {/* Delete modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
              onClick={() => setShowDeleteModal(false)}
            />
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
                  {productName}
                </strong>
                ? This will permanently remove the product and all associated
                data, including variants, inventory, and sales history.
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
      </div>
    </div>
  );
}
