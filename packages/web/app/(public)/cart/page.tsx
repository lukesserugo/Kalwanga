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
  Package,
} from 'lucide-react';
import { api } from '../../../services/api';
import { toast } from '../../../utils/toast-manager';
import { formatCurrency } from '../../../utils/formatters';
import {
  cartService,
  type Cart as AuthCart,
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
 * The page's cart shape. Structurally a superset of `cartService.Cart`
 * — every required field is present, and the extra fields used only by
 * this page are declared locally.
 *
 * NOTE: `CartSummary` and the other cart components consume
 * `cartService.Cart` from `types/cart.ts`. This page augments it with
 * a couple of display-only fields (`discount` on the item, nullable
 * `variantId`, `discount` on the cart). Those extras are declared here
 * rather than in the shared types to keep the shared types honest.
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
    attributes: Record<string, unknown>;
  } | null;
}

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
// Both `cartService` and `guestCartService` return slightly different
// shapes. These widen them into the page's own `Cart` type so the UI
// never sees a union.

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

  const productUnitPrice =
    typeof item.product?.unitPrice === 'number'
      ? item.product.unitPrice
      : unitPrice;

  const productImages = toImageArray(item.product?.images);

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
    createdAt:
      typeof anySource.createdAt === 'string' ? anySource.createdAt : now,
    updatedAt:
      typeof anySource.updatedAt === 'string' ? anySource.updatedAt : now,
  };
}

/**
 * The `api` wrapper may or may not unwrap `response.data`. Accept both.
 */
function unwrapApiResponse<T>(response: unknown): T | null {
  if (response == null) return null;
  if (typeof response === 'object' && 'data' in (response as any)) {
    const inner = (response as any).data;
    if (inner !== undefined && inner !== null) return inner as T;
  }
  return response as T;
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Default free-shipping threshold. Ideally this comes from
 * `CartSettings.freeShippingThreshold` on the backend — the banner on
 * this page is a UX cue, not a contract. Fetching settings on every
 * cart view is expensive, so we use a static fallback.
 */
const DEFAULT_FREE_SHIPPING_THRESHOLD = 50;

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

  const activeCartService = isAuthenticated
    ? cartService
    : guestCartService;

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
        // Prefer the loyalty balance from the cart's customer when the
        // backend includes it; otherwise fall back to a dedicated fetch.
        const cartLoyalty = (cartData.customer as any)?.loyaltyPoints;
        if (typeof cartLoyalty === 'number') {
          setLoyaltyPoints(cartLoyalty);
        } else {
          try {
            const response = await api.get(
              `/customers/${cartData.customerId}/loyalty`,
            );
            const payload = unwrapApiResponse<LoyaltyResponse>(response);
            if (payload && typeof payload.points === 'number') {
              setLoyaltyPoints(payload.points);
            }
          } catch (err) {
            console.warn('Failed to fetch loyalty points:', err);
          }
        }
      } else {
        setCustomerId(undefined);
        setLoyaltyPoints(0);
      }
    } catch (err: any) {
      console.error('❌ Failed to fetch cart:', err);
      if (err?.response?.status === 401 && isAuthenticated) {
        router.push('/login?redirect_url=/cart');
      } else {
        setError(err?.message || 'Failed to load cart');
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
          : await guestCartService.updateItemQuantity(itemId, quantity);
        const updated = normalizeCart(raw);
        setCart(updated);
      } catch (err: any) {
        console.error('❌ Failed to update quantity:', err);
        toast.error(err?.message || 'Failed to update quantity');
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
      } catch (err: any) {
        console.error('❌ Failed to remove item:', err);
        toast.error(err?.message || 'Failed to remove item');
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
    } catch (err: any) {
      console.error('❌ Failed to clear cart:', err);
      toast.error(err?.message || 'Failed to clear cart');
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
        toast.warning(
          `Inventory issues: ${result.issues.join(', ')}`,
        );
      }
      await fetchCart();
    } catch (err: any) {
      console.error('❌ Failed to sync cart:', err);
      toast.error(err?.message || 'Failed to sync cart');
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
    } catch (err: any) {
      console.error('❌ Failed to save cart:', err);
      toast.error(err?.message || 'Failed to save cart');
    } finally {
      setSaving(false);
    }
  }, [isAuthenticated]);

  /**
   * Apply a numeric discount. The caller must know whether the value
   * is a percentage or a fixed amount — this replaces the previous
   * `parseFloat(code)` heuristic that misclassified promo codes like
   * `"1234"` as fixed discounts.
   */
  const applyDiscountValue = useCallback(
    async (value: number, type: 'PERCENTAGE' | 'FIXED') => {
      if (!isAuthenticated) {
        toast.info('Sign in to apply a discount');
        throw new Error('Authentication required');
      }

      try {
        const raw = await cartService.applyDiscount(value, type);
        const updated = normalizeCart(raw);
        setCart(updated);
      } catch (err: any) {
        console.error('❌ Failed to apply discount:', err);
        toast.error(err?.message || 'Failed to apply discount');
        throw err;
      }
    },
    [isAuthenticated],
  );

  /**
   * Apply a promotion by code. The backend resolves the code.
   */
  const applyPromotionCode = useCallback(
    async (code: string) => {
      if (!isAuthenticated) {
        toast.info('Sign in to apply a promotion');
        throw new Error('Authentication required');
      }

      try {
        const raw = await cartService.applyPromotion(code);
        const updated = normalizeCart(raw);
        setCart(updated);
      } catch (err: any) {
        console.error('❌ Failed to apply promotion:', err);
        toast.error(err?.message || 'Failed to apply promotion');
        throw err;
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

        // Prefer the authoritative balance from the cart payload; fall
        // back to an optimistic decrement only when it's absent.
        const serverBalance = (updated?.customer as any)?.loyaltyPoints;
        if (typeof serverBalance === 'number') {
          setLoyaltyPoints(serverBalance);
        } else {
          setLoyaltyPoints((prev) => Math.max(0, prev - points));
        }

        toast.success(`${points} loyalty points applied`);
      } catch (err: any) {
        console.error('❌ Failed to apply loyalty points:', err);
        toast.error(err?.message || 'Failed to apply loyalty points');
        throw err;
      }
    },
    [customerId, isAuthenticated],
  );

  const associateCustomer = useCallback(
    async (newCustomerId: string) => {
      if (!isAuthenticated) {
        toast.info('Sign in to associate a customer');
        return;
      }

      try {
        const raw = await cartService.associateCustomer(newCustomerId);
        const updated = normalizeCart(raw);
        setCart(updated);
        setCustomerId(newCustomerId);

        try {
          const response = await api.get(
            `/customers/${newCustomerId}/loyalty`,
          );
          const payload = unwrapApiResponse<LoyaltyResponse>(response);
          if (payload && typeof payload.points === 'number') {
            setLoyaltyPoints(payload.points);
          }
        } catch (err) {
          console.warn('Failed to fetch loyalty points:', err);
        }
      } catch (err: any) {
        console.error('❌ Failed to associate customer:', err);
        toast.error(err?.message || 'Failed to associate customer');
        throw err;
      }
    },
    [isAuthenticated],
  );

  const updateCartNotes = useCallback(
    async (notes: string) => {
      if (!isAuthenticated) {
        setCart((prev) => (prev ? { ...prev, notes } : prev));
        return;
      }

      try {
        const raw = await cartService.updateCartNotes(notes);
        const updated = normalizeCart(raw);
        setCart(updated);
      } catch (err: any) {
        console.error('❌ Failed to update notes:', err);
        toast.error(err?.message || 'Failed to update notes');
        throw err;
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
    void fetchCart();
  }, [fetchCart]);

  // ============================================
  // HELPERS
  // ============================================

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE:
        'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      SAVED:
        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
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

  const shippingThreshold = DEFAULT_FREE_SHIPPING_THRESHOLD;
  const amountToFreeShipping = Math.max(
    0,
    shippingThreshold - cart.subtotal,
  );
  const freeShippingProgress = Math.min(
    (cart.subtotal / shippingThreshold) * 100,
    100,
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
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 tabular-nums">
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
              type="button"
              onClick={() => {
                void fetchCart();
                toast.success('Cart refreshed');
              }}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
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
              type="button"
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 dark:text-red-400 p-1 focus-ring rounded"
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
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Package className="w-6 h-6" />
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
                      <p className="text-sm font-medium text-orange-600 dark:text-orange-400 tabular-nums">
                        {formatCurrency(item.unitPrice)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.id, item.quantity - 1)
                        }
                        disabled={
                          updating === item.id || item.quantity <= 1
                        }
                        className="w-8 h-8 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-ring"
                        aria-label="Decrease quantity"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-gray-900 dark:text-white tabular-nums">
                        {updating === item.id ? '...' : item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                        disabled={
                          updating === item.id ||
                          (item.availableStock > 0 &&
                            item.quantity >= item.availableStock)
                        }
                        className="w-8 h-8 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-ring"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right min-w-[80px]">
                      <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                        {formatCurrency(item.total)}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={updating === item.id}
                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs transition-colors focus-ring rounded"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cart Extras — the individual components return null for
                guests, so this outer gate is cosmetic. */}
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
                      void fetchCart();
                    }}
                    disabled={loading}
                  />
                )}
              </div>
            )}

            <div className="space-y-4">
              <CartDiscountInput
                onDiscountApplied={() => {
                  void fetchCart();
                }}
                disabled={loading}
              />

              <CartPromotionInput
                onPromotionApplied={() => {
                  void fetchCart();
                }}
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
              cart={cart as any}
              onApplyDiscountValue={applyDiscountValue}
              onApplyPromotion={applyPromotionCode}
              onApplyLoyalty={applyLoyaltyPoints}
              onCheckout={proceedToCheckout}
              loading={loading}
              customerId={customerId}
              loyaltyPoints={loyaltyPoints}
              isAuthenticated={isAuthenticated}
            />
          </div>
        </div>

        {/* Free Shipping Progress */}
        <div className="mt-8 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
          <div className="flex items-center justify-between text-sm flex-wrap gap-2">
            <span className="text-orange-700 dark:text-orange-300 flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Free shipping on orders over{' '}
              {formatCurrency(shippingThreshold)}
            </span>
            <span className="font-medium text-orange-700 dark:text-orange-300 tabular-nums">
              {amountToFreeShipping > 0
                ? `${formatCurrency(amountToFreeShipping)} away`
                : 'Free shipping unlocked'}
            </span>
          </div>
          <div className="mt-2 w-full bg-orange-200 dark:bg-orange-800 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-500"
              style={{
                width: `${freeShippingProgress}%`,
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
