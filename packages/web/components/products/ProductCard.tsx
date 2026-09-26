'use client';

// D:\Projects\Kalwanga\packages\web\components\products\ProductCard.tsx

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Package, Star, ShoppingCart, Eye,
  Edit, Trash2, AlertCircle, Loader2, Layers, ImageIcon, Link2,
} from 'lucide-react';

import { formatCurrency } from '../../utils/formatters';
import { toast } from '../../utils/toast-manager';
import { WishlistButton } from './WishlistButton';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../hooks/useAuth';
import { PermissionResource } from '../../types/enums';
import { cartService } from '../../services/cartService';
import { guestCartService } from '../../services/guestCartService';

// ============================================
// TYPES
// ============================================

interface ProductVariantShape {
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
  inventory?:
    | { quantity?: number; reserved?: number }
    | null;
}

/**
 * The inventory relation is singular on the canonical `Product` type
 * (`Inventory | null`). Older callers occasionally pass an array.
 * Accept both shapes so the stock math is always right.
 */
type InventoryLike =
  | { quantity?: number; reserved?: number }
  | Array<{ quantity?: number; reserved?: number }>
  | null
  | undefined;

interface ProductCardProduct {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  costPrice?: number | null;
  images?: string[];
  description?: string;
  category?: { id: string; name: string };
  inventory?: InventoryLike;
  minStock?: number;
  rating?: number;
  reviewCount?: number;
  isActive: boolean;
  featured?: boolean;
  isDigital?: boolean;
  tags?: string[];
  createdAt?: string;
  variants?: ProductVariantShape[];
  inventoryId?: string | null;
}

interface ProductCardProps {
  product: ProductCardProduct;
  variant?: 'default' | 'compact' | 'featured' | 'minimal';
  orientation?: 'vertical' | 'horizontal';
  showWishlist?: boolean;
  showAddToCart?: boolean;
  showQuickView?: boolean;
  showAdminActions?: boolean;
  onAddToCart?: (
    productId: string,
    variantId?: string,
    quantity?: number
  ) => Promise<void> | void;
  onQuickView?: (product: ProductCardProduct) => void;
  onEdit?: (productId: string) => void;
  onDelete?: (productId: string) => void;
  className?: string;
  index?: number;
}

// ============================================
// HELPERS
// ============================================

const PLACEHOLDER_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * Read the primary inventory quantity regardless of whether the
 * caller passed a singular object or a legacy array.
 */
function readInventoryTotals(inventory: InventoryLike): {
  quantity: number;
  reserved: number;
} {
  if (!inventory) return { quantity: 0, reserved: 0 };

  if (Array.isArray(inventory)) {
    const initial: { quantity: number; reserved: number } = {
      quantity: 0,
      reserved: 0,
    };

    return inventory.reduce<{ quantity: number; reserved: number }>(
      (acc, inv) => ({
        quantity: acc.quantity + (inv.quantity ?? 0),
        reserved: acc.reserved + (inv.reserved ?? 0),
      }),
      initial
    );
  }

  return {
    quantity: inventory.quantity ?? 0,
    reserved: inventory.reserved ?? 0,
  };
}

/**
 * Compute the effective available stock for a single variant,
 * preferring its linked Inventory row over the denormalized `stock`.
 */
function readSingleVariantStock(
  variant: ProductVariantShape
): number {
  if (variant.inventory) {
    return Math.max(
      0,
      (variant.inventory.quantity ?? 0) -
        (variant.inventory.reserved ?? 0)
    );
  }
  return Math.max(0, variant.stock ?? 0);
}

/**
 * Sum variant available stock for display purposes only.
 *
 * NOTE: this is used for the "+N variant stock" badge. It is NOT
 * used to enable/disable the Add-to-Cart button, because the backend
 * does not sum parent + variants when validating a cart add.
 */
function readTotalVariantStock(
  variants: ProductVariantShape[] | undefined
): number {
  if (!variants || variants.length === 0) return 0;
  let total = 0;
  for (const v of variants) {
    total += readSingleVariantStock(v);
  }
  return total;
}

function stopEvent(e: React.MouseEvent): void {
  e.preventDefault();
  e.stopPropagation();
}

/**
 * Extract a human-readable error message from the various shapes the
 * backend emits. The order matters — we check the most specific
 * shapes first.
 *
 *   1. `{ error: { message } }`          ← cart validation
 *   2. `{ error: string }`
 *   3. `{ message }`
 *   4. `{ errors: [{ field, message }] }` ← Zod field errors
 *   5. `error.message`                    ← axios / JS
 *
 * The backend's "Insufficient stock. Available: 0" arrives as
 * `response.data.error.message`.
 */
function extractErrorMessage(error: any, fallback: string): string {
  if (!error) return fallback;

  const data = error?.response?.data;
  if (data) {
    if (typeof data.error === 'string') return data.error;
    if (data.error?.message) return String(data.error.message);
    if (data.message) return String(data.message);
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors
        .map((e: any) => `${e.field ?? 'field'}: ${e.message ?? 'invalid'}`)
        .join(', ');
    }
  }

  if (error?.message) return String(error.message);
  return fallback;
}

/**
 * True when the backend rejected the request because stock ran out
 * between page load and the click.
 */
function isInsufficientStockError(error: any): boolean {
  const message = extractErrorMessage(error, '');
  return /insufficient stock/i.test(message);
}

/**
 * Extract the "Available: N" number from a stock error message, when
 * present. Returns null if the message doesn't include a number.
 */
function parseAvailableFromStockError(error: any): number | null {
  const message = extractErrorMessage(error, '');
  const match = message.match(/available:\s*(\d+)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

// ============================================
// COMPONENT
// ============================================

export function ProductCard({
  product,
  variant = 'default',
  orientation = 'vertical',
  showWishlist = true,
  showAddToCart = true,
  showQuickView = true,
  showAdminActions = false,
  onAddToCart,
  onQuickView,
  onEdit,
  onDelete,
  className = '',
  index = 0,
}: ProductCardProps) {
  const router = useRouter();
  const { canEdit, canDelete, canManage } = usePermission();
  const { isAuthenticated } = useAuth();

  const [isHovered, setIsHovered] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null
  );

  /**
   * Set to true when the backend rejected a cart add with
   * "Insufficient stock". The card then reflects the server's truth
   * without needing the parent to refetch. Resets when the component
   * remounts with a new product.
   */
  const [serverReportedOutOfStock, setServerReportedOutOfStock] =
    useState(false);

  const canEditProduct =
    canEdit(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);
  const canDeleteProduct =
    canDelete(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);

  const productId = product?.id;
  const hasValidProductId =
    !!productId &&
    typeof productId === 'string' &&
    productId.trim().length > 0;

  // ============================================
  // DERIVED STOCK / VARIANTS
  // ============================================

  const { quantity, reserved } = readInventoryTotals(product?.inventory);
  const mainStock = Math.max(0, quantity - reserved);

  const variants = product?.variants ?? [];
  const totalVariantStock = readTotalVariantStock(variants);

  const hasVariants = variants.length > 0;
  const totalVariantCount = variants.length;
  const hasVariantImages = variants.some(
    (v) => Array.isArray(v.images) && v.images.length > 0
  );
  const isInventoryLinked = !!product?.inventoryId;

  const selectedVariant = selectedVariantId
    ? variants.find((v) => v.id === selectedVariantId) ?? null
    : null;

  /**
   * The stock value that actually gates the Add-to-Cart button.
   *
   * The backend validates cart adds against:
   *   - the selected variant's inventory row, when a variant is
   *     selected, OR
   *   - the product's own inventory row, when no variant is selected.
   *
   * It does NOT sum parent + variants. Mirror that rule here so the
   * button's enabled state matches what the server will accept.
   *
   * Summing would produce a UI that lets the user click on products
   * the server will reject with 400 "Insufficient stock".
   */
  const effectiveStock = selectedVariant
    ? readSingleVariantStock(selectedVariant)
    : mainStock;

  const isOutOfStock = effectiveStock <= 0 || serverReportedOutOfStock;

  const isLowStock =
    effectiveStock > 0 &&
    !isOutOfStock &&
    effectiveStock <= (product?.minStock || 5);

  const displayPrice = selectedVariant?.price ?? product?.unitPrice ?? 0;

  const stockStatus = (() => {
    if (isOutOfStock) return { label: 'Out of Stock', color: 'bg-danger-500' };
    if (isLowStock)
      return { label: `Only ${effectiveStock} left`, color: 'bg-warning-500' };
    return { label: 'In Stock', color: 'bg-success-500' };
  })();

  // ============================================
  // IMAGE HELPERS
  // ============================================

  const getValidImage = useCallback(
    (url: string | undefined): string => {
      if (!url) return PLACEHOLDER_IMAGE;
      if (imageErrors[url]) return PLACEHOLDER_IMAGE;
      return url;
    },
    [imageErrors]
  );

  const handleImageError = useCallback((url: string) => {
    setImageErrors((prev) => ({ ...prev, [url]: true }));
  }, []);

  const primaryImage =
    product?.images && product.images.length > 0
      ? product.images[0]
      : null;
  const primaryImageValid = primaryImage && !imageErrors[primaryImage];

  // ============================================
  // HANDLERS
  // ============================================

  const handleAddToCart = useCallback(
    async (e: React.MouseEvent) => {
      stopEvent(e);

      if (!hasValidProductId) {
        console.error('❌ ProductCard: invalid product id', { productId });
        toast.error('Product ID is invalid');
        return;
      }
      if (isOutOfStock) {
        toast.warning('This product is out of stock');
        return;
      }
      if (addingToCart) return;

      setAddingToCart(true);
      try {
        const cleanProductId = String(productId).trim();
        const variantId = selectedVariantId || undefined;

        if (onAddToCart) {
          await onAddToCart(cleanProductId, variantId, 1);
        } else {
          // ✅ Authenticated → authenticated cart route.
          //    Anonymous → guest cart route, backed by the
          //    `guest_session_id` cookie set by
          //    `guestSessionMiddleware`.
          const cart = isAuthenticated
            ? cartService
            : guestCartService;

          await cart.addItem({
            productId: cleanProductId,
            variantId,
            quantity: 1,
          });

          toast.success(`${product.name} added to cart`);
          window.dispatchEvent(new CustomEvent('cart:updated'));
        }
      } catch (err: any) {
        console.error('❌ Failed to add to cart:', err);

        if (isInsufficientStockError(err)) {
          // The server is authoritative. Flip the card to
          // "Out of Stock" immediately and give the user a
          // message they can act on.
          setServerReportedOutOfStock(true);

          const reported = parseAvailableFromStockError(err);
          const message =
            reported !== null
              ? `This item is out of stock (${reported} available).`
              : 'This item is out of stock.';

          toast.error(message);

          window.dispatchEvent(
            new CustomEvent('cart:update-failed', {
              detail: { productId: cleanProductId, reason: 'OUT_OF_STOCK' },
            })
          );
          return;
        }

        toast.error(extractErrorMessage(err, 'Failed to add to cart'));
      } finally {
        setAddingToCart(false);
      }
    },
    [
      hasValidProductId,
      productId,
      isOutOfStock,
      addingToCart,
      selectedVariantId,
      onAddToCart,
      product?.name,
      isAuthenticated,
    ]
  );

  const handleVariantSelect = useCallback(
    (variantId: string, e: React.MouseEvent) => {
      stopEvent(e);
      setSelectedVariantId((prev) =>
        prev === variantId ? null : variantId
      );
    },
    []
  );

  const handleQuickView = useCallback(
    (e: React.MouseEvent) => {
      stopEvent(e);
      if (onQuickView) {
        onQuickView(product);
      } else if (hasValidProductId) {
        router.push(`/shop/${product.id}`);
      }
    },
    [onQuickView, product, router, hasValidProductId]
  );

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      stopEvent(e);
      if (onEdit) {
        onEdit(product.id);
      } else if (hasValidProductId) {
        router.push(`/admin/catalog/edit/${product.id}`);
      }
    },
    [onEdit, product?.id, router, hasValidProductId]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      stopEvent(e);
      if (onDelete) {
        onDelete(product.id);
      } else {
        toast.warning('No delete handler provided');
      }
    },
    [onDelete, product?.id]
  );

  const renderStars = useCallback((rating: number = 0) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3.5 h-3.5 ${
              star <= Math.round(rating)
                ? 'text-warning-400 fill-current'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
        {rating > 0 && (
          <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400 ml-1">
            ({rating.toFixed(1)})
          </span>
        )}
      </div>
    );
  }, []);

  // ============================================
  // INVALID PRODUCT FALLBACK
  // ============================================

  if (!hasValidProductId) {
    return (
      <div
        className={`card-brand shadow-soft p-4 text-center border-danger-200 dark:border-danger-800 ${className}`}
      >
        <AlertCircle className="w-8 h-8 text-danger-500 mx-auto mb-2" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Invalid product data
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">Product ID is missing</p>
      </div>
    );
  }

  // ============================================
  // HORIZONTAL VARIANT
  // ============================================

  if (orientation === 'horizontal') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className={`card-brand shadow-soft hover:shadow-card-hover transition duration-350 overflow-hidden group animate-fade-in ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex flex-col sm:flex-row">
          <Link
            href={`/shop/${product.id}`}
            className="sm:w-48 flex-shrink-0"
          >
            <div className="aspect-square sm:aspect-auto sm:h-full bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
              {primaryImageValid ? (
                <img
                  src={getValidImage(primaryImage!)}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  onError={() => handleImageError(primaryImage!)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-16 h-16 text-gray-300 dark:text-gray-600" />
                </div>
              )}
              {product.featured && (
                <div className="absolute top-2 left-2 px-2 py-1 bg-warning-500 text-white text-2xs rounded flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" />
                  Featured
                </div>
              )}
              {isOutOfStock && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-danger-600 text-white text-2xs rounded">
                  Out of Stock
                </div>
              )}
              {hasVariants && (
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-secondary-500/80 text-white text-2xs rounded flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  {totalVariantCount}
                  {hasVariantImages && <ImageIcon className="w-3 h-3" />}
                </div>
              )}
              {isInventoryLinked && (
                <div className="absolute top-12 left-2 px-2 py-1 bg-brand-500/80 text-white text-2xs rounded flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                </div>
              )}
              {showWishlist && (
                <div className="absolute top-2 right-2">
                  <WishlistButton productId={product.id} size="sm" />
                </div>
              )}
            </div>
          </Link>

          <div className="flex-1 p-4 flex flex-col">
            <div className="flex-1">
              <Link href={`/shop/${product.id}`}>
                <h3 className="font-semibold text-gray-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition duration-250">
                  {product.name}
                </h3>
              </Link>
              {product.category && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {product.category.name}
                </p>
              )}
              {product.rating && product.rating > 0 && (
                <div className="mt-1">{renderStars(product.rating)}</div>
              )}
              {product.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                  {product.description}
                </p>
              )}

              {hasVariants && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {variants.slice(0, 3).map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={(e) => handleVariantSelect(v.id, e)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs transition duration-250 focus-ring ${
                        selectedVariantId === v.id
                          ? 'bg-brand-600 text-white'
                          : 'bg-secondary-50 dark:bg-secondary-900/20 text-secondary-700 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-900/40'
                      }`}
                    >
                      {v.images?.[0] && !imageErrors[v.images[0]] && (
                        <img
                          src={getValidImage(v.images[0])}
                          alt={v.name}
                          className="w-3 h-3 rounded-full object-cover"
                          onError={() => handleImageError(v.images![0])}
                        />
                      )}
                      {v.name}
                      <span className="text-secondary-400">•</span>
                      <span className="tabular-nums">{formatCurrency(v.price)}</span>
                    </button>
                  ))}
                  {totalVariantCount > 3 && (
                    <span className="text-2xs tabular-nums text-gray-400 dark:text-gray-500">
                      +{totalVariantCount - 3} more
                    </span>
                  )}
                </div>
              )}

              <div className="mt-2 flex flex-wrap gap-1">
                {product.tags?.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-2xs"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xl font-bold tabular-nums text-brand-600 dark:text-brand-400">
                    {formatCurrency(displayPrice)}
                  </span>
                  {selectedVariant &&
                    selectedVariant.price !== product.unitPrice && (
                      <span className="text-xs tabular-nums text-gray-400 dark:text-gray-500 line-through ml-1">
                        {formatCurrency(product.unitPrice)}
                      </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                  {showAddToCart && (
                    <button
                      type="button"
                      onClick={handleAddToCart}
                      disabled={isOutOfStock || addingToCart}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition duration-250 flex items-center gap-1 focus-ring ${
                        isOutOfStock
                          ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                          : 'btn-brand'
                      }`}
                    >
                      {addingToCart ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShoppingCart className="w-4 h-4" />
                      )}
                      <span>{addingToCart ? 'Adding...' : 'Add'}</span>
                    </button>
                  )}
                  {showAdminActions && canEditProduct && (
                    <button
                      type="button"
                      onClick={handleEdit}
                      className="p-1.5 text-warning-600 dark:text-warning-400 hover:bg-warning-50 dark:hover:bg-warning-900/30 rounded-lg transition duration-250 focus-ring"
                      title="Edit"
                      aria-label={`Edit ${product.name}`}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  {showAdminActions && canDeleteProduct && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="p-1.5 text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/30 rounded-lg transition duration-250 focus-ring"
                      title="Delete"
                      aria-label={`Delete ${product.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span
                  className={`px-2 py-0.5 rounded-full text-2xs font-medium text-white ${stockStatus.color}`}
                >
                  {stockStatus.label}
                </span>
                {totalVariantStock > 0 && (
                  <span className="text-2xs tabular-nums text-gray-400 dark:text-gray-500">
                    +{totalVariantStock} variant stock
                  </span>
                )}
                {product.isDigital && (
                  <span className="px-2 py-0.5 bg-secondary-100 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-300 rounded-full text-2xs">
                    Digital
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // ============================================
  // COMPACT VARIANT
  // ============================================

  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.05 }}
        className={`card-brand shadow-soft hover:shadow-card-hover transition duration-350 overflow-hidden group animate-fade-in ${className}`}
      >
        <Link href={`/shop/${product.id}`} className="block">
          <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
            {primaryImageValid ? (
              <img
                src={getValidImage(primaryImage!)}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                onError={() => handleImageError(primaryImage!)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-10 h-10 text-gray-300 dark:text-gray-600" />
              </div>
            )}
            {isOutOfStock && (
              <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-danger-600 text-white text-2xs rounded">
                Out of Stock
              </div>
            )}
            {hasVariants && (
              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-secondary-500/80 text-white text-2xs rounded flex items-center gap-0.5">
                <Layers className="w-2.5 h-2.5" />
                {totalVariantCount}
              </div>
            )}
          </div>
        </Link>
        <div className="p-3">
          <Link href={`/shop/${product.id}`}>
            <h4 className="font-medium text-gray-900 dark:text-white truncate text-sm">
              {product.name}
            </h4>
          </Link>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-bold tabular-nums text-brand-600 dark:text-brand-400">
              {formatCurrency(displayPrice)}
            </span>
            {showWishlist && (
              <WishlistButton productId={product.id} size="sm" />
            )}
          </div>
          {product.rating && product.rating > 0 && (
            <div className="mt-1">{renderStars(product.rating)}</div>
          )}
          {showAddToCart && !isOutOfStock && (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={addingToCart}
              className="mt-2 w-full py-1.5 btn-brand text-xs disabled:opacity-50"
            >
              {addingToCart ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ShoppingCart className="w-3 h-3" />
              )}
              {addingToCart ? 'Adding...' : 'Add to Cart'}
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  // ============================================
  // MINIMAL VARIANT
  // ============================================

  if (variant === 'minimal') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.05 }}
        className={`flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition duration-250 animate-fade-in ${className}`}
      >
        <Link href={`/shop/${product.id}`} className="flex-shrink-0">
          <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden">
            {primaryImageValid ? (
              <img
                src={getValidImage(primaryImage!)}
                alt={product.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={() => handleImageError(primaryImage!)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-6 h-6 text-gray-300 dark:text-gray-600" />
              </div>
            )}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/shop/${product.id}`}>
            <p className="font-medium text-gray-900 dark:text-white truncate text-sm">
              {product.name}
            </p>
          </Link>
          <p className="text-sm font-semibold tabular-nums text-brand-600 dark:text-brand-400">
            {formatCurrency(displayPrice)}
          </p>
          {hasVariants && (
            <p className="text-2xs tabular-nums text-secondary-500 dark:text-secondary-400 flex items-center gap-0.5">
              <Layers className="w-3 h-3" />
              {totalVariantCount} variants
            </p>
          )}
        </div>
        {showWishlist && (
          <WishlistButton productId={product.id} size="sm" />
        )}
        {showAddToCart && !isOutOfStock && (
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={addingToCart}
            className="p-1.5 btn-brand disabled:opacity-50"
            title="Add to cart"
            aria-label={`Add ${product.name} to cart`}
          >
            {addingToCart ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <ShoppingCart className="w-3 h-3" />
            )}
          </button>
        )}
      </motion.div>
    );
  }

  // ============================================
  // FEATURED VARIANT
  // ============================================

  if (variant === 'featured') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.05 }}
        className={`relative card-brand shadow-card overflow-hidden group animate-fade-in ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Link href={`/shop/${product.id}`} className="block">
          <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
            {primaryImageValid ? (
              <img
                src={getValidImage(primaryImage!)}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
                onError={() => handleImageError(primaryImage!)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-24 h-24 text-gray-300 dark:text-gray-600" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="absolute bottom-0 left-0 right-0 p-4 text-white transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
              <h3 className="font-bold text-lg">{product.name}</h3>
              <p className="text-white/80 text-sm tabular-nums">
                {formatCurrency(displayPrice)}
              </p>
              {hasVariants && (
                <p className="text-white/60 text-2xs tabular-nums flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  {totalVariantCount} variants
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                {showAddToCart && (
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={isOutOfStock || addingToCart}
                    className="px-4 py-1.5 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition duration-250 text-sm font-medium disabled:opacity-50 focus-ring"
                  >
                    {addingToCart ? 'Adding...' : 'Add to Cart'}
                  </button>
                )}
                {showQuickView && (
                  <button
                    type="button"
                    onClick={handleQuickView}
                    className="px-4 py-1.5 bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 transition duration-250 text-sm font-medium focus-ring"
                  >
                    Quick View
                  </button>
                )}
              </div>
            </div>
          </div>
        </Link>
        {product.featured && (
          <div className="absolute top-3 left-3 px-2 py-1 bg-warning-500 text-white text-2xs rounded flex items-center gap-1">
            <Star className="w-3 h-3 fill-current" />
            Featured
          </div>
        )}
        {showWishlist && (
          <div className="absolute top-3 right-3">
            <WishlistButton
              productId={product.id}
              size="sm"
              className="shadow-soft"
            />
          </div>
        )}
        {isOutOfStock && (
          <div className="absolute bottom-3 right-3 px-2 py-1 bg-danger-600 text-white text-2xs rounded">
            Out of Stock
          </div>
        )}
      </motion.div>
    );
  }

  // ============================================
  // DEFAULT VARIANT (grid)
  // ============================================

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`card-brand shadow-soft hover:shadow-card-hover transition duration-350 overflow-hidden group animate-fade-in ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image */}
      <Link href={`/shop/${product.id}`} className="block">
        <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
          {primaryImageValid ? (
            <img
              src={getValidImage(primaryImage!)}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              onError={() => handleImageError(primaryImage!)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-16 h-16 text-gray-300 dark:text-gray-600" />
            </div>
          )}

          {/* Badges */}
          {product.featured && (
            <div className="absolute top-2 left-2 px-2 py-1 bg-warning-500 text-white text-2xs rounded flex items-center gap-1">
              <Star className="w-3 h-3 fill-current" />
              Featured
            </div>
          )}
          {isOutOfStock && (
            <div className="absolute top-2 right-2 px-2 py-1 bg-danger-600 text-white text-2xs rounded">
              Out of Stock
            </div>
          )}
          {isLowStock && !isOutOfStock && (
            <div className="absolute top-2 right-2 px-2 py-1 bg-warning-500 text-white text-2xs rounded">
              Low Stock
            </div>
          )}
          {product.isDigital && (
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-secondary-600 text-white text-2xs rounded">
              Digital
            </div>
          )}
          {hasVariants && (
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-secondary-500/80 text-white text-2xs rounded flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {totalVariantCount}
              {hasVariantImages && <ImageIcon className="w-3 h-3" />}
            </div>
          )}
          {isInventoryLinked && (
            <div className="absolute top-12 left-2 px-2 py-1 bg-brand-500/80 text-white text-2xs rounded flex items-center gap-1">
              <Link2 className="w-3 h-3" />
            </div>
          )}

          {showWishlist && (
            <div className="absolute top-2 right-2">
              <WishlistButton productId={product.id} size="sm" />
            </div>
          )}

          {/* Hover actions */}
          <div
            className={`absolute inset-0 bg-black/40 flex items-center justify-center gap-2 transition-opacity duration-300 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {showQuickView && (
              <button
                type="button"
                onClick={handleQuickView}
                className="p-2 bg-white/90 hover:bg-white text-gray-800 rounded-full transition duration-250 focus-ring"
                title="Quick View"
                aria-label={`Quick view ${product.name}`}
              >
                <Eye className="w-5 h-5" />
              </button>
            )}
            {showAddToCart && !isOutOfStock && (
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={addingToCart}
                className="p-2 btn-brand rounded-full disabled:opacity-50"
                title="Add to Cart"
                aria-label={`Add ${product.name} to cart`}
              >
                {addingToCart ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ShoppingCart className="w-5 h-5" />
                )}
              </button>
            )}
          </div>
        </div>
      </Link>

      {/* Content */}
      <div className="p-4">
        <Link href={`/shop/${product.id}`}>
          <h3 className="font-semibold text-gray-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition duration-250 line-clamp-1">
            {product.name}
          </h3>
        </Link>
        {product.category && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {product.category.name}
          </p>
        )}
        {product.rating && product.rating > 0 && (
          <div className="mt-1">{renderStars(product.rating)}</div>
        )}

        {/* Variant quick-select */}
        {hasVariants && totalVariantCount <= 3 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {variants
              .filter((v) => v.isActive)
              .map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={(e) => handleVariantSelect(v.id, e)}
                  className={`px-2 py-0.5 rounded-full text-2xs transition duration-250 focus-ring ${
                    selectedVariantId === v.id
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {v.name}
                </button>
              ))}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between">
          <div>
            <span className="text-lg font-bold tabular-nums text-brand-600 dark:text-brand-400">
              {formatCurrency(displayPrice)}
            </span>
            {selectedVariant &&
              selectedVariant.price !== product.unitPrice && (
                <span className="text-xs tabular-nums text-gray-400 dark:text-gray-500 line-through ml-1">
                  {formatCurrency(product.unitPrice)}
                </span>
              )}
          </div>
          <div className="flex items-center gap-1">
            {showAdminActions && canEditProduct && (
              <button
                type="button"
                onClick={handleEdit}
                className="p-1 text-warning-600 dark:text-warning-400 hover:bg-warning-50 dark:hover:bg-warning-900/30 rounded transition duration-250 focus-ring"
                title="Edit"
                aria-label={`Edit ${product.name}`}
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            {showAdminActions && canDeleteProduct && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-1 text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/30 rounded transition duration-250 focus-ring"
                title="Delete"
                aria-label={`Delete ${product.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <span
            className={`px-2 py-0.5 rounded-full text-2xs font-medium text-white ${stockStatus.color}`}
          >
            {stockStatus.label}
          </span>
          {totalVariantStock > 0 && (
            <span className="text-2xs tabular-nums text-gray-400 dark:text-gray-500">
              +{totalVariantStock} variant stock
            </span>
          )}
        </div>

        {/* Tags */}
        {product.tags && product.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {product.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded text-2xs"
              >
                #{tag}
              </span>
            ))}
            {product.tags.length > 2 && (
              <span className="text-2xs tabular-nums text-gray-400 dark:text-gray-500">
                +{product.tags.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default ProductCard;
