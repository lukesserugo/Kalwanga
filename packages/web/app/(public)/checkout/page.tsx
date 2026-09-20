// D:\Projects\Kalwanga\packages\web\app\(public)\checkout\page.tsx

'use client';

import {
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
  ArrowLeft,
  ShoppingBag,
  CreditCard,
  Shield,
  CheckCircle,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Lock,
  Zap,
  Gift,
  Wallet,
  Banknote,
  QrCode,
  Clock,
  User,
  Building,
  Package,
  Star,
  Tag,
  Check,
  Eye,
  Download,
  Printer,
  Receipt,
} from 'lucide-react';
import { useThemeStore } from '../../../components/stores/themeStore';
import { useAuth } from '../../../hooks/useAuth';
import {
  cartService,
  newIdempotencyKey,
  type Cart as AuthCart,
} from '../../../services/cartService';
import {
  guestCartService,
  type GuestCart,
} from '../../../services/guestCartService';
import { checkoutService } from '../../../services/checkoutService';
import { toast } from '../../../utils/toast-manager';
import { formatCurrency } from '../../../utils/formatters';

// ============================================
// INTERFACES
// ============================================

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
  product?: {
    id: string;
    name: string;
    sku: string;
    images?: Array<string | { url: string; alt?: string | null }>;
  } | null;
  variant?: {
    id: string;
    name: string;
    sku: string;
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
  businessUnitId: string;
  userId: string;
  promotionCode?: string | null;
  promotionDiscount?: number;
  loyaltyPointsUsed?: number;
  loyaltyDiscount?: number;
}

interface CheckoutSummary {
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  loyaltyPointsAvailable: number;
  loyaltyPointsRedeemable: number;
  maxLoyaltyDiscount: number;
  customerId?: string;
}

interface CheckoutResponse {
  sale: {
    id: string;
    receiptNumber: string;
    total: number;
    status: string;
    createdAt: string | Date;
  };
  receipt: {
    receiptNumber: string;
    items: CartItem[];
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    paidAmount: number;
    changeAmount: number;
    customerId?: string;
    businessUnitId: string;
    createdAt: string;
    paymentMethod: string;
  };
  loyaltyPointsEarned: number;
  loyaltyPointsUsed: number;
  changeAmount: number;
}

interface PaymentMethod {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  enabled: boolean;
}

// ============================================
// PAYMENT METHODS
// ============================================

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'CASH',
    name: 'Cash',
    icon: <Banknote className="w-5 h-5" />,
    description: 'Pay with cash',
    enabled: true,
  },
  {
    id: 'CREDIT_CARD',
    name: 'Credit Card',
    icon: <CreditCard className="w-5 h-5" />,
    description: 'Pay with credit card',
    enabled: true,
  },
  {
    id: 'DEBIT_CARD',
    name: 'Debit Card',
    icon: <Wallet className="w-5 h-5" />,
    description: 'Pay with debit card',
    enabled: true,
  },
  {
    id: 'MOBILE_MONEY',
    name: 'Mobile Money',
    icon: <QrCode className="w-5 h-5" />,
    description: 'Pay with mobile money',
    enabled: true,
  },
  {
    id: 'BANK_TRANSFER',
    name: 'Bank Transfer',
    icon: <Building className="w-5 h-5" />,
    description: 'Pay via bank transfer',
    enabled: true,
  },
  {
    id: 'GIFT_CARD',
    name: 'Gift Card',
    icon: <Gift className="w-5 h-5" />,
    description: 'Pay with gift card',
    enabled: true,
  },
];

// ============================================
// NORMALIZATION HELPERS
// ============================================

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
  return {
    id: item.id,
    productId: item.productId,
    quantity: item.quantity ?? 0,
    unitPrice: item.unitPrice ?? 0,
    total: item.total ?? 0,
    product: item.product
      ? {
          id: item.product.id,
          name: item.product.name,
          sku: item.product.sku ?? 'N/A',
          images: toImageArray(item.product.images),
        }
      : null,
    variant: item.variant
      ? {
          id: item.variant.id,
          name: item.variant.name,
          sku: item.variant.sku ?? 'N/A',
        }
      : null,
  };
}

function normalizeCart(
  source: AuthCart | GuestCart | null,
): Cart | null {
  if (!source) return null;

  const anySource = source as any;

  return {
    id: anySource.id ?? '',
    items: Array.isArray(anySource.items)
      ? anySource.items.map(normalizeCartItem)
      : [],
    subtotal: anySource.subtotal ?? 0,
    tax: anySource.tax ?? 0,
    discount: anySource.discount ?? 0,
    total: anySource.total ?? 0,
    customerId: anySource.customerId ?? undefined,
    businessUnitId: anySource.businessUnitId ?? '',
    userId: anySource.userId ?? '',
    promotionCode: anySource.promotionCode ?? null,
    promotionDiscount: anySource.promotionDiscount ?? 0,
    loyaltyPointsUsed: anySource.loyaltyPointsUsed ?? 0,
    loyaltyDiscount: anySource.loyaltyDiscount ?? 0,
  };
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function CheckoutPage() {
  const router = useRouter();
  const { isDark } = useThemeStore();
  const { isAuthenticated, user } = useAuth();

  // State
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [checkoutComplete, setCheckoutComplete] = useState(false);
  const [checkoutResult, setCheckoutResult] =
    useState<CheckoutResponse | null>(null);

  // Customer & Payment
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [applyLoyalty, setApplyLoyalty] = useState(false);
  const [notes, setNotes] = useState('');

  // Summary
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [expandedOrderSummary, setExpandedOrderSummary] = useState(true);

  // Discount & Promotions
  const [promotionCode, setPromotionCode] = useState('');
  const [applyingPromotion, setApplyingPromotion] = useState(false);
  const [promotionApplied, setPromotionApplied] = useState(false);
  const [promotionError, setPromotionError] = useState<string | null>(
    null,
  );

  // Animations
  const [isClient, setIsClient] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  // Idempotency key
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const activeCartService = isAuthenticated
    ? cartService
    : guestCartService;

  // ============================================
  // COMPUTED VALUES
  // ============================================
  //
  // ⚠️ ORDER MATTERS. These must be declared BEFORE any useCallback
  // that closes over them. `handlePlaceOrder` reads `finalTotal`, so
  // `finalTotal` must exist by the time React evaluates the callback
  // body and dependency array.
  //
  // ⚠️ SOURCE OF TRUTH. All numbers shown in the Order Summary come
  // from `cart` — the cart is what the user is looking at and what
  // the backend will read at checkout time. We use `summary` only
  // for loyalty-related values (points available, max discount),
  // which is the only thing it uniquely provides. Mixing values from
  // both sources is what produced inconsistent totals previously.

  const totalItems = useMemo(
    () =>
      cart?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
    [cart?.items],
  );

  const displaySubtotal = cart?.subtotal ?? 0;
  const displayTax = cart?.tax ?? 0;

  // Discount is the sum of everything the cart knows about. Because
  // `promotionDiscount` and `loyaltyDiscount` are sub-fields of the
  // cart row, they may already be included in `cart.discount` OR
  // they may be tracked separately. We treat them as separate to
  // avoid double-counting, and we clamp the total discount at the
  // subtotal so the summary can never show a negative total.
  const displayDiscount = useMemo(() => {
    if (!cart) return 0;
    const base = cart.discount ?? 0;
    const promo = cart.promotionDiscount ?? 0;
    const loyalty = cart.loyaltyDiscount ?? 0;
    const combined = base + promo + loyalty;
    // Never let discounts exceed the subtotal + tax. This keeps the
    // summary honest even if the server sent inconsistent values.
    const ceiling = cart.subtotal + cart.tax;
    return Math.min(combined, ceiling);
  }, [cart]);

  // The loyalty discount the user is *opting into* this checkout. It
  // is NOT yet reflected in `cart.loyaltyDiscount` until checkout
  // happens, so we compute it here from `summary.maxLoyaltyDiscount`
  // and apply it on top of the base total.
  const loyaltyDiscount = useMemo(() => {
    if (!applyLoyalty || !summary) return 0;
    // Cap at 50% of the cart total, matching the backend rule.
    const maxByRule = cart ? cart.total * 0.5 : 0;
    const maxByBalance = summary.maxLoyaltyDiscount || 0;
    return Math.max(0, Math.min(maxByBalance, maxByRule));
  }, [applyLoyalty, summary, cart]);

  // Final total = cart total (which already reflects all persisted
  // discounts) minus the loyalty discount the user is opting into
  // right now. Floored at zero.
  const finalTotal = useMemo(() => {
    const base = cart?.total ?? 0;
    return Math.max(0, base - loyaltyDiscount);
  }, [cart?.total, loyaltyDiscount]);

  // ============================================
  // DATA FETCHING
  // ============================================

  const loadCart = useCallback(async () => {
    try {
      setLoading(true);
      const response = await activeCartService.getCart();
      const normalized = normalizeCart(response);

      if (normalized && normalized.items.length > 0) {
        setCart(normalized);
        setCurrentStep(1);
      } else {
        toast.warning('Your cart is empty');
        router.push('/shop');
      }
    } catch (error: any) {
      console.error('Failed to load cart:', error);
      if (error?.response?.status === 401 && isAuthenticated) {
        router.push(
          `/login?redirect_url=${encodeURIComponent('/checkout')}`,
        );
      } else {
        toast.error('Failed to load cart');
      }
    } finally {
      setLoading(false);
    }
  }, [activeCartService, isAuthenticated, router]);

  const loadSummary = useCallback(async () => {
    if (!cart?.id) return;

    // For guests, we still populate `summary` with a safe stub so the
    // loyalty UI never sees `undefined`. Loyalty points are zero for
    // guests by definition, so the stub is correct, not a fallback.
    if (!isAuthenticated) {
      setSummary({
        items: cart.items,
        subtotal: cart.subtotal,
        tax: cart.tax,
        discount: cart.discount,
        total: cart.total,
        loyaltyPointsAvailable: 0,
        loyaltyPointsRedeemable: 0,
        maxLoyaltyDiscount: 0,
      });
      return;
    }

    try {
      const summaryData =
        await checkoutService.getCheckoutSummaryByCart(cart.id);
      setSummary({
        items: cart.items,
        subtotal: summaryData.subtotal ?? cart.subtotal,
        tax: summaryData.tax ?? cart.tax,
        discount: summaryData.discount ?? cart.discount,
        total: summaryData.total ?? cart.total,
        loyaltyPointsAvailable: summaryData.loyaltyPoints ?? 0,
        loyaltyPointsRedeemable: Math.floor(
          (summaryData.loyaltyPoints ?? 0) / 10,
        ),
        maxLoyaltyDiscount: Math.min(
          (summaryData.loyaltyPoints ?? 0) * 0.1,
          cart.total * 0.5,
        ),
        customerId: summaryData.customer?.id ?? undefined,
      });
    } catch (err) {
      console.warn('Failed to load checkout summary:', err);
      // Non-fatal: fall back to a loyalty-less stub so the page still
      // works. The cart itself remains the source of truth for totals.
      setSummary({
        items: cart.items,
        subtotal: cart.subtotal,
        tax: cart.tax,
        discount: cart.discount,
        total: cart.total,
        loyaltyPointsAvailable: 0,
        loyaltyPointsRedeemable: 0,
        maxLoyaltyDiscount: 0,
      });
    }
  }, [cart, isAuthenticated]);

  useEffect(() => {
    if (!isClient) return;
    loadCart();
  }, [isClient, loadCart]);

  useEffect(() => {
    if (isAuthenticated && user) {
      setCustomerName(
        `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      );
      setCustomerEmail(user.email || '');
      setCustomerPhone(user.phoneNumber || '');
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (cart?.id && cart.items?.length > 0) {
      loadSummary();
    }
  }, [cart?.id, cart?.items?.length, loadSummary]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleApplyPromotion = useCallback(async () => {
    if (!promotionCode.trim()) {
      toast.error('Please enter a promotion code');
      return;
    }

    if (!isAuthenticated) {
      const message =
        'Please sign in to apply a promotion code.';
      setPromotionError(message);
      toast.error(message);
      return;
    }

    setApplyingPromotion(true);
    setPromotionError(null);

    try {
      const updated = await cartService.applyPromotion(
        promotionCode.trim(),
      );
      const normalized = normalizeCart(updated);
      if (normalized) setCart(normalized);
      setPromotionApplied(true);
      toast.success('Promotion applied successfully');
      await loadSummary();
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Invalid promotion code';
      setPromotionError(message);
      toast.error(message);
    } finally {
      setApplyingPromotion(false);
    }
  }, [promotionCode, isAuthenticated, loadSummary]);

  const handlePlaceOrder = useCallback(async () => {
    if (!cart || !cart.items || cart.items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    if (!customerEmail.trim()) {
      toast.error('Please enter your email address');
      setShowCustomerForm(true);
      return;
    }

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = newIdempotencyKey();
    }

    setProcessing(true);

    try {
      const payload = {
        cartId: cart.id,
        customerId: cart.customerId || undefined,
        paymentMethod: paymentMethod as any,
        paidAmount: finalTotal,
        notes: notes.trim() || undefined,
        applyLoyaltyPoints: applyLoyalty,
        businessUnitId: cart.businessUnitId,
        customerEmail: customerEmail.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerName: customerName.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        idempotencyKey: idempotencyKeyRef.current,
      };

      const result = await checkoutService.processCheckout(payload);

      setCheckoutResult(result as unknown as CheckoutResponse);
      setCheckoutComplete(true);

      toast.success('Order placed successfully!');

      window.dispatchEvent(new CustomEvent('cart:updated'));

      setTimeout(() => {
        setShowReceipt(true);
      }, 1000);
    } catch (error: any) {
      console.error('Checkout failed:', error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Checkout failed';
      toast.error(errorMessage);

      if (Array.isArray(error?.response?.data?.errors)) {
        const errorList = error.response.data.errors
          .map((e: any) => `${e.field}: ${e.message}`)
          .join(', ');
        toast.error(`Validation errors: ${errorList}`);
      }
    } finally {
      setProcessing(false);
    }
  }, [
    cart,
    paymentMethod,
    finalTotal,
    notes,
    applyLoyalty,
    customerEmail,
    customerPhone,
    customerName,
    customerAddress,
  ]);

  const handlePrintReceipt = useCallback(() => {
    if (!checkoutResult) return;
    window.print();
  }, [checkoutResult]);

  const handleDownloadReceipt = useCallback(() => {
    if (!checkoutResult) return;

    const receiptData = {
      receiptNumber: checkoutResult.receipt.receiptNumber,
      date: new Date(
        checkoutResult.receipt.createdAt,
      ).toLocaleString(),
      items: checkoutResult.receipt.items,
      subtotal: checkoutResult.receipt.subtotal,
      tax: checkoutResult.receipt.tax,
      discount: checkoutResult.receipt.discount,
      total: checkoutResult.receipt.total,
      paidAmount: checkoutResult.receipt.paidAmount,
      changeAmount: checkoutResult.receipt.changeAmount,
      paymentMethod: checkoutResult.receipt.paymentMethod,
    };

    const blob = new Blob([JSON.stringify(receiptData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${checkoutResult.receipt.receiptNumber}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Receipt downloaded');
  }, [checkoutResult]);

  const handleContinueShopping = useCallback(() => {
    router.push('/shop');
  }, [router]);

  const handleViewOrders = useCallback(() => {
    router.push('/account/orders');
  }, [router]);

  // ============================================
  // RENDER — Loading
  // ============================================

  if (!isClient || loading) {
    return (
      <div
        className={`min-h-screen ${
          isDark ? 'dark bg-gray-950' : 'bg-gray-50'
        } transition-colors duration-300`}
      >
        <div className="max-w-7xl mx-auto px-4 pt-24 md:pt-28 pb-12">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 dark:border-orange-400 mx-auto" />
              <p className="mt-4 text-gray-600 dark:text-gray-400">
                Loading checkout...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER — Empty
  // ============================================

  if (!cart || !cart.items || cart.items.length === 0) {
    return (
      <div
        className={`min-h-screen ${
          isDark ? 'dark bg-gray-950' : 'bg-gray-50'
        } transition-colors duration-300`}
      >
        <div className="max-w-7xl mx-auto px-4 pt-24 md:pt-28 pb-12">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="w-12 h-12 text-gray-400 dark:text-gray-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Your Cart is Empty
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Add some items to your cart before checking out.
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg transition-colors shadow-md"
            >
              <ArrowLeft className="w-4 h-4" />
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER — Order Complete
  // ============================================

  if (checkoutComplete && checkoutResult) {
    return (
      <div
        className={`min-h-screen ${
          isDark ? 'dark bg-gray-950' : 'bg-gray-50'
        } transition-colors duration-300`}
      >
        <div className="max-w-4xl mx-auto px-4 pt-24 md:pt-28 pb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-center text-white">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  delay: 0.3,
                  type: 'spring',
                  stiffness: 200,
                }}
                className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <CheckCircle className="w-10 h-10" />
              </motion.div>
              <h2 className="text-2xl font-bold">
                Order Placed Successfully!
              </h2>
              <p className="text-green-100 mt-2">
                Thank you for your order
              </p>
              <div className="mt-4 inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg">
                <Receipt className="w-4 h-4" />
                <span className="font-mono">
                  {checkoutResult.receipt.receiptNumber}
                </span>
              </div>
            </div>

            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Order Total
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(checkoutResult.receipt.total)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Payment Method
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                    {checkoutResult.receipt.paymentMethod
                      .toLowerCase()
                      .replace(/_/g, ' ')}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Loyalty Points
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {checkoutResult.loyaltyPointsEarned > 0
                      ? `+${checkoutResult.loyaltyPointsEarned}`
                      : '0'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Change
                  </p>
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {formatCurrency(checkoutResult.changeAmount || 0)}
                  </p>
                </div>
              </div>
            </div>

            {showReceipt && (
              <div className="p-6" id="receipt">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Order Details
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePrintReceipt}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Print receipt"
                    >
                      <Printer className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleDownloadReceipt}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Download receipt"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {checkoutResult.receipt.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 py-3 border-b border-gray-100 dark:border-gray-700"
                    >
                      <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                        {item.product?.images?.[0] ? (
                          <img
                            src={
                              typeof item.product.images[0] === 'string'
                                ? item.product.images[0]
                                : (item.product.images[0] as { url: string }).url
                            }
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-full h-full p-2 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {item.product?.name || 'Product'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {item.quantity} ×{' '}
                          {formatCurrency(item.unitPrice)}
                          {item.variant && (
                            <span className="ml-2 text-xs">
                              ({item.variant.name})
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      Subtotal
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {formatCurrency(
                        checkoutResult.receipt.subtotal,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      Tax
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {formatCurrency(checkoutResult.receipt.tax)}
                    </span>
                  </div>
                  {checkoutResult.receipt.discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                      <span>Discount</span>
                      <span>
                        -
                        {formatCurrency(
                          checkoutResult.receipt.discount,
                        )}
                      </span>
                    </div>
                  )}
                  {checkoutResult.loyaltyPointsUsed > 0 && (
                    <div className="flex justify-between text-sm text-orange-600 dark:text-orange-400">
                      <span>Loyalty Points Used</span>
                      <span>
                        -
                        {formatCurrency(
                          checkoutResult.loyaltyPointsUsed * 0.1,
                        )}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-gray-900 dark:text-white">
                      Total
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {formatCurrency(checkoutResult.receipt.total)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                    <span>Paid</span>
                    <span>
                      {formatCurrency(
                        checkoutResult.receipt.paidAmount,
                      )}
                    </span>
                  </div>
                  {checkoutResult.changeAmount > 0 && (
                    <div className="flex justify-between text-sm text-orange-500 dark:text-orange-400">
                      <span>Change</span>
                      <span>
                        {formatCurrency(checkoutResult.changeAmount)}
                      </span>
                    </div>
                  )}
                </div>

                {checkoutResult.loyaltyPointsEarned > 0 && (
                  <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                      <Star className="w-5 h-5 fill-current" />
                      <span className="font-medium">
                        You earned{' '}
                        {checkoutResult.loyaltyPointsEarned} loyalty
                        points!
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="p-6 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-3">
              <button
                onClick={handleContinueShopping}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md"
              >
                <ShoppingBag className="w-5 h-5" />
                Continue Shopping
              </button>
              {isAuthenticated && (
                <button
                  onClick={handleViewOrders}
                  className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2 text-gray-700 dark:text-gray-300"
                >
                  <Eye className="w-5 h-5" />
                  View Orders
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER — Checkout Form
  // ============================================

  return (
    <div
      className={`min-h-screen ${
        isDark ? 'dark bg-gray-950' : 'bg-gray-50'
      } transition-colors duration-300`}
    >
      <div className="max-w-7xl mx-auto px-4 pt-24 md:pt-28 pb-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/cart')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Back to cart"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Lock className="w-8 h-8 text-orange-500" />
                Secure Checkout
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {totalItems} items • Total: {formatCurrency(finalTotal)}
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <Shield className="w-4 h-4" />
              Secure
            </span>
            <span className="text-gray-300">|</span>
            <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
              <Clock className="w-4 h-4" />
              Fast Checkout
            </span>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-8 flex-wrap">
          {[
            { step: 1, label: 'Review Cart', icon: ShoppingBag },
            { step: 2, label: 'Customer Info', icon: User },
            { step: 3, label: 'Payment', icon: CreditCard },
          ].map(({ step, label, icon: Icon }) => (
            <div key={step} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  currentStep >= step
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    currentStep >= step
                      ? 'text-orange-600 dark:text-orange-400'
                      : ''
                  }`}
                />
                <span className="hidden sm:inline text-sm font-medium">
                  {label}
                </span>
              </div>
              {step < 3 && (
                <ChevronRight
                  className={`w-4 h-4 mx-1 ${
                    currentStep > step
                      ? 'text-orange-400'
                      : 'text-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Information */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <button
                onClick={() => setShowCustomerForm(!showCustomerForm)}
                className="w-full flex items-center justify-between"
                aria-expanded={showCustomerForm}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <User className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Customer Information
                    </h3>
                    {customerEmail && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {customerEmail}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    showCustomerForm ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <AnimatePresence>
                {showCustomerForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) =>
                            setCustomerName(e.target.value)
                          }
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Email Address{' '}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={customerEmail}
                          onChange={(e) =>
                            setCustomerEmail(e.target.value)
                          }
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="john@example.com"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={(e) =>
                            setCustomerPhone(e.target.value)
                          }
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="+1234567890"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Delivery Address
                        </label>
                        <input
                          type="text"
                          value={customerAddress}
                          onChange={(e) =>
                            setCustomerAddress(e.target.value)
                          }
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="123 Main St, City, Country"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Payment Method */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <button
                onClick={() =>
                  setShowPaymentDetails(!showPaymentDetails)
                }
                className="w-full flex items-center justify-between"
                aria-expanded={showPaymentDetails}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <CreditCard className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Payment Method
                    </h3>
                    {paymentMethod && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                        {paymentMethod
                          .toLowerCase()
                          .replace(/_/g, ' ')}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    showPaymentDetails ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <AnimatePresence>
                {showPaymentDetails && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {PAYMENT_METHODS.filter((m) => m.enabled).map(
                        (method) => (
                          <button
                            key={method.id}
                            onClick={() =>
                              setPaymentMethod(method.id)
                            }
                            className={`p-4 border-2 rounded-xl text-center transition-all ${
                              paymentMethod === method.id
                                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-md'
                                : 'border-gray-200 dark:border-gray-600 hover:border-orange-300 dark:hover:border-orange-500'
                            }`}
                          >
                            <div className="flex flex-col items-center gap-2">
                              {method.icon}
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {method.name}
                              </span>
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                {method.description}
                              </span>
                            </div>
                          </button>
                        ),
                      )}
                    </div>

                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {paymentMethod === 'CASH' &&
                          'Pay with cash at the counter. Please have exact change ready.'}
                        {paymentMethod === 'CREDIT_CARD' &&
                          'Pay securely with your credit card. We accept Visa, Mastercard, and American Express.'}
                        {paymentMethod === 'DEBIT_CARD' &&
                          'Pay with your debit card. Your bank may require authentication.'}
                        {paymentMethod === 'MOBILE_MONEY' &&
                          'Pay with mobile money. We support M-Pesa, Tigo Pesa, and Airtel Money.'}
                        {paymentMethod === 'BANK_TRANSFER' &&
                          'Pay via bank transfer. You will receive bank details after order confirmation.'}
                        {paymentMethod === 'GIFT_CARD' &&
                          'Pay with a gift card. Enter your gift card code at checkout.'}
                      </p>
                    </div>

                    {isAuthenticated &&
                      summary &&
                      summary.loyaltyPointsAvailable > 0 && (
                        <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={applyLoyalty}
                              onChange={(e) =>
                                setApplyLoyalty(e.target.checked)
                              }
                              className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                            />
                            <div>
                              <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                                Apply loyalty points (
                                {summary.loyaltyPointsAvailable}{' '}
                                available)
                              </p>
                              <p className="text-xs text-orange-600 dark:text-orange-400">
                                Max discount:{' '}
                                {formatCurrency(
                                  summary.maxLoyaltyDiscount || 0,
                                )}
                              </p>
                            </div>
                          </label>
                          {applyLoyalty && loyaltyDiscount > 0 && (
                            <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <p className="text-sm text-green-700 dark:text-green-300">
                                💰 Loyalty discount:{' '}
                                {formatCurrency(loyaltyDiscount)}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Promotions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Promotion Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promotionCode}
                      onChange={(e) => {
                        setPromotionCode(e.target.value.toUpperCase());
                        setPromotionError(null);
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white uppercase"
                      placeholder="Enter promo code"
                      disabled={promotionApplied || !isAuthenticated}
                    />
                    <button
                      onClick={handleApplyPromotion}
                      disabled={
                        applyingPromotion ||
                        promotionApplied ||
                        !promotionCode.trim() ||
                        !isAuthenticated
                      }
                      className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2 shadow-md"
                    >
                      {applyingPromotion ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : promotionApplied ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Tag className="w-4 h-4" />
                      )}
                      {promotionApplied ? 'Applied' : 'Apply'}
                    </button>
                  </div>
                  {!isAuthenticated && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Sign in to apply a promotion code.
                    </p>
                  )}
                  {promotionError && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {promotionError}
                    </p>
                  )}
                  {promotionApplied && (
                    <p className="mt-1 text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      Promotion applied successfully!
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Order Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="Any special requests or delivery instructions..."
              />
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <button
                  onClick={() =>
                    setExpandedOrderSummary(!expandedOrderSummary)
                  }
                  className="w-full flex items-center justify-between mb-4"
                  aria-expanded={expandedOrderSummary}
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-orange-500" />
                    Order Summary
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                      ({totalItems} items)
                    </span>
                  </h3>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedOrderSummary ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {expandedOrderSummary && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      {/* Items */}
                      <div className="max-h-60 overflow-y-auto space-y-3 mb-4">
                        {cart.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3"
                          >
                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                              {item.product?.images?.[0] ? (
                                <img
                                  src={
                                    typeof item.product.images[0] === 'string'
                                      ? item.product.images[0]
                                      : (item.product.images[0] as { url: string }).url
                                  }
                                  alt={item.product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-full h-full p-1.5 text-gray-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {item.product?.name || 'Product'}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {item.quantity} ×{' '}
                                {formatCurrency(item.unitPrice)}
                                {item.variant && (
                                  <span className="ml-1">
                                    ({item.variant.name})
                                  </span>
                                )}
                              </p>
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {formatCurrency(item.total)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Totals — sourced entirely from `cart` so they
                          reconcile with the item rows above. `summary`
                          is used only for loyalty points, never for
                          the money lines. */}
                      <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">
                            Subtotal
                          </span>
                          <span className="text-gray-900 dark:text-white">
                            {formatCurrency(displaySubtotal)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">
                            Tax
                          </span>
                          <span className="text-gray-900 dark:text-white">
                            {formatCurrency(displayTax)}
                          </span>
                        </div>
                        {displayDiscount > 0 && (
                          <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                            <span>Discount</span>
                            <span>
                              -{formatCurrency(displayDiscount)}
                            </span>
                          </div>
                        )}
                        {applyLoyalty && loyaltyDiscount > 0 && (
                          <div className="flex justify-between text-sm text-orange-600 dark:text-orange-400">
                            <span>Loyalty Discount</span>
                            <span>
                              -{formatCurrency(loyaltyDiscount)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-gray-900 dark:text-white">
                            Total
                          </span>
                          <span className="text-gray-900 dark:text-white">
                            {formatCurrency(finalTotal)}
                          </span>
                        </div>
                      </div>

                      {/* Trust Badges */}
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Shield className="w-3 h-3 text-green-500" />
                            Secure Checkout
                          </span>
                          <span className="flex items-center gap-1">
                            <Lock className="w-3 h-3 text-orange-500" />
                            Encrypted
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-orange-500" />
                            Fast Delivery
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Place Order Button */}
                <button
                  onClick={handlePlaceOrder}
                  disabled={processing || cart.items.length === 0}
                  className="w-full mt-4 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Place Order - {formatCurrency(finalTotal)}
                    </>
                  )}
                </button>

                <p className="mt-3 text-xs text-center text-gray-500 dark:text-gray-400">
                  By placing your order, you agree to our Terms of
                  Service and Privacy Policy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
