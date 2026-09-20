// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\cart\checkout\page.tsx

'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CreditCard,
  Wallet,
  Shield,
  Lock,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  User,
  Package,
  Receipt,
  Printer,
  Eye,
  Banknote,
  Smartphone,
  Building2,
  Sparkles,
  BadgeCheck,
  Info,
  ShoppingCart,
  Gift,
} from 'lucide-react';
import { toast } from '../../../../../utils/toast-manager';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { api } from '../../../../../services/api';
import {
  cartService,
  newIdempotencyKey,
  type Cart,
} from '../../../../../services/cartService';
import { checkoutService } from '../../../../../services/checkoutService';
import {
  formatCurrency,
} from '../../../../../utils/formatters';

// ============================================
// INTERFACES
// ============================================

interface CheckoutResponse {
  sale: {
    id: string;
    receiptNumber: string;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    paidAmount: number;
    changeAmount: number;
    status: string;
    saleDate: string;
    businessUnitId: string;
    userId: string;
    customerId?: string;
    cashRegisterId?: string;
    cashRegisterSessionId?: string;
  };
  payment?: { id: string; amount: number };
  receipt?: {
    receiptNumber: string;
    total: number;
    paidAmount: number;
    changeAmount: number;
    paymentMethod: string;
  };
  loyaltyPointsEarned?: number;
  loyaltyPointsUsed?: number;
  changeAmount?: number;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  loyaltyPoints?: number;
}

interface CashRegisterOption {
  id: string;
  name: string;
}

// ============================================
// PAYMENT METHODS
// ============================================
//
// Canonical identifiers only. The backend collapses aliases like
// CARD → CREDIT_CARD, MOBILE → MOBILE_MONEY.

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash', icon: Banknote },
  { value: 'CREDIT_CARD', label: 'Credit Card', icon: CreditCard },
  { value: 'DEBIT_CARD', label: 'Debit Card', icon: CreditCard },
  { value: 'MOBILE_MONEY', label: 'Mobile Money', icon: Smartphone },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: Building2 },
  { value: 'GIFT_CARD', label: 'Gift Card', icon: Gift },
  { value: 'LOYALTY_POINTS', label: 'Loyalty Points', icon: Wallet },
] as const;

type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]['value'];

const CUSTOMER_SEARCH_DEBOUNCE_MS = 300;
const MIN_CUSTOMER_SEARCH_LENGTH = 2;

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminCartCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canManage, isLoading: permissionLoading } = usePermission();

  const cartId = searchParams.get('cartId');

  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [checkoutResult, setCheckoutResult] =
    useState<CheckoutResponse | null>(null);

  // Form state
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodValue>('CASH');
  const [paidAmount, setPaidAmount] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [notes, setNotes] = useState('');
  const [tipAmount, setTipAmount] = useState('');
  const [cashRegisterId, setCashRegisterId] = useState('');
  const [cashRegisterSessionId, setCashRegisterSessionId] = useState('');
  const [cashRegisters, setCashRegisters] = useState<
    CashRegisterOption[]
  >([]);

  const isMountedRef = useRef(true);
  const customerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  /**
   * One idempotency key per page visit. Retries reuse it so a network
   * flake or a double-click never produces two sales.
   */
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (customerDebounceRef.current) {
        clearTimeout(customerDebounceRef.current);
      }
    };
  }, []);

  // ============================================
  // PERMISSIONS
  // ============================================

  const canCheckout =
    canManage(PermissionResource.CART_CHECKOUT) ||
    canManage(PermissionResource.CART_MANAGE);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // When the admin came from the cart list, they passed a
      // specific cartId. When they came from the "Checkout" button in
      // the admin header, no cartId is present — the admin's own
      // active cart is used.
      const cartData = cartId
        ? await cartService.getCartById(cartId)
        : await cartService.getCart();

      if (!isMountedRef.current) return;

      setCart(cartData);
      setPaidAmount(String(cartData.total ?? 0));

      // Cash registers
      try {
        const response = await api.get<CashRegisterOption[]>(
          '/cash-registers',
        );
        if (!isMountedRef.current) return;
        const list = Array.isArray(response)
          ? response
          : Array.isArray(
              (response as unknown as { data: CashRegisterOption[] })?.data,
            )
          ? (response as unknown as { data: CashRegisterOption[] }).data
          : [];
        setCashRegisters(list);
      } catch (err) {
        console.warn('Failed to fetch cash registers:', err);
      }

      // Preload the customer if the cart already has one
      if (cartData.customerId) {
        try {
          const customer = await api.get<Customer>(
            `/customers/${cartData.customerId}`,
          );
          if (!isMountedRef.current) return;
          const payload =
            customer && typeof customer === 'object' && 'id' in customer
              ? customer
              : (customer as unknown as { data: Customer })?.data;
          if (payload) {
            setSelectedCustomer(payload);
            setCustomerId(payload.id);
            setCustomerSearch(
              `${payload.firstName} ${payload.lastName}`.trim(),
            );
          }
        } catch (err) {
          console.warn('Failed to fetch customer details:', err);
        }
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.error('Failed to fetch cart:', err);
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load cart';
      setError(message);
      toast.error(message);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [cartId]);

  useEffect(() => {
    if (!permissionLoading && canCheckout) {
      void fetchCart();
    } else if (!permissionLoading && !canCheckout) {
      setLoading(false);
    }
  }, [permissionLoading, canCheckout, fetchCart]);

  // ============================================
  // CUSTOMER SEARCH
  // ============================================

  const searchCustomers = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_CUSTOMER_SEARCH_LENGTH) {
      setCustomers([]);
      setShowCustomerDropdown(false);
      return;
    }

    try {
      setIsSearchingCustomers(true);
      const response = await api.get<Customer[]>(
        `/customers/search?q=${encodeURIComponent(trimmed)}`,
      );
      if (!isMountedRef.current) return;
      const list = Array.isArray(response)
        ? response
        : Array.isArray(
            (response as unknown as { data: Customer[] })?.data,
          )
        ? (response as unknown as { data: Customer[] }).data
        : [];
      setCustomers(list);
      setShowCustomerDropdown(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.warn('Failed to search customers:', err);
      setCustomers([]);
    } finally {
      if (isMountedRef.current) setIsSearchingCustomers(false);
    }
  }, []);

  useEffect(() => {
    if (customerDebounceRef.current) {
      clearTimeout(customerDebounceRef.current);
    }
    customerDebounceRef.current = setTimeout(() => {
      if (customerSearch) {
        void searchCustomers(customerSearch);
      } else {
        setCustomers([]);
        setShowCustomerDropdown(false);
      }
    }, CUSTOMER_SEARCH_DEBOUNCE_MS);

    return () => {
      if (customerDebounceRef.current) {
        clearTimeout(customerDebounceRef.current);
      }
    };
  }, [customerSearch, searchCustomers]);

  const handleSelectCustomer = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerId(customer.id);
    setCustomerSearch(
      `${customer.firstName} ${customer.lastName}`.trim(),
    );
    setShowCustomerDropdown(false);
  }, []);

  const handleClearCustomer = useCallback(() => {
    setSelectedCustomer(null);
    setCustomerId('');
    setCustomerSearch('');
    setCustomers([]);
    setShowCustomerDropdown(false);
  }, []);

  // ============================================
  // CHECKOUT
  // ============================================

  const handleCheckout = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!cart || cart.items.length === 0) {
        toast.error('Cart is empty');
        return;
      }

      const paidAmountNum = parseFloat(paidAmount);
      if (isNaN(paidAmountNum) || paidAmountNum <= 0) {
        toast.error('Please enter a valid paid amount');
        return;
      }

      const totalDue = cart.total ?? 0;
      if (paidAmountNum < totalDue) {
        toast.error(
          `Paid amount (${formatCurrency(
            paidAmountNum,
          )}) is less than total (${formatCurrency(totalDue)})`,
        );
        return;
      }

      const tipAmountNum = tipAmount ? parseFloat(tipAmount) : 0;
      if (isNaN(tipAmountNum) || tipAmountNum < 0) {
        toast.error('Please enter a valid tip amount');
        return;
      }

      // Initialize the idempotency key once. Reuse on retries.
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = newIdempotencyKey();
      }

      setCheckingOut(true);
      setError(null);

      try {
        // `paidAmount` in the payload is the amount TENDERED, not the
        // total. The backend computes change and validates sufficiency.
        const result = await checkoutService.processCheckout({
          cartId: cart.id,
          customerId: customerId || undefined,
          paymentMethod: paymentMethod as any,
          paidAmount: paidAmountNum,
          notes: notes.trim() || undefined,
          cashRegisterId: cashRegisterId || undefined,
          cashRegisterSessionId:
            cashRegisterSessionId || undefined,
          idempotencyKey: idempotencyKeyRef.current,
        });

        if (!isMountedRef.current) return;

        setCheckoutResult(result as unknown as CheckoutResponse);
        setSuccess(true);
        toast.success('Checkout completed successfully!');
        window.dispatchEvent(new CustomEvent('cart:updated'));

        // Optional auto-print. Non-blocking.
        setTimeout(() => {
          const receiptNumber = (result as any)?.receipt?.receiptNumber;
          if (receiptNumber) {
            handlePrintReceipt(receiptNumber);
          }
        }, 1000);
      } catch (err: any) {
        if (!isMountedRef.current) return;
        console.error('Checkout failed:', err);
        const message =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to complete checkout';
        setError(message);
        toast.error(message);

        if (Array.isArray(err?.response?.data?.errors)) {
          const errorList = err.response.data.errors
            .map((e: any) => `${e.field}: ${e.message}`)
            .join(', ');
          toast.error(`Validation errors: ${errorList}`);
        }
        // Keep the idempotency key — retrying with the same key is
        // safe and is the whole point.
      } finally {
        if (isMountedRef.current) setCheckingOut(false);
      }
    },
    [
      cart,
      paidAmount,
      tipAmount,
      paymentMethod,
      customerId,
      notes,
      cashRegisterId,
      cashRegisterSessionId,
    ],
  );

  // ============================================
  // RECEIPT / NAVIGATION
  // ============================================

  const handlePrintReceipt = useCallback((receiptNumber: string) => {
    const printWindow = window.open(
      `/receipts/${receiptNumber}/print`,
      '_blank',
    );
    if (printWindow) {
      printWindow.focus();
    } else {
      toast.info('Please allow popups to print receipts');
    }
  }, []);

  const handleViewSale = useCallback(
    (saleId: string) => {
      router.push(`/admin/sales/${saleId}`);
    },
    [router],
  );

  const handleNewSale = useCallback(() => {
    setSuccess(false);
    setCheckoutResult(null);
    setPaymentMethod('CASH');
    setPaidAmount('');
    setNotes('');
    setTipAmount('');
    setCustomerId('');
    setSelectedCustomer(null);
    setCustomerSearch('');
    idempotencyKeyRef.current = null;
    void fetchCart();
  }, [fetchCart]);

  // ============================================
  // HELPERS
  // ============================================

  const getPaymentMethodLabel = useCallback((value: string) => {
    const method = PAYMENT_METHODS.find((m) => m.value === value);
    return method?.label ?? value;
  }, []);

  const changeAmount = useMemo(() => {
    if (!cart) return 0;
    const paid = parseFloat(paidAmount) || 0;
    return Math.max(0, paid - (cart.total ?? 0));
  }, [cart, paidAmount]);

  const itemCount = useMemo(
    () => cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
    [cart?.items],
  );

  // ============================================
  // RENDER — LOADING / PERMISSION
  // ============================================

  if (permissionLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading checkout…
          </p>
        </div>
      </div>
    );
  }

  if (!canCheckout) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to checkout carts. Please contact
          your administrator.
        </p>
        <button
          type="button"
          onClick={() => router.push('/admin')}
          className="mt-4 px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // ============================================
  // RENDER — SUCCESS
  // ============================================

  if (success && checkoutResult) {
    const sale = checkoutResult.sale;
    const receipt = checkoutResult.receipt;

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              type="button"
              onClick={() => router.push('/admin/cart')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Back to carts"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Checkout Complete
            </h1>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-emerald-200 dark:border-emerald-800 p-8 text-center"
          >
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Checkout Successful
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Sale #{sale.receiptNumber} has been completed.
            </p>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
              <SummaryTile label="Receipt" value={sale.receiptNumber} />
              <SummaryTile
                label="Total"
                value={formatCurrency(sale.total)}
              />
              <SummaryTile
                label="Payment"
                value={getPaymentMethodLabel(paymentMethod)}
              />
              <SummaryTile
                label="Change"
                value={formatCurrency(
                  receipt?.changeAmount ?? sale.changeAmount ?? 0,
                )}
                accent="text-emerald-600 dark:text-emerald-400"
              />
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => handlePrintReceipt(sale.receiptNumber)}
                className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2 shadow-md"
              >
                <Printer className="w-5 h-5" />
                Print Receipt
              </button>
              <button
                type="button"
                onClick={() => handleViewSale(sale.id)}
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl font-medium transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-300"
              >
                <Eye className="w-5 h-5" />
                View Sale
              </button>
              <button
                type="button"
                onClick={handleNewSale}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2 shadow-md"
              >
                <ShoppingCart className="w-5 h-5" />
                New Sale
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER — EMPTY
  // ============================================

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              type="button"
              onClick={() => router.push('/admin/cart')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Back to carts"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Checkout
            </h1>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <ShoppingCart className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Cart is Empty
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              There are no items to checkout.
            </p>
            <Link
              href="/admin/cart"
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Cart
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER — MAIN
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push('/admin/cart')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Back to carts"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-7 h-7 text-orange-500" />
                Checkout
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {itemCount} {itemCount === 1 ? 'item' : 'items'} ready
                for checkout
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm">
            <Shield className="w-4 h-4" />
            Secure Checkout
          </span>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Error
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 dark:text-red-400 p-1"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleCheckout}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8"
        >
          {/* LEFT — Cart & form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Items */}
            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-orange-500" />
                  Cart Items ({itemCount})
                </h3>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[300px] overflow-y-auto">
                {cart.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 flex items-center gap-4"
                  >
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                      {item.product?.images?.[0] ? (
                        <img
                          src={item.product.images[0]}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {item.product?.name || 'Product'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {item.quantity} ×{' '}
                        {formatCurrency(item.unitPrice)}
                      </p>
                      {item.variant && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Variant: {item.variant.name}
                        </p>
                      )}
                    </div>
                    <div className="text-right tabular-nums">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(item.total)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Customer */}
            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-orange-500" />
                Customer
              </h3>

              {selectedCustomer ? (
                <div className="flex items-center justify-between gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {selectedCustomer.firstName}{' '}
                      {selectedCustomer.lastName}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {selectedCustomer.email}
                      {selectedCustomer.phoneNumber
                        ? ` • ${selectedCustomer.phoneNumber}`
                        : ''}
                    </p>
                    {selectedCustomer.loyaltyPoints !== undefined && (
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                        {selectedCustomer.loyaltyPoints} loyalty points
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleClearCustomer}
                    className="shrink-0 p-1.5 rounded-md hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors"
                    aria-label="Remove customer"
                  >
                    <X className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) =>
                      setCustomerSearch(e.target.value)
                    }
                    onFocus={() =>
                      customerSearch.trim().length >=
                        MIN_CUSTOMER_SEARCH_LENGTH &&
                      setShowCustomerDropdown(true)
                    }
                    placeholder="Search customer by name, email, or phone…"
                    autoComplete="off"
                    className="w-full pl-9 pr-9 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  />
                  {isSearchingCustomers && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-orange-500" />
                  )}

                  {showCustomerDropdown && customers.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {customers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() =>
                            handleSelectCustomer(customer)
                          }
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-start gap-3"
                        >
                          <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {customer.firstName} {customer.lastName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {customer.email}
                              {customer.phoneNumber
                                ? ` • ${customer.phoneNumber}`
                                : ''}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Cash register */}
            {cashRegisters.length > 0 && (
              <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                  <Building2 className="w-5 h-5 text-orange-500" />
                  Cash Register
                </h3>
                <select
                  value={cashRegisterId}
                  onChange={(e) =>
                    setCashRegisterId(e.target.value)
                  }
                  className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-gray-900 dark:text-white"
                >
                  <option value="">Select Cash Register</option>
                  {cashRegisters.map((register) => (
                    <option key={register.id} value={register.id}>
                      {register.name}
                    </option>
                  ))}
                </select>
              </section>
            )}

            {/* Notes */}
            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Info className="w-5 h-5 text-orange-500" />
                Notes
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add special instructions or notes…"
                rows={2}
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none"
              />
            </section>
          </div>

          {/* RIGHT — Payment summary */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 sticky top-24">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Receipt className="w-5 h-5 text-orange-500" />
                Payment Summary
              </h3>

              {/* Totals */}
              <div className="space-y-2 border-b border-gray-200 dark:border-gray-700 pb-4">
                <Row
                  label="Subtotal"
                  value={formatCurrency(cart.subtotal ?? 0)}
                />
                <Row
                  label="Tax"
                  value={formatCurrency(cart.tax ?? 0)}
                />
                {(cart.discount ?? 0) > 0 && (
                  <Row
                    label="Discount"
                    value={`−${formatCurrency(cart.discount ?? 0)}`}
                    accent="text-emerald-600 dark:text-emerald-400"
                  />
                )}
                {(cart.promotionDiscount ?? 0) > 0 && (
                  <Row
                    label="Promotion"
                    value={`−${formatCurrency(cart.promotionDiscount ?? 0)}`}
                    accent="text-purple-600 dark:text-purple-400"
                  />
                )}
                {(cart.loyaltyDiscount ?? 0) > 0 && (
                  <Row
                    label="Loyalty"
                    value={`−${formatCurrency(cart.loyaltyDiscount ?? 0)}`}
                    accent="text-indigo-600 dark:text-indigo-400"
                  />
                )}
                <div className="flex justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-base font-bold text-gray-900 dark:text-white">
                    Total
                  </span>
                  <span className="text-base font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                    {formatCurrency(cart.total ?? 0)}
                  </span>
                </div>
              </div>

              {/* Payment method grid */}
              <div className="mt-4 space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon;
                    const isActive =
                      paymentMethod === method.value;
                    return (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() =>
                          setPaymentMethod(method.value)
                        }
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                            : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-orange-300'
                        }`}
                        aria-pressed={isActive}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">
                          {method.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Paid amount */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount Tendered
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min={cart.total}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-gray-900 dark:text-white tabular-nums"
                    required
                    inputMode="decimal"
                  />
                </div>
                <div className="mt-1.5 flex gap-1">
                  {[cart.total, Math.ceil(cart.total / 10) * 10, Math.ceil(cart.total / 50) * 50].filter((v, i, arr) => v >= cart.total && arr.indexOf(v) === i).slice(0, 3).map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setPaidAmount(String(amount))}
                      className="px-2 py-0.5 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
                    >
                      {formatCurrency(amount)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tip */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tip (Optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 tabular-nums"
                    inputMode="decimal"
                  />
                </div>
              </div>

              {/* Change */}
              {changeAmount > 0 && (
                <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-700 dark:text-emerald-300">
                      Change Due
                    </span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                      {formatCurrency(changeAmount)}
                    </span>
                  </div>
                </div>
              )}

              {/* Checkout button */}
              <button
                type="submit"
                disabled={
                  checkingOut || !cart || cart.items.length === 0
                }
                className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {checkingOut ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Complete Checkout
                  </>
                )}
              </button>

              {/* Trust */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-500" />
                  Secure
                </span>
                <span className="inline-flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-500" />
                  Encrypted
                </span>
                <span className="inline-flex items-center gap-1">
                  <BadgeCheck className="w-3 h-3 text-orange-500" />
                  Verified
                </span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function Row({
  label,
  value,
  accent = 'text-gray-900 dark:text-white',
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span className={`font-medium tabular-nums ${accent}`}>
        {value}
      </span>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  accent = 'text-gray-900 dark:text-white',
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className={`font-semibold tabular-nums ${accent}`}>
        {value}
      </p>
    </div>
  );
}
