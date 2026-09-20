// D:\Projects\Kalwanga\packages\web\app\cart\page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart,
  RefreshCw,
  AlertCircle,
  X,
  Truck,
  Shield,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { api } from '../../../services/api';
import { toast } from '../../../utils/toast-manager';
import { formatCurrency } from '../../../utils/formatters';
import {
  cartService,
  type Cart as AuthCart,
  type CartItem as AuthCartItem,
} from '../../../services/cartService';
import {
  guestCartService,
  type GuestCart,
} from '../../../services/guestCartService';
import { useAuth } from '../../../hooks/useAuth';
import {
  CartSummary,
  CartSkeleton,
  EmptyCart,
  CartDiscountInput,
  CartPromotionInput,
  CartLoyaltyPoints,
  CartCustomerSelector,
  CartNotes,
  CartActions,
} from '../../../components/cart';

// ============================================
// TYPES
// ============================================

interface LoyaltyResponse {
  points: number;
  available: number;
  used: number;
  totalEarned: number;
}

/**
 * The page's cart item shape. Structurally a superset of
 * `cartService.CartItem` so the normalized cart is assignable to
 * whatever `<CartSummary>` expects without a cast.
 *
 * Required fields mirrored from cartService.CartItem:
 *   - id, productId, quantity, unitPrice, total
 *   - product: { id, name, sku, unitPrice, images }
 *   - availableStock, isInStock
 *
 * Optional / nullable fields also mirrored:
 *   - variantId?: string | null
 *   - variant?: { id, name, sku, price, attributes }
 *   - notes?, discount?
 */
interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
  availableStock: number;
  isInStock: boolean;
  notes?: string;
  discount?: number;

  product: {
    id: string;
    name: string;
    sku: string;
    unitPrice: number;
    images: string[];
  };

  variantId?: string | null;
  variant?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    attributes: any;
  } | null;
}

/**
 * The page's cart shape. Structurally a superset of `cartService.Cart`.
 */
interface Cart {
  id: string;
  items: CartItem[];

  subtotal: number;
  tax: number;
  discount: number;
  total: number;

  customerId?: string;
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  } | null;

  businessUnitId: string;
  userId: string;

  notes?: string;
  status: 'ACTIVE' | 'SAVED' | 'CHECKED_OUT' | 'ABANDONED';
  itemCount: number;

  discountType?: 'PERCENTAGE' | 'FIXED';
  promotionCode?: string | null;
  promotionDiscount?: number;
  loyaltyPointsUsed?: number;
  loyaltyDiscount?: number;

  createdAt: string;
  updatedAt: string;
}

// ============================================
// NORMALIZATION HELPERS
// ============================================
//
// Both services return different shapes for the same logical cart.
// These widen them into the page's own `Cart` type so the UI never
// sees the union, and every required field of `cartService.CartItem`
// and `cartService.Cart` is populated.

function toImageArray(input: unknown): string[] {
  if (!input) return [];
  if (typeof input === 'string') return [input];
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => {
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object' && 'url' in v) {
        const url = (v as { url?: unknown }).url;
        return typeof url === 'string' ? url : null;
      }
      return null;
    })
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function normalizeCartItem(item: any): CartItem {
  const quantity = item.quantity ?? 0;
  const unitPrice = item.unitPrice ?? 0;

  const inventory = Array.isArray(item.product?.inventory)
    ? item.product.inventory[0]
    : item.product?.inventory;

  const availableStock =
    typeof item.availableStock === 'number'
      ? item.availableStock
      : inventory
      ? Math.max(
          0,
          (inventory.quantity ?? 0) - (inventory.reserved ?? 0),
        )
      : 0;

  const isInStock =
    typeof item.isInStock === 'boolean'
      ? item.isInStock
      : availableStock > 0;

  // `product.unitPrice` is required by cartService.CartItem. Fall back
  // to the cart item's own unitPrice when the nested product doesn't
  // carry one (guest carts omit it).
  const productUnitPrice =
    typeof item.product?.unitPrice === 'number'
      ? item.product.unitPrice
      : unitPrice;

  // `product.images` is required (non-optional) by cartService.CartItem.
  // Always return an array, even if empty.
  const productImages = toImageArray(item.product?.images);

  // `variant.attributes` and `variant.price` are required by
  // cartService.CartItem when a variant is present. Fill in safe
  // defaults.
  const variant =
    item.variant && typeof item.variant === 'object'
      ? {
          id: String(item.variant.id),
          name: String(item.variant.name ?? 'Variant'),
          sku: String(item.variant.sku ?? 'N/A'),
          price:
            typeof item.variant.price === 'number'
              ? item.variant.price
              : unitPrice,
          attributes:
            item.variant.attributes &&
            typeof item.variant.attributes === 'object'
              ? item.variant.attributes
              : {},
        }
      : null;

  return {
    id: item.id,
    productId: item.productId,
    quantity,
    unitPrice,
    total: item.total ?? quantity * unitPrice,
    availableStock,
    isInStock,
    notes: item.notes ?? undefined,
    discount:
      typeof item.discount === 'number' ? item.discount : undefined,
    product: {
      id: item.product?.id ?? item.productId,
      name: item.product?.name ?? 'Product',
      sku: item.product?.sku ?? 'N/A',
      unitPrice: productUnitPrice,
      images: productImages,
    },
    // `variantId` is optional in cartService.CartItem, but the type
    // accepts `string | null`. Preserve the source's value so callers
    // can read it if they need to.
    variantId:
      typeof item.variantId === 'string'
        ? item.variantId
        : item.variantId === null
        ? null
        : undefined,
    variant,
  };
}

function normalizeCart(
  source: AuthCart | GuestCart | null,
): Cart | null {
  if (!source) return null;

  const anySource = source as any;

  const items: CartItem[] = Array.isArray(anySource.items)
    ? anySource.items.map(normalizeCartItem)
    : [];

  const itemCount =
    typeof anySource.itemCount === 'number'
      ? anySource.itemCount
      : items.reduce((sum, i) => sum + i.quantity, 0);

  const rawStatus = String(anySource.status ?? 'ACTIVE').toUpperCase();
  const status: Cart['status'] =
    rawStatus === 'SAVED' ||
    rawStatus === 'CHECKED_OUT' ||
    rawStatus === 'ABANDONED'
      ? rawStatus
      : 'ACTIVE';

  // `customer.email` and `customer.phoneNumber` are required by
  // cartService.Cart. Fill in empty strings when the source doesn't
  // provide them so the type matches.
  const customer =
    anySource.customer && typeof anySource.customer === 'object'
      ? {
          id: String(anySource.customer.id),
          firstName: String(anySource.customer.firstName ?? ''),
          lastName: String(anySource.customer.lastName ?? ''),
          email: String(anySource.customer.email ?? ''),
          phoneNumber: String(anySource.customer.phoneNumber ?? ''),
        }
      : null;

  const now = new Date().toISOString();

  return {
    id: anySource.id ?? '',
    items,
    subtotal: anySource.subtotal ?? 0,
    tax: anySource.tax ?? 0,
    discount: anySource.discount ?? 0,
    total: anySource.total ?? 0,
    customerId: anySource.customerId ?? undefined,
    customer,
    businessUnitId: anySource.businessUnitId ?? '',
    userId: anySource.userId ?? '',
    status,
    notes: anySource.notes ?? undefined,
    promotionCode: anySource.promotionCode ?? null,
    promotionDiscount: anySource.promotionDiscount ?? 0,
    loyaltyPointsUsed: anySource.loyaltyPointsUsed ?? 0,
    loyaltyDiscount: anySource.loyaltyDiscount ?? 0,
    itemCount,
    discountType:
      anySource.discountType === 'PERCENTAGE' ||
      anySource.discountType === 'FIXED'
        ? anySource.discountType
        : undefined,
    // `createdAt` and `updatedAt` are required by cartService.Cart.
    createdAt:
      typeof anySource.createdAt === 'string' ? anySource.createdAt : now,
    updatedAt:
      typeof anySource.updatedAt === 'string' ? anySource.updatedAt : now,
  };
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function CartPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | undefined>(
    undefined,
  );
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const activeCartService = isAuthenticated ? cartService : guestCartService;

  // ============================================
  // FETCH CART
  // ============================================

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const raw = await activeCartService.getCart();
      const cartData = normalizeCart(raw);

      if (!cartData) {
        setCart(null);
        return;
      }

      setCart(cartData);

      if (cartData.customerId) {
        setCustomerId(cartData.customerId);
        try {
          const response = await api.get<LoyaltyResponse>(
            `/customers/${cartData.customerId}/loyalty`,
          );
          if (response && response.points !== undefined) {
            setLoyaltyPoints(response.points);
          }
        } catch (error) {
          console.warn('Failed to fetch loyalty points:', error);
        }
      }
    } catch (error: any) {
      console.error('❌ Failed to fetch cart:', error);
      if (error?.response?.status === 401 && isAuthenticated) {
        router.push('/login?redirect_url=/cart');
      } else {
        setError(error?.message || 'Failed to load cart');
        toast.error('Failed to load cart');
      }
    } finally {
      setLoading(false);
    }
  }, [activeCartService, isAuthenticated, router]);

  // ============================================
  // CART OPERATIONS
  // ============================================

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      if (quantity < 1) return;

      setUpdating(itemId);
      try {
        const raw = isAuthenticated
          ? await cartService.updateItemQuantity(itemId, quantity)
          : await guestCartService.updateItem(itemId, quantity);
        const updated = normalizeCart(raw);
        setCart(updated);
      } catch (error: any) {
        console.error('❌ Failed to update quantity:', error);
        toast.error(error?.message || 'Failed to update quantity');
        await fetchCart();
      } finally {
        setUpdating(null);
      }
    },
    [isAuthenticated, fetchCart],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      setUpdating(itemId);
      try {
        const raw = await activeCartService.removeItem(itemId);
        const updated = normalizeCart(raw);
        setCart(updated);
        toast.success('Item removed from cart');
      } catch (error: any) {
        console.error('❌ Failed to remove item:', error);
        toast.error(error?.message || 'Failed to remove item');
        await fetchCart();
      } finally {
        setUpdating(null);
      }
    },
    [activeCartService, fetchCart],
  );

  const clearCart = useCallback(async () => {
    if (
      !window.confirm(
        'Are you sure you want to clear your entire cart?',
      )
    )
      return;

    try {
      setClearing(true);
      if (isAuthenticated) {
        const raw = await cartService.clearCart();
        const updated = normalizeCart(raw);
        if (updated) {
          setCart(updated);
        } else {
          await fetchCart();
        }
      } else {
        await guestCartService.clearCart();
        await fetchCart();
      }
      toast.success('Cart cleared');
    } catch (error: any) {
      console.error('❌ Failed to clear cart:', error);
      toast.error(error?.message || 'Failed to clear cart');
    } finally {
      setClearing(false);
    }
  }, [isAuthenticated, fetchCart]);

  const syncCart = useCallback(async () => {
    if (!isAuthenticated) {
      toast.info('Sign in to sync your cart with inventory');
      return;
    }

    try {
      setSyncing(true);
      const result = await cartService.syncCart();
      if (result.valid) {
        toast.success('Cart is in sync with inventory');
      } else {
        toast.warning(`Inventory issues: ${result.issues.join(', ')}`);
      }
      await fetchCart();
    } catch (error: any) {
      console.error('❌ Failed to sync cart:', error);
      toast.error(error?.message || 'Failed to sync cart');
    } finally {
      setSyncing(false);
    }
  }, [isAuthenticated, fetchCart]);

  const saveCartForLater = useCallback(async () => {
    if (!isAuthenticated) {
      toast.info('Sign in to save your cart for later');
      return;
    }

    try {
      setSaving(true);
      const raw = await cartService.saveCartForLater();
      const updated = normalizeCart(raw);
      setCart(updated);
      toast.success('Cart saved for later');
    } catch (error: any) {
      console.error('❌ Failed to save cart:', error);
      toast.error(error?.message || 'Failed to save cart');
    } finally {
      setSaving(false);
    }
  }, [isAuthenticated]);

  const applyDiscount = useCallback(
    async (code: string) => {
      if (!isAuthenticated) {
        toast.info('Sign in to apply a discount');
        throw new Error('Authentication required');
      }

      try {
        const discountValue = parseFloat(code);
        if (!isNaN(discountValue) && discountValue > 0) {
          const raw = await cartService.applyDiscount(
            discountValue,
            'FIXED',
          );
          const updated = normalizeCart(raw);
          setCart(updated);
          toast.success('Discount applied successfully');
        } else {
          const raw = await cartService.applyPromotion(code);
          const updated = normalizeCart(raw);
          setCart(updated);
          toast.success('Promotion applied successfully');
        }
      } catch (error: any) {
        console.error('❌ Failed to apply discount:', error);
        toast.error(error?.message || 'Failed to apply discount');
        throw error;
      }
    },
    [isAuthenticated],
  );

  const applyPromotion = useCallback(
    async (code: string) => {
      if (!isAuthenticated) {
        toast.info('Sign in to apply a promotion');
        throw new Error('Authentication required');
      }

      try {
        const raw = await cartService.applyPromotion(code);
        const updated = normalizeCart(raw);
        setCart(updated);
        toast.success('Promotion applied successfully');
      } catch (error: any) {
        console.error('❌ Failed to apply promotion:', error);
        toast.error(error?.message || 'Failed to apply promotion');
        throw error;
      }
    },
    [isAuthenticated],
  );

  const applyLoyaltyPoints = useCallback(
    async (points: number) => {
      if (!isAuthenticated) {
        toast.info('Sign in to use loyalty points');
        return;
      }
      if (!customerId) {
        toast.error('Please associate a customer with this cart');
        return;
      }
      try {
        const raw = await cartService.applyLoyaltyPoints(
          customerId,
          points,
        );
        const updated = normalizeCart(raw);
        setCart(updated);
        setLoyaltyPoints((prev) => prev - points);
        toast.success(`${points} loyalty points applied`);
      } catch (error: any) {
        console.error('❌ Failed to apply loyalty points:', error);
        toast.error(
          error?.message || 'Failed to apply loyalty points',
        );
        throw error;
      }
    },
    [customerId, isAuthenticated],
  );

  const associateCustomer = useCallback(
    async (customerId: string) => {
      if (!isAuthenticated) {
        toast.info('Sign in to associate a customer');
        return;
      }

      try {
        const raw = await cartService.associateCustomer(customerId);
        const updated = normalizeCart(raw);
        setCart(updated);
        setCustomerId(customerId);
        toast.success('Customer associated with cart');
        try {
          const response = await api.get<LoyaltyResponse>(
            `/customers/${customerId}/loyalty`,
          );
          if (response && response.points !== undefined) {
            setLoyaltyPoints(response.points);
          }
        } catch (error) {
          console.warn('Failed to fetch loyalty points:', error);
        }
      } catch (error: any) {
        console.error('❌ Failed to associate customer:', error);
        toast.error(error?.message || 'Failed to associate customer');
        throw error;
      }
    },
    [isAuthenticated],
  );

  const updateCartNotes = useCallback(
    async (notes: string) => {
      if (!isAuthenticated) {
        setCart((prev) =>
          prev ? { ...prev, notes } : prev,
        );
        return;
      }

      try {
        const raw = await cartService.updateCartNotes(notes);
        const updated = normalizeCart(raw);
        setCart(updated);
      } catch (error: any) {
        console.error('❌ Failed to update notes:', error);
        toast.error(error?.message || 'Failed to update notes');
        throw error;
      }
    },
    [isAuthenticated],
  );

  const proceedToCheckout = useCallback(() => {
    if (!cart || cart.items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    if (!isAuthenticated) {
      router.push(
        `/login?redirect_url=${encodeURIComponent('/checkout')}`,
      );
      return;
    }

    router.push('/checkout');
  }, [cart, isAuthenticated, router]);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // ============================================
  // HELPERS
  // ============================================

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE:
        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      SAVED:
        'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      CHECKED_OUT:
        'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
      ABANDONED:
        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      ACTIVE: 'Active',
      SAVED: 'Saved',
      CHECKED_OUT: 'Checked Out',
      ABANDONED: 'Abandoned',
    };
    return labels[status] || status;
  };

  // ============================================
  // RENDER — loading
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-24 md:pt-28 pb-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <ShoppingCart className="w-7 h-7 text-orange-500" />
              Your Cart
            </h1>
          </div>
          <CartSkeleton />
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER — empty
  // ============================================

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-24 md:pt-28 pb-12">
        <div className="max-w-3xl mx-auto px-4">
          <EmptyCart
            title="Your cart is empty"
            description="Browse our products and add items to your cart."
            actionLabel="Start Shopping"
            actionHref="/shop"
          />
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER — main
  // ============================================

  const itemCount = cart.items.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-24 md:pt-28 pb-8 sm:pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <ShoppingCart className="w-7 h-7 sm:w-8 sm:h-8 text-orange-500" />
              Your Cart
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                ({itemCount} {itemCount === 1 ? 'item' : 'items'})
              </span>
            </h1>
            {cart.customer && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Customer: {cart.customer.firstName}{' '}
                {cart.customer.lastName}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                  cart.status,
                )}`}
              >
                {getStatusLabel(cart.status)}
              </span>
              {cart.promotionCode && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full text-xs font-medium">
                  <Sparkles className="w-3 h-3" />
                  {cart.promotionCode}
                </span>
              )}
              {!isAuthenticated && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  Guest cart
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchCart();
                toast.success('Cart refreshed');
              }}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              aria-label="Refresh cart"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <CartActions
              onClear={clearCart}
              onSync={syncCart}
              onSaveForLater={saveCartForLater}
              isSyncing={syncing}
              isClearing={clearing}
              isSaving={saving}
              hasItems={cart.items.length > 0}
              disabled={loading}
            />
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800 dark:text-red-200">
                {error}
              </p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 dark:text-red-400 p-1"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {cart.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
                  >
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0 overflow-hidden">
                      {item.product.images?.[0] ? (
                        <img
                          src={item.product.images[0]}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {item.product.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        SKU: {item.product.sku}
                      </p>
                      {item.variant && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Variant: {item.variant.name}
                        </p>
                      )}
                      <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                        {formatCurrency(item.unitPrice)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity - 1)
                        }
                        disabled={
                          updating === item.id || item.quantity <= 1
                        }
                        className="w-8 h-8 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-gray-900 dark:text-white">
                        {updating === item.id ? '...' : item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                        disabled={
                          updating === item.id ||
                          (item.availableStock > 0 &&
                            item.quantity >= item.availableStock)
                        }
                        className="w-8 h-8 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right min-w-[80px]">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(item.total)}
                      </p>
                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={updating === item.id}
                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cart Extras — hidden for guests when the feature
                requires an authenticated customer. */}
            {isAuthenticated && (
              <div className="space-y-4">
                <CartCustomerSelector
                  selectedCustomerId={customerId}
                  onCustomerSelected={associateCustomer}
                  onCustomerCleared={() => {
                    setCustomerId(undefined);
                    setLoyaltyPoints(0);
                  }}
                  disabled={loading}
                />

                {customerId && (
                  <CartLoyaltyPoints
                    customerId={customerId}
                    onPointsApplied={() => {
                      fetchCart();
                    }}
                    disabled={loading}
                  />
                )}
              </div>
            )}

            <div className="space-y-4">
              <CartDiscountInput
                onDiscountApplied={() => fetchCart()}
                disabled={loading}
              />

              <CartPromotionInput
                onPromotionApplied={() => fetchCart()}
                disabled={loading}
              />

              <CartNotes
                initialNotes={cart.notes}
                onNotesUpdated={updateCartNotes}
                disabled={loading}
              />
            </div>
          </div>

          {/* Cart Summary */}
          <div className="lg:col-span-1">
            <CartSummary
              cart={cart}
              onApplyDiscount={applyDiscount}
              onApplyPromotion={applyPromotion}
              onApplyLoyalty={applyLoyaltyPoints}
              onCheckout={proceedToCheckout}
              loading={loading}
              customerId={customerId}
              loyaltyPoints={loyaltyPoints}
            />
          </div>
        </div>

        {/* Free Shipping Progress */}
        <div className="mt-8 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
          <div className="flex items-center justify-between text-sm flex-wrap gap-2">
            <span className="text-orange-700 dark:text-orange-300 flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Free shipping on orders over $50
            </span>
            <span className="font-medium text-orange-700 dark:text-orange-300">
              ${Math.max(0, 50 - cart.subtotal).toFixed(2)} away
            </span>
          </div>
          <div className="mt-2 w-full bg-orange-200 dark:bg-orange-800 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(
                  (cart.subtotal / 50) * 100,
                  100,
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-500" />
            Secure Checkout
          </span>
          <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">
            |
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-orange-500" />
            Free Shipping
          </span>
          <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">
            |
          </span>
          <span className="inline-flex items-center gap-1.5">
            <RotateCcw className="w-4 h-4 text-orange-500" />
            30-Day Returns
          </span>
          <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">
            |
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-orange-500" />
            Loyalty Points Available
          </span>
        </div>
      </div>
    </div>
  );
}
