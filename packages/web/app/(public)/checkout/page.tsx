// D:\Projects\Kalwanga\packages\web\app\(public)\checkout\page.tsx

'use client';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Clock,
  User,
  Package,
  Tag,
  Check,
  Smartphone,
  RefreshCw,
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
import {
  checkoutService,
  isIdempotencyConflict,
  type CheckoutSummary,
  type NextAction,
  type PaymentMethod,
} from '../../../services/checkoutService';
import { toast } from '../../../utils/toast-manager';
import { formatCurrency } from '../../../utils/formatters';

import PaymentMethodSelector from '../../../components/payments/PaymentMethodSelector';
import PaymentForm from '../../../components/payments/PaymentForm';
import { PhoneNumberInput } from '../../../components/payments/PhoneNumberInput';
import {
  MobileMoneyProviderPicker,
  validatePhoneForProvider,
  type MobileProvider,
} from '../../../components/payments/MobileMoneyProviderPicker';

// ============================================
// LOCAL SHAPES
// ============================================
//
// `PaymentMethodSelector` exports only the component (as a default
// export). It does not export a matching type. So we declare the
// shape of an entry in its `availableMethods` prop here. Every field
// matches exactly what the checkout page builds below.

interface SelectorPaymentMethod {
  id: string;
  name: string;
  code: string;
  icon: React.ReactNode;
  description: string;
  enabled: boolean;
  requiresDetails?: boolean;
  providerName?: string;
  recommended?: boolean;
  popular?: boolean;
}

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
  product: {
    id: string;
    name: string;
    sku: string;
    images: string[];
  } | null;
  variant: { id: string; name: string; sku: string } | null;
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
}

interface CompletedSale {
  id: string;
  receiptNumber: string;
  total: number;
}

// ============================================
// NORMALIZATION
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
    total: item.total ?? (item.quantity ?? 0) * (item.unitPrice ?? 0),
    product: item.product
      ? {
          id: item.product.id,
          name: item.product.name ?? 'Product',
          sku: item.product.sku ?? 'N/A',
          images: toImageArray(item.product.images),
        }
      : null,
    variant: item.variant
      ? {
          id: item.variant.id,
          name: item.variant.name ?? 'Variant',
          sku: item.variant.sku ?? 'N/A',
        }
      : null,
  };
}

function normalizeCart(source: AuthCart | GuestCart | null): Cart | null {
  if (!source) return null;
  const s = source as any;
  return {
    id: s.id ?? '',
    items: Array.isArray(s.items) ? s.items.map(normalizeCartItem) : [],
    subtotal: s.subtotal ?? 0,
    tax: s.tax ?? 0,
    discount: s.discount ?? 0,
    total: s.total ?? 0,
    customerId: s.customerId ?? undefined,
    businessUnitId: s.businessUnitId ?? '',
    userId: s.userId ?? '',
    promotionCode: s.promotionCode ?? null,
    promotionDiscount: s.promotionDiscount ?? 0,
  };
}

// ============================================
// PAGE
// ============================================

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDark } = useThemeStore();
  const { isAuthenticated, user } = useAuth();

  // ── Cart
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Customer
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  // ── Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [mobileProvider, setMobileProvider] =
    useState<MobileProvider>('MPESA');

  // ── Summary
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);

  // ── UI
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(true);
  const [expandedOrderSummary, setExpandedOrderSummary] = useState(true);
  const [processing, setProcessing] = useState(false);

  // ── Terminal states
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(
    null,
  );

  // ── Online-flow
  const [awaitingRedirect, setAwaitingRedirect] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [confirmationSaleId, setConfirmationSaleId] = useState<string | null>(
    null,
  );
  const [confirmationMessage, setConfirmationMessage] = useState(
    'Confirming your payment…',
  );

  const [cardFlowActive, setCardFlowActive] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(
    null,
  );

  // ── Promotions
  const [promotionCode, setPromotionCode] = useState('');
  const [applyingPromotion, setApplyingPromotion] = useState(false);
  const [promotionApplied, setPromotionApplied] = useState(false);
  const [promotionError, setPromotionError] = useState<string | null>(null);

  // ── Refs
  const idempotencyKeyRef = useRef<string | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const cardFormRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef(true);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  const activeCartService = isAuthenticated ? cartService : guestCartService;

  // ============================================
  // DERIVED
  // ============================================

  const totalItems = useMemo(
    () => cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
    [cart?.items],
  );

  const displaySubtotal = cart?.subtotal ?? 0;
  const displayTax = cart?.tax ?? 0;
  const displayDiscount = cart?.discount ?? 0;

  const finalTotal = useMemo(
    () => Math.max(0, cart?.total ?? 0),
    [cart?.total],
  );

  const isMobileMethod = useMemo(
    () => paymentMethod === 'MOBILE_MONEY' || paymentMethod === 'MPESA',
    [paymentMethod],
  );

  const isCardMethod = useMemo(
    () =>
      paymentMethod === 'CREDIT_CARD' ||
      paymentMethod === 'DEBIT_CARD' ||
      paymentMethod === 'SQUARE',
    [paymentMethod],
  );

  const buildReturnUrl = useCallback(
    (): string => `${window.location.origin}/checkout?source=paypal`,
    [],
  );

  const buildCancelUrl = useCallback(
    (): string => `${window.location.origin}/checkout?cancel=1`,
    [],
  );

  // ============================================
  // CARD-FORM AUTO-SCROLL
  // ============================================

  useEffect(() => {
    if (!cardFlowActive) return;
    if (!cardFormRef.current) return;

    const t = window.setTimeout(() => {
      cardFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 200);

    return () => window.clearTimeout(t);
  }, [cardFlowActive]);

  // ============================================
  // DATA FETCHING
  // ============================================

  const loadCart = useCallback(async () => {
    try {
      setLoading(true);
      const response = await activeCartService.getCart();
      if (!isMountedRef.current) return;

      const normalized = normalizeCart(response);
      if (normalized && normalized.items.length > 0) {
        setCart(normalized);
      } else {
        toast.warning('Your cart is empty');
        router.push('/shop');
      }
    } catch (error: any) {
      if (!isMountedRef.current) return;
      if (error?.response?.status === 401 && isAuthenticated) {
        router.push(`/login?redirect_url=${encodeURIComponent('/checkout')}`);
      } else {
        toast.error(error?.message || 'Failed to load cart');
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [activeCartService, isAuthenticated, router]);

  const loadSummary = useCallback(async () => {
    if (!cart?.id) return;

    const stub: CheckoutSummary = {
      items: cart.items.map((i) => ({
        productId: i.productId,
        variantId: i.variant?.id,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.total,
      })),
      subtotal: cart.subtotal,
      tax: cart.tax,
      discount: cart.discount,
      total: cart.total,
      loyaltyPointsAvailable: 0,
      loyaltyPointsRedeemable: 0,
      maxLoyaltyDiscount: 0,
    };

    if (!isAuthenticated) {
      if (isMountedRef.current) setSummary(stub);
      return;
    }

    try {
      const data = await checkoutService.getCheckoutSummaryByCart(cart.id);
      if (isMountedRef.current) setSummary(data);
    } catch {
      if (isMountedRef.current) setSummary(stub);
    }
  }, [cart, isAuthenticated]);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

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
    if (cart?.id && cart.items.length > 0) {
      void loadSummary();
    }
  }, [cart?.id, cart?.items.length, loadSummary]);

  // ============================================
  // AUTO-OPEN CUSTOMER FORM
  // ============================================

  useEffect(() => {
    const needsForm =
      isMobileMethod ||
      isCardMethod ||
      paymentMethod === 'PAYPAL' ||
      paymentMethod === 'FLUTTERWAVE' ||
      !isAuthenticated;

    if (needsForm) setShowCustomerForm(true);
  }, [paymentMethod, isMobileMethod, isCardMethod, isAuthenticated]);

  useEffect(() => {
    if (!isMobileMethod) return;
    if (!showCustomerForm) return;
    if (!phoneInputRef.current) return;

    const t = window.setTimeout(() => {
      phoneInputRef.current?.focus();
      phoneInputRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 250);

    return () => window.clearTimeout(t);
  }, [isMobileMethod, showCustomerForm]);

  // ============================================
  // IDEMPOTENCY KEY INVALIDATION
  // ============================================

  useEffect(() => {
    idempotencyKeyRef.current = null;
  }, [customerPhone, customerEmail, paymentMethod, mobileProvider]);

  // ============================================
  // SALE POLLING
  // ============================================

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startPollingSale = useCallback(
    (saleId: string, initialMessage?: string) => {
      stopPolling();
      setAwaitingConfirmation(true);
      setConfirmationSaleId(saleId);
      setConfirmationMessage(initialMessage || 'Confirming your payment…');

      const startTime = Date.now();
      const MAX_WAIT_MS = 3 * 60 * 1000;
      const INTERVAL_MS = 2500;

      pollIntervalRef.current = setInterval(async () => {
        if (!isMountedRef.current) {
          stopPolling();
          return;
        }

        try {
          const sale = await checkoutService.getCheckoutById(saleId);
          if (!isMountedRef.current) return;

          if (sale.status === 'COMPLETED') {
            stopPolling();
            setAwaitingConfirmation(false);

            setCompletedSale({
              id: sale.id,
              receiptNumber: sale.receiptNumber ?? `RCP-${Date.now()}`,
              total: sale.total ?? finalTotal,
            });

            window.dispatchEvent(new CustomEvent('cart:updated'));
            toast.success('Payment confirmed!');
            return;
          }

          if (
            sale.status === 'CANCELLED' ||
            sale.status === 'VOID' ||
            sale.status === 'REFUNDED'
          ) {
            stopPolling();
            setAwaitingConfirmation(false);
            toast.error(
              'Payment was not completed. Please try again or use a different method.',
            );
            idempotencyKeyRef.current = null;
            return;
          }

          if (Date.now() - startTime > 30_000) {
            setConfirmationMessage(
              'Still waiting for confirmation from your bank…',
            );
          }
        } catch (err) {
          console.warn('Poll error:', err);
        }

        if (Date.now() - startTime > MAX_WAIT_MS) {
          stopPolling();
          setAwaitingConfirmation(false);
          toast.info(
            'Still processing. You will receive an email once payment is confirmed.',
          );
        }
      }, INTERVAL_MS);
    },
    [stopPolling, finalTotal],
  );

  // ============================================
  // REDIRECT RETURN-LEG
  // ============================================

  useEffect(() => {
    const returnToken =
      searchParams.get('token') ||
      searchParams.get('reference') ||
      searchParams.get('tx_ref') ||
      searchParams.get('paymentId') ||
      searchParams.get('saleId');

    const cancelled = searchParams.get('cancel');
    const isRedirectCallback =
      searchParams.get('source') === 'paypal' ||
      searchParams.has('token') ||
      searchParams.has('tx_ref') ||
      searchParams.has('reference');

    const stashedSaleId = (() => {
      try {
        return sessionStorage.getItem('pending_checkout_sale_id');
      } catch {
        return null;
      }
    })();

    if (cancelled) {
      try {
        sessionStorage.removeItem('pending_checkout_sale_id');
      } catch {
        /* ignore */
      }
      toast.error('Payment was cancelled.');
      return;
    }

    if (returnToken || stashedSaleId) {
      const saleId = stashedSaleId || returnToken!;
      startPollingSale(saleId, 'Confirming with the payment provider…');
      return;
    }

    if (isRedirectCallback) {
      // eslint-disable-next-line no-console
      console.warn(
        '[checkout] Redirect callback detected but no sale id in URL or session storage.',
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================
  // HANDLERS
  // ============================================

  const handleApplyPromotion = useCallback(async () => {
    const code = promotionCode.trim();
    if (!code) {
      toast.error('Please enter a promotion code');
      return;
    }
    if (!isAuthenticated) {
      setPromotionError('Please sign in to apply a promotion code.');
      return;
    }

    setApplyingPromotion(true);
    setPromotionError(null);

    try {
      const updated = await cartService.applyPromotion(code);
      if (!isMountedRef.current) return;
      const normalized = normalizeCart(updated);
      if (normalized) setCart(normalized);
      setPromotionApplied(true);
      toast.success('Promotion applied successfully');
      await loadSummary();
    } catch (error: any) {
      if (!isMountedRef.current) return;
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Invalid promotion code';
      setPromotionError(message);
      toast.error(message);
    } finally {
      if (isMountedRef.current) setApplyingPromotion(false);
    }
  }, [promotionCode, isAuthenticated, loadSummary]);

  const validateBeforeSubmit = useCallback((): boolean => {
    if (!cart || cart.items.length === 0) {
      toast.error('Your cart is empty');
      return false;
    }

    if (!isAuthenticated && !customerEmail.trim()) {
      toast.error('Please enter your email address');
      setShowCustomerForm(true);
      return false;
    }

    if (isMobileMethod) {
      if (!customerPhone.trim()) {
        toast.error('Phone number is required for mobile money');
        setShowCustomerForm(true);
        window.setTimeout(() => phoneInputRef.current?.focus(), 300);
        return false;
      }
      const phoneError = validatePhoneForProvider(
        customerPhone,
        mobileProvider,
      );
      if (phoneError) {
        toast.error(phoneError);
        setShowCustomerForm(true);
        window.setTimeout(() => phoneInputRef.current?.focus(), 300);
        return false;
      }
    }

    return true;
  }, [
    cart,
    isAuthenticated,
    customerEmail,
    customerPhone,
    isMobileMethod,
    mobileProvider,
  ]);

  const handlePlaceOrder = useCallback(async () => {
    if (!validateBeforeSubmit()) return;
    if (!cart) return;

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = newIdempotencyKey();
    }

    if (isCardMethod) {
      setProcessing(true);
      try {
        const result = await checkoutService.processOnlineCheckout({
          cartId: cart.id,
          customerId: cart.customerId || undefined,
          paymentMethod,
          applyLoyaltyPoints: false,
          businessUnitId: cart.businessUnitId,
          customerEmail: customerEmail.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          customerName: customerName.trim() || undefined,
          customerAddress: customerAddress.trim() || undefined,
          idempotencyKey: idempotencyKeyRef.current,
          returnUrl: buildReturnUrl(),
          cancelUrl: buildCancelUrl(),
          promotionCode: cart.promotionCode ?? undefined,
          promotionDiscount: cart.promotionDiscount ?? undefined,
        });

        if (!isMountedRef.current) return;

        if (result.nextAction.type !== 'CONFIRM_STRIPE') {
          setProcessing(false);
          toast.error('Unexpected response from Stripe.');
          return;
        }

        setStripeClientSecret(result.nextAction.clientSecret);
        setCardFlowActive(true);
        setProcessing(false);
      } catch (error: any) {
        if (!isMountedRef.current) return;
        console.error('Card setup failed:', error);
        setProcessing(false);
        toast.error(
          error?.response?.data?.message ||
            error?.message ||
            'Could not start card payment.',
        );
      }
      return;
    }

    setProcessing(true);

    try {
      const result = await checkoutService.processOnlineCheckout({
        cartId: cart.id,
        customerId: cart.customerId || undefined,
        paymentMethod,
        applyLoyaltyPoints: false,
        businessUnitId: cart.businessUnitId,
        customerEmail: customerEmail.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerName: customerName.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        idempotencyKey: idempotencyKeyRef.current,
        returnUrl: buildReturnUrl(),
        cancelUrl: buildCancelUrl(),
        promotionCode: cart.promotionCode ?? undefined,
        promotionDiscount: cart.promotionDiscount ?? undefined,
      });

      if (!isMountedRef.current) return;

      const action: NextAction = result.nextAction;

      switch (action.type) {
        case 'CONFIRM_STRIPE': {
          setProcessing(false);
          toast.error(
            'Unexpected Stripe confirmation request for a non-card method. Please contact support.',
          );
          return;
        }

        case 'REDIRECT': {
          setAwaitingRedirect(true);
          try {
            sessionStorage.setItem(
              'pending_checkout_sale_id',
              result.sale.id,
            );
          } catch {
            /* ignore */
          }
          window.setTimeout(() => {
            window.location.href = action.url;
          }, 150);
          return;
        }

        case 'AWAIT_STK_PUSH': {
          setProcessing(false);
          startPollingSale(
            result.sale.id,
            action.message ||
              'Waiting for you to authorize the payment on your phone…',
          );
          return;
        }

        case 'OFFLINE': {
          setProcessing(false);
          setCompletedSale({
            id: result.sale.id,
            receiptNumber:
              result.sale.receiptNumber ?? `RCP-${Date.now()}`,
            total: result.sale.total ?? finalTotal,
          });
          window.dispatchEvent(new CustomEvent('cart:updated'));
          if (!isAuthenticated) {
            try {
              await guestCartService.clearCart();
            } catch {
              /* non-fatal */
            }
          }
          toast.success('Order placed — awaiting confirmation');
          return;
        }

        case 'NONE': {
          setProcessing(false);
          startPollingSale(result.sale.id, 'Finalizing your payment…');
          return;
        }

        default: {
          const _exhaustive: never = action;
          void _exhaustive;
          setProcessing(false);
          toast.error('Unexpected response from payment gateway');
        }
      }
    } catch (error: any) {
      if (!isMountedRef.current) return;
      console.error('Checkout failed:', error);

      if (isIdempotencyConflict(error)) {
        idempotencyKeyRef.current = null;
        toast.info(
          'Your previous attempt was cancelled. Please try again.',
        );
        setProcessing(false);
        return;
      }

      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Checkout failed';
      toast.error(errorMessage);
      setProcessing(false);
    }
  }, [
    validateBeforeSubmit,
    cart,
    paymentMethod,
    customerEmail,
    customerPhone,
    customerName,
    customerAddress,
    isAuthenticated,
    isCardMethod,
    isMobileMethod,
    mobileProvider,
    startPollingSale,
    finalTotal,
    buildReturnUrl,
    buildCancelUrl,
  ]);

  const handleCancelWaiting = useCallback(() => {
    stopPolling();
    setAwaitingConfirmation(false);
    setConfirmationSaleId(null);
    idempotencyKeyRef.current = null;
    try {
      sessionStorage.removeItem('pending_checkout_sale_id');
    } catch {
      /* ignore */
    }
  }, [stopPolling]);

  // ============================================
  // RENDER — Loading
  // ============================================

  if (loading) {
    return (
      <div
        className={`min-h-screen ${isDark ? 'dark bg-gray-950' : 'bg-gray-50'}`}
      >
        <div className="max-w-7xl mx-auto px-4 pt-24 md:pt-28 pb-12">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-brand-600 dark:text-brand-400 mx-auto" />
              <p className="mt-4 text-gray-600 dark:text-gray-400">
                Loading checkout…
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

  if (!cart || cart.items.length === 0) {
    return (
      <div
        className={`min-h-screen ${isDark ? 'dark bg-gray-950' : 'bg-gray-50'}`}
      >
        <div className="max-w-7xl mx-auto px-4 pt-24 md:pt-28 pb-12">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-200 dark:border-gray-700 p-12 text-center">
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
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-gradient hover:shadow-brand-lg text-white rounded-lg transition-all shadow-brand"
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
  // RENDER — Redirect overlay
  // ============================================

  if (awaitingRedirect) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDark ? 'dark bg-gray-950' : 'bg-gray-50'
        }`}
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card border border-gray-200 dark:border-gray-700 p-10 text-center max-w-md">
          <Loader2 className="w-12 h-12 animate-spin text-brand-500 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
            Redirecting to payment provider…
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            You will be returned here once payment is complete.
          </p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER — Awaiting confirmation
  // ============================================

  if (awaitingConfirmation) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDark ? 'dark bg-gray-950' : 'bg-gray-50'
        }`}
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-card border border-gray-200 dark:border-gray-700 p-10 text-center max-w-md"
        >
          <div className="w-16 h-16 bg-warning-100 dark:bg-warning-900/30 rounded-full flex items-center justify-center mx-auto">
            {isMobileMethod ? (
              <Smartphone className="w-8 h-8 text-warning-600 dark:text-warning-400" />
            ) : (
              <RefreshCw className="w-8 h-8 text-warning-600 dark:text-warning-400 animate-spin" />
            )}
          </div>
          <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
            {isMobileMethod ? 'Check your phone' : 'Confirming payment'}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {confirmationMessage}
          </p>

          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Waiting for confirmation…</span>
          </div>

          {confirmationSaleId && (
            <p className="mt-4 text-xs text-gray-400 dark:text-gray-500 font-mono">
              Ref: {confirmationSaleId.slice(0, 8)}
            </p>
          )}

          <button
            type="button"
            onClick={handleCancelWaiting}
            className="mt-6 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline focus-ring rounded"
          >
            Cancel and go back
          </button>
        </motion.div>
      </div>
    );
  }

  // ============================================
  // RENDER — Order Complete
  // ============================================

  if (completedSale) {
    return (
      <div
        className={`min-h-screen ${isDark ? 'dark bg-gray-950' : 'bg-gray-50'}`}
      >
        <div className="max-w-4xl mx-auto px-4 pt-24 md:pt-28 pb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-200 dark:border-gray-700 overflow-hidden text-center p-12"
          >
            <div className="w-20 h-20 bg-success-100 dark:bg-success-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-success-600 dark:text-success-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Payment Confirmed!
            </h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Thank you — your payment has been received.
            </p>
            <p className="mt-4 font-mono text-sm text-gray-700 dark:text-gray-300">
              {completedSale.receiptNumber}
            </p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <Link
                href="/shop"
                className="px-6 py-3 bg-brand-gradient hover:shadow-brand-lg text-white rounded-lg transition-all shadow-brand inline-flex items-center gap-2"
              >
                <ShoppingBag className="w-5 h-5" />
                Continue Shopping
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER — Checkout form
  // ============================================

  const selectorMethods: SelectorPaymentMethod[] = [
    {
      id: 'CASH',
      name: 'Cash',
      code: 'CASH',
      icon: <span className="text-2xl">💰</span>,
      description: 'Pay cash at the counter',
      enabled: true,
      providerName: 'Cash',
    },
    {
      id: 'BANK_TRANSFER',
      name: 'Bank Transfer',
      code: 'BANK_TRANSFER',
      icon: <span className="text-2xl">🏦</span>,
      description: 'Direct transfer — staff confirms later',
      enabled: true,
      providerName: 'Bank',
    },
    {
      id: 'CREDIT_CARD',
      name: 'Credit Card',
      code: 'CREDIT_CARD',
      icon: <CreditCard className="w-5 h-5" />,
      description: 'Visa, Mastercard via Stripe',
      enabled: true,
      requiresDetails: true,
      providerName: 'Stripe',
      recommended: true,
    },
    {
      id: 'DEBIT_CARD',
      name: 'Debit Card',
      code: 'DEBIT_CARD',
      icon: <CreditCard className="w-5 h-5" />,
      description: 'Stripe secured debit card',
      enabled: true,
      requiresDetails: true,
      providerName: 'Stripe',
    },
    {
      id: 'SQUARE',
      name: 'Square',
      code: 'SQUARE',
      icon: <CreditCard className="w-5 h-5" />,
      description: 'Secure card payment via Square',
      enabled: true,
      requiresDetails: true,
      providerName: 'Square',
    },
    {
      id: 'MOBILE_MONEY',
      name: 'Mobile Money',
      code: 'MOBILE_MONEY',
      icon: <Smartphone className="w-5 h-5" />,
      description: 'M-Pesa, MTN, Airtel',
      enabled: true,
      requiresDetails: true,
      providerName: 'Mobile Money',
      popular: true,
    },
    {
      id: 'PAYPAL',
      name: 'PayPal',
      code: 'PAYPAL',
      icon: <span className="text-2xl">💸</span>,
      description: 'Redirect to PayPal to approve',
      enabled: true,
      requiresDetails: true,
      providerName: 'PayPal',
    },
    {
      id: 'FLUTTERWAVE',
      name: 'Flutterwave',
      code: 'FLUTTERWAVE',
      icon: <span className="text-2xl">🌊</span>,
      description: 'Cards, bank, USSD via Flutterwave',
      enabled: true,
      requiresDetails: true,
      providerName: 'Flutterwave',
    },
    {
      id: 'GIFT_CARD',
      name: 'Gift Card',
      code: 'GIFT_CARD',
      icon: <span className="text-2xl">🎁</span>,
      description: 'Redeem a gift card code',
      enabled: isAuthenticated,
      requiresDetails: true,
      providerName: 'Gift Card',
    },
    {
      id: 'LOYALTY_POINTS',
      name: 'Loyalty Points',
      code: 'LOYALTY_POINTS',
      icon: <span className="text-2xl">⭐</span>,
      description: 'Pay entirely with points',
      enabled:
        isAuthenticated && (summary?.loyaltyPointsAvailable ?? 0) > 0,
      requiresDetails: true,
      providerName: 'Loyalty',
    },
  ];

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-gray-950' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto px-4 pt-24 md:pt-28 pb-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push('/cart')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition focus-ring"
              aria-label="Back to cart"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Lock className="w-8 h-8 text-brand-500" />
                Secure Checkout
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
                {totalItems} items • Total: {formatCurrency(finalTotal)}
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1 text-success-600 dark:text-success-400">
              <Shield className="w-4 h-4" />
              Secure
            </span>
            <span className="text-gray-300">|</span>
            <span className="flex items-center gap-1 text-brand-600 dark:text-brand-400">
              <Clock className="w-4 h-4" />
              Fast Checkout
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-8 flex-wrap">
          {[
            { step: 1, label: 'Review Cart', icon: ShoppingBag },
            { step: 2, label: 'Customer Info', icon: User },
            { step: 3, label: 'Payment', icon: CreditCard },
          ].map(({ step, label, icon: Icon }, index, arr) => (
            <div key={step} className="flex items-center">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline text-sm font-medium">
                  {label}
                </span>
              </div>
              {index < arr.length - 1 && (
                <ChevronRight className="w-4 h-4 mx-1 text-brand-400" />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer form */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-200 dark:border-gray-700 p-6">
              <button
                type="button"
                onClick={() => setShowCustomerForm(!showCustomerForm)}
                className="w-full flex items-center justify-between focus-ring rounded"
                aria-expanded={showCustomerForm}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-100 dark:bg-brand-900/30 rounded-lg">
                    <User className="w-5 h-5 text-brand-600 dark:text-brand-400" />
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

              <AnimatePresence initial={false}>
                {showCustomerForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="John Doe"
                          disabled={cardFlowActive}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Email Address{' '}
                          {!isAuthenticated && (
                            <span className="text-danger-500">*</span>
                          )}
                        </label>
                        <input
                          type="email"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="john@example.com"
                          required={!isAuthenticated}
                          disabled={cardFlowActive}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <PhoneNumberInput
                          ref={phoneInputRef}
                          value={customerPhone}
                          onChange={setCustomerPhone}
                          provider={isMobileMethod ? mobileProvider : undefined}
                          required={isMobileMethod}
                          disabled={cardFlowActive}
                          label="Phone Number"
                        />
                        {isMobileMethod && (
                          <MobileMoneyProviderPicker
                            className="mt-3"
                            selected={mobileProvider}
                            onSelect={setMobileProvider}
                          />
                        )}
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Delivery Address
                        </label>
                        <input
                          type="text"
                          value={customerAddress}
                          onChange={(e) => setCustomerAddress(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="123 Main St, City, Country"
                          disabled={cardFlowActive}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Payment picker */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-200 dark:border-gray-700 p-6">
              <button
                type="button"
                onClick={() =>
                  !cardFlowActive &&
                  setShowPaymentDetails(!showPaymentDetails)
                }
                className="w-full flex items-center justify-between focus-ring rounded"
                aria-expanded={showPaymentDetails}
                disabled={cardFlowActive}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-success-100 dark:bg-success-900/30 rounded-lg">
                    <CreditCard className="w-5 h-5 text-success-600 dark:text-success-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Payment Method
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {selectorMethods.find((m) => m.id === paymentMethod)
                        ?.name || paymentMethod}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    showPaymentDetails ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <AnimatePresence initial={false}>
                {showPaymentDetails && !cardFlowActive && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 overflow-hidden"
                  >
                    <PaymentMethodSelector
                      selectedMethod={paymentMethod}
                      onSelect={(id: string) => {
                        setPaymentMethod(id as PaymentMethod);
                        setCardFlowActive(false);
                        setStripeClientSecret(null);
                      }}
                      availableMethods={selectorMethods}
                      showProviderInfo
                    />

                    {isMobileMethod && (
                      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-start gap-3">
                          <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-blue-700 dark:text-blue-300">
                            <p className="font-medium">
                              {mobileProvider} requires a phone number
                            </p>
                            <p className="mt-1 text-blue-600 dark:text-blue-400">
                              {mobileProvider === 'MPESA'
                                ? 'We will send an STK push. Enter your M-Pesa PIN on your phone to authorize.'
                                : 'You will receive a prompt on your phone. Approve it to complete the payment.'}
                            </p>
                            {!customerPhone && (
                              <p className="mt-2 font-medium text-danger-600 dark:text-danger-400 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" />
                                Enter your phone number in the Customer
                                Information section above.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {isCardMethod && cardFlowActive && cart && (
                <div
                  ref={cardFormRef}
                  className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
                >
                  <PaymentForm
                    amount={finalTotal}
                    currency="USD"
                    paymentMethod={paymentMethod}
                    provider="STRIPE"
                    customerId={cart.customerId}
                    cartId={cart.id}
                    businessUnitId={cart.businessUnitId}
                    stripeClientSecret={stripeClientSecret}
                    returnUrl={buildReturnUrl()}
                    cancelUrl={buildCancelUrl()}
                    onAwaitingConfirmation={(saleId: string) => {
                      setCardFlowActive(false);
                      setStripeClientSecret(null);
                      window.dispatchEvent(
                        new CustomEvent('cart:updated'),
                      );
                      startPollingSale(
                        saleId,
                        'Card approved. Waiting for the bank to finalize…',
                      );
                    }}
                    onSuccess={(payment: any) => {
                      setCardFlowActive(false);
                      setStripeClientSecret(null);
                      window.dispatchEvent(
                        new CustomEvent('cart:updated'),
                      );
                      if (payment?.saleId) {
                        startPollingSale(
                          payment.saleId,
                          'Card approved. Waiting for the bank to finalize…',
                        );
                      } else if (payment?.id) {
                        toast.success('Payment processed');
                      }
                    }}
                    onError={(err: any) => {
                      const message =
                        (err as any)?.message || 'Card payment failed';
                      toast.error(message);
                      idempotencyKeyRef.current = null;
                    }}
                    onCancel={() => {
                      setCardFlowActive(false);
                      setStripeClientSecret(null);
                      idempotencyKeyRef.current = null;
                    }}
                  />
                </div>
              )}
            </div>

            {/* Promotions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-200 dark:border-gray-700 p-6">
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
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white uppercase font-mono"
                  placeholder="Enter promo code"
                  disabled={promotionApplied || !isAuthenticated}
                />
                <button
                  type="button"
                  onClick={handleApplyPromotion}
                  disabled={
                    applyingPromotion ||
                    promotionApplied ||
                    !promotionCode.trim() ||
                    !isAuthenticated
                  }
                  className="px-4 py-2 bg-brand-gradient hover:shadow-brand-lg disabled:opacity-50 text-white rounded-lg transition-all flex items-center gap-2 shadow-brand"
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
                <p className="mt-1 text-sm text-danger-600 dark:text-danger-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {promotionError}
                </p>
              )}
              {promotionApplied && (
                <p className="mt-1 text-sm text-success-600 dark:text-success-400 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Promotion applied successfully!
                </p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-200 dark:border-gray-700 p-6">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedOrderSummary(!expandedOrderSummary)
                  }
                  className="w-full flex items-center justify-between mb-4 focus-ring rounded"
                  aria-expanded={expandedOrderSummary}
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-brand-500" />
                    Order Summary
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400 tabular-nums">
                      ({totalItems} items)
                    </span>
                  </h3>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedOrderSummary ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {expandedOrderSummary && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="max-h-60 overflow-y-auto space-y-3 mb-4 custom-scrollbar">
                        {cart.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                              {item.product?.images?.[0] ? (
                                <img
                                  src={item.product.images[0]}
                                  alt={item.product.name}
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {item.product?.name || 'Product'}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                                {item.quantity} ×{' '}
                                {formatCurrency(item.unitPrice)}
                              </p>
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white tabular-nums">
                              {formatCurrency(item.total)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">
                            Subtotal
                          </span>
                          <span className="text-gray-900 dark:text-white tabular-nums">
                            {formatCurrency(displaySubtotal)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">
                            Tax
                          </span>
                          <span className="text-gray-900 dark:text-white tabular-nums">
                            {formatCurrency(displayTax)}
                          </span>
                        </div>
                        {displayDiscount > 0 && (
                          <div className="flex justify-between text-sm text-success-600 dark:text-success-400">
                            <span>Discount</span>
                            <span className="tabular-nums">
                              -{formatCurrency(displayDiscount)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-gray-900 dark:text-white">
                            Total
                          </span>
                          <span className="text-gray-900 dark:text-white tabular-nums">
                            {formatCurrency(finalTotal)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {isCardMethod && cardFlowActive ? (
                  <div className="w-full mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl text-center">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center justify-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Card form is open above
                    </p>
                    <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                      Enter your card details and click{' '}
                      <strong>Pay Now</strong> to complete payment.
                    </p>
                    <div className="mt-3 flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          cardFormRef.current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                          });
                        }}
                        className="text-xs text-blue-700 dark:text-blue-300 hover:underline underline-offset-2 font-medium"
                      >
                        Scroll to card form
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCardFlowActive(false);
                          setStripeClientSecret(null);
                          idempotencyKeyRef.current = null;
                        }}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:underline underline-offset-2"
                      >
                        Cancel card entry
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handlePlaceOrder}
                    disabled={processing || cart.items.length === 0}
                    className="w-full mt-4 px-6 py-4 bg-success-600 hover:bg-success-700 text-white rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-brand focus-ring"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        {isMobileMethod
                          ? `Send Payment Prompt — ${formatCurrency(finalTotal)}`
                          : isCardMethod
                            ? `Enter Card Details — ${formatCurrency(finalTotal)}`
                            : `Place Order — ${formatCurrency(finalTotal)}`}
                      </>
                    )}
                  </button>
                )}

                <p className="mt-3 text-xs text-center text-gray-500 dark:text-gray-400">
                  By placing your order, you agree to our Terms of Service
                  and Privacy Policy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
