'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  DollarSign,
  CreditCard,
  Smartphone,
  Landmark,
  Gift,
  Star,
  Receipt,
  ShoppingCart,
  User,
  Percent,
} from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { formatCurrency } from '../../utils/formatters';
import { productService } from '../../services/productService';
import { customerService } from '../../services/customerService';
import { orderService } from '../../services/orderService';
import { cartService, Cart } from '../../services/cartService';
import { shiftService } from '../../services/shiftService';
import { paymentService } from '../../services/paymentService';

// ─────────────────────────────────────────────────────────────
// Payment method catalogue
// Only methods that can complete synchronously are enabled by default.
// Redirect-based (PayPal/Flutterwave/Paystack) and Square are visible
// but disabled with a tooltip — they need SDK integration to complete
// on the same page. Flip `enabled: true` when those are wired.
// ─────────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash', icon: DollarSign, enabled: true, requiresShift: true, requiresCustomer: false, requiresPhone: false, requiresCode: false },
  { value: 'CREDIT_CARD', label: 'Credit Card', icon: CreditCard, enabled: true, requiresShift: false, requiresCustomer: false, requiresPhone: false, requiresCode: false },
  { value: 'DEBIT_CARD', label: 'Debit Card', icon: CreditCard, enabled: true, requiresShift: false, requiresCustomer: false, requiresPhone: false, requiresCode: false },
  { value: 'MOBILE_MONEY', label: 'Mobile Money', icon: Smartphone, enabled: true, requiresShift: false, requiresCustomer: false, requiresPhone: true, requiresCode: false },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: Landmark, enabled: true, requiresShift: false, requiresCustomer: false, requiresPhone: false, requiresCode: false },
  { value: 'GIFT_CARD', label: 'Gift Card', icon: Gift, enabled: true, requiresShift: false, requiresCustomer: false, requiresPhone: false, requiresCode: true },
  { value: 'LOYALTY_POINTS', label: 'Loyalty Points', icon: Star, enabled: true, requiresShift: false, requiresCustomer: true, requiresPhone: false, requiresCode: false },
  { value: 'PAYPAL', label: 'PayPal', icon: CreditCard, enabled: false, requiresShift: false, requiresCustomer: false, requiresPhone: false, requiresCode: false },
  { value: 'FLUTTERWAVE', label: 'Flutterwave', icon: CreditCard, enabled: false, requiresShift: false, requiresCustomer: false, requiresPhone: false, requiresCode: false },
  { value: 'PAYSTACK', label: 'Paystack', icon: CreditCard, enabled: false, requiresShift: false, requiresCustomer: false, requiresPhone: false, requiresCode: false },
  { value: 'SQUARE', label: 'Square', icon: CreditCard, enabled: false, requiresShift: false, requiresCustomer: false, requiresPhone: false, requiresCode: false },
] as const;

type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]['value'];

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  images?: string[];
  inventory?: { quantity: number; reserved?: number } | null;
}

interface CustomerOption {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
  loyaltyPoints?: number;
}

interface OrderFormProps {
  mode?: 'order' | 'pos';
}

export function OrderForm({ mode = 'order' }: OrderFormProps) {
  const router = useRouter();

  // ── Shift gate ─────────────────────────────────────────────
  const [shift, setShift] = useState<any>(null);
  const [loadingShift, setLoadingShift] = useState(true);

  // ── Cart ───────────────────────────────────────────────────
  const [cart, setCart] = useState<Cart | null>(null);
  const [cartLoading, setCartLoading] = useState(false);

  // ── Customer ───────────────────────────────────────────────
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  // ── Product search ─────────────────────────────────────────
  const [itemSearch, setItemSearch] = useState('');
  const [itemResults, setItemResults] = useState<ProductOption[]>([]);
  const [searchingItems, setSearchingItems] = useState(false);
  const [addingItemId, setAddingItemId] = useState<string | null>(null);

  // ── Payment ────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>('CASH');
  const [paidAmount, setPaidAmount] = useState('');
  const [mobilePhone, setMobilePhone] = useState('');
  const [giftCardCode, setGiftCardCode] = useState('');
  const [manualDiscount, setManualDiscount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeMethod = useMemo(
    () => PAYMENT_METHODS.find((m) => m.value === paymentMethod)!,
    [paymentMethod]
  );

  // ─────────────────────────────────────────────────────────────
  // Load shift state
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const current = await shiftService.getCurrentShift();
        if (!cancelled) setShift(current);
      } catch (err) {
        console.error('Failed to load shift:', err);
        if (!cancelled) setShift(null);
      } finally {
        if (!cancelled) setLoadingShift(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Load cart once we know there's a shift (or method doesn't need one)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loadingShift) return;
    if (activeMethod.requiresShift && !shift) return;

    let cancelled = false;
    (async () => {
      try {
        setCartLoading(true);
        const active = await cartService.getActiveCart();
        if (!cancelled) setCart(active);
      } catch (err: any) {
        console.error('Failed to load cart:', err);
        toast.error(err?.response?.data?.message || 'Failed to load cart');
      } finally {
        if (!cancelled) setCartLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [loadingShift, shift, activeMethod.requiresShift]);

  // ─────────────────────────────────────────────────────────────
  // Customer search (debounced)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const q = customerSearch.trim();
    if (!q) { setCustomerResults([]); return; }
    const t = setTimeout(async () => {
      try {
        setSearchingCustomers(true);
        const results = await customerService.searchCustomers({ query: q, limit: 8 });
        setCustomerResults((results || []) as unknown as CustomerOption[]);
      } catch (err) {
        console.error('Customer search failed:', err);
        setCustomerResults([]);
      } finally {
        setSearchingCustomers(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [customerSearch]);

  // ─────────────────────────────────────────────────────────────
  // Product search (debounced)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const q = itemSearch.trim();
    if (!q) { setItemResults([]); return; }
    const t = setTimeout(async () => {
      try {
        setSearchingItems(true);
        const results = await productService.searchProducts({ query: q });
        setItemResults(
          (results || [])
            .filter((p: any) => p && p.id)
            .slice(0, 10) as ProductOption[]
        );
      } catch (err) {
        console.error('Product search failed:', err);
        setItemResults([]);
      } finally {
        setSearchingItems(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [itemSearch]);

  // ─────────────────────────────────────────────────────────────
  // Totals (derived from cart + manual discount)
  // ─────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const subtotal = cart?.subtotal ?? 0;
    const tax = cart?.tax ?? 0;
    const cartDiscount = cart?.discount ?? 0;
    const extraDiscount = parseFloat(manualDiscount) || 0;
    const discount = cartDiscount + extraDiscount;
    const total = Math.max(0, subtotal + tax - discount);
    const paid = parseFloat(paidAmount) || 0;
    const change = paid > total ? paid - total : 0;
    const balance = paid < total ? total - paid : 0;
    return { subtotal, tax, cartDiscount, extraDiscount, discount, total, paid, change, balance };
  }, [cart, manualDiscount, paidAmount]);

  // Prefill paidAmount with total when cart loads or total changes
  useEffect(() => {
    if (totals.total > 0 && !paidAmount) {
      setPaidAmount(totals.total.toFixed(2));
    }
  }, [totals.total, paidAmount]);

  // ─────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────
  const handleSelectCustomer = useCallback(
    async (c: CustomerOption | null) => {
      setCustomer(c);
      setCustomerSearch('');
      setCustomerResults([]);
      try {
        if (cart) {
          const updated = await cartService.setCustomer(c?.id ?? null);
          setCart(updated);
        }
      } catch (err: any) {
        toast.error('Failed to attach customer to cart');
      }
    },
    [cart]
  );

  const handleAddItem = useCallback(async (p: ProductOption) => {
    if (!p?.id) return;
    setAddingItemId(p.id);
    try {
      // cartService.addItem expects { productId, variantId?, quantity? } —
      // camelCase, matching both the frontend service signature and the
      // backend DTO (addItemSchema in cartController.ts).
      const updated = await cartService.addItem({
        productId: p.id,
        quantity: 1,
      });
      setCart(updated);
      setItemSearch('');
      setItemResults([]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add item');
    } finally {
      setAddingItemId(null);
    }
  }, []);

  const handleUpdateQty = useCallback(async (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    try {
      const updated = await cartService.updateItem(itemId, { quantity });
      setCart(updated);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update quantity');
    }
  }, []);

  const handleRemoveItem = useCallback(async (itemId: string) => {
    try {
      const updated = await cartService.removeItem(itemId);
      setCart(updated);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to remove item');
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Submit
  //
  // Flow:
  //   1. POST /orders                 → creates an Order (status PENDING)
  //   2. POST /orders/:id/convert-to-sale → creates a Sale (status COMPLETED),
  //                                        copies line items, marks the
  //                                        Order COMPLETED, returns the Sale
  //   3. POST /payments               → records a Payment against the Sale
  //
  // Payments MUST reference a Sale ID, not an Order ID. The backend's
  // /payments endpoint returns 404 "Sale not found" if you send the
  // order's id, which is exactly what the previous version of this
  // handler was doing.
  // ─────────────────────────────────────────────────────────────
  const handleCompleteSale = async () => {
    // Validations
    if (activeMethod.requiresShift && !shift) {
      toast.error('You must be on shift for cash sales');
      return;
    }
    if (!cart || !cart.items || cart.items.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    if (activeMethod.requiresCustomer && !customer) {
      toast.error(`${activeMethod.label} requires a customer`);
      return;
    }
    if (activeMethod.requiresPhone && !mobilePhone.trim()) {
      toast.error('Enter the mobile money phone number');
      return;
    }
    if (activeMethod.requiresCode && !giftCardCode.trim()) {
      toast.error('Enter the gift card code');
      return;
    }
    if (
      ['CASH', 'CREDIT_CARD', 'DEBIT_CARD'].includes(paymentMethod) &&
      totals.paid < totals.total
    ) {
      toast.error('Amount tendered is less than the total');
      return;
    }

    try {
      setSubmitting(true);

      // ── STEP 1: create the order ──────────────────────────────
      const order = await orderService.createOrder({
        items: cart.items.map((it) => ({
          productId: it.productId,
          variantId: it.variantId ?? undefined,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
        customerId: customer?.id,
        discount: totals.extraDiscount,
        notes: notes || undefined,
        paymentMethod,
      });

      const orderId = (order as any)?.id;
      if (!orderId) {
        throw new Error('Order was created but no ID was returned');
      }

      const orderNumber = (order as any)?.orderNumber;

      // ── STEP 2: convert the order into a Sale ─────────────────
      // The Order is the pending workflow record. The Sale is the
      // completed transaction. Payments must reference the Sale.
      const sale = await orderService.convertOrderToSale(orderId);

      const saleId = (sale as any)?.id;
      if (!saleId) {
        throw new Error('Order was converted but no Sale ID was returned');
      }

      const receiptNumber = (sale as any)?.receiptNumber;

      // ── STEP 3: record the payment against the Sale ───────────
      const paymentCommon = {
        saleId,
        amount: totals.total,
        customerId: customer?.id,
        cashRegisterId: shift?.cashRegisterId ?? undefined,
        cashRegisterSessionId: shift?.cashRegisterSessionId ?? undefined,
        currency: 'USD',
        description: `Sale ${receiptNumber || orderNumber || saleId}`,
        metadata: {
          source: mode,
          cashierId: shift?.userId,
          shiftId: shift?.id,
          paymentMethod,
          saleId,
          orderId,
          orderNumber,
        },
      };

      if (paymentMethod === 'MOBILE_MONEY' && mobilePhone.trim()) {
        // STK push flow — payment starts as PENDING
        await paymentService.initiatePosMpesaSTKPush({
          phoneNumber: mobilePhone.trim(),
          amount: totals.total,
          saleId,
          accountReference: receiptNumber || orderNumber || saleId,
          transactionDesc: `Sale ${receiptNumber || orderNumber || saleId}`,
        });
        toast.success('Mobile money request sent — awaiting confirmation');
      } else if (paymentMethod === 'GIFT_CARD') {
        await paymentService.processOrderPayment({
          ...paymentCommon,
          paymentMethod,
          gatewayId: giftCardCode.trim(),
        });
        toast.success('Gift card applied — sale complete');
      } else if (paymentMethod === 'LOYALTY_POINTS') {
        await paymentService.processOrderPayment({
          ...paymentCommon,
          paymentMethod,
        });
        toast.success('Loyalty points applied — sale complete');
      } else if (paymentMethod === 'BANK_TRANSFER') {
        await paymentService.processOrderPayment({
          ...paymentCommon,
          paymentMethod,
        });
        toast.success('Sale recorded — bank transfer pending');
      } else {
        // CASH, CREDIT_CARD, DEBIT_CARD, and other sync methods
        await paymentService.processOrderPayment({
          ...paymentCommon,
          paymentMethod,
          source: (sale as any).paymentSource,
        });
        toast.success('Sale completed');
      }

      // Redirect to the order detail page, which now shows the order
      // as COMPLETED and links to the associated sale + payment.
      router.push(`/admin/orders/${orderId}`);
    } catch (err: any) {
      console.error('Failed to complete sale:', err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to complete sale';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Render — shift gate (only blocks if the selected method needs it)
  // ─────────────────────────────────────────────────────────────
  if (loadingShift) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const shiftBlocked = activeMethod.requiresShift && !shift;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
      {/* LEFT: customer + items */}
      <div className="lg:col-span-2 space-y-4">
        {shiftBlocked && (
          <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-xl p-4 flex items-start gap-3 animate-slide-down">
            <AlertCircle className="w-5 h-5 text-warning-600 dark:text-warning-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-warning-900 dark:text-warning-200">
                No active shift
              </p>
              <p className="text-sm text-warning-800 dark:text-warning-300 mt-1">
                Cash sales require an open shift. Open one, or switch to a
                non-cash payment method.
              </p>
            </div>
            <Link
              href="/admin/shifts"
              className="px-3 py-1.5 bg-warning-600 hover:bg-warning-700 text-white text-sm rounded-lg whitespace-nowrap transition duration-250 focus-ring"
            >
              Open Shift
            </Link>
          </div>
        )}

        {/* Customer picker */}
        <div className="card-brand shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <User className="w-4 h-4" />
              Customer
              {activeMethod.requiresCustomer && (
                <span className="text-danger-500 text-sm">*</span>
              )}
            </h2>
            {customer && (
              <button
                onClick={() => handleSelectCustomer(null)}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1 transition duration-250 focus-ring rounded"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          {customer ? (
            <div className="flex items-center justify-between p-3 bg-brand-50 dark:bg-brand-900/20 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {customer.firstName} {customer.lastName}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {customer.email || customer.phoneNumber}
                  {typeof customer.loyaltyPoints === 'number' && (
                    <span className="ml-2 text-xs tabular-nums">
                      · {customer.loyaltyPoints} pts
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => handleSelectCustomer(null)}
                className="p-1.5 rounded hover:bg-brand-100 dark:hover:bg-brand-900/40 transition duration-250 focus-ring"
                aria-label="Remove customer"
              >
                <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search customer (or leave blank for walk-in)"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
              />
              {customerSearch && (
                <div className="absolute z-modal mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card max-h-64 overflow-y-auto custom-scrollbar">
                  {searchingCustomers ? (
                    <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2 text-brand-600" />
                      Searching...
                    </div>
                  ) : customerResults.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      No customers found
                    </div>
                  ) : (
                    customerResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleSelectCustomer(c)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition duration-250 focus-ring"
                      >
                        <p className="font-medium text-gray-900 dark:text-white">
                          {c.firstName} {c.lastName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {c.email || c.phoneNumber}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Item picker */}
        <div className="card-brand shadow-soft">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
            Add Items
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search products by name, SKU, or barcode"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
            />
            {itemSearch && (
              <div className="absolute z-modal mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card max-h-72 overflow-y-auto custom-scrollbar">
                {searchingItems ? (
                  <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2 text-brand-600" />
                    Searching...
                  </div>
                ) : itemResults.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    No products found
                  </div>
                ) : (
                  itemResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleAddItem(p)}
                      disabled={addingItemId === p.id}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 flex items-center justify-between transition duration-250 focus-ring"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {p.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                          {p.sku} · {formatCurrency(p.unitPrice)}
                        </p>
                      </div>
                      {addingItemId === p.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                      ) : (
                        <Plus className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Cart items */}
          {cart && cart.items.length > 0 && (
            <div className="mt-4 space-y-2">
              {cart.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {item.product?.name ?? 'Product'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      {item.variant?.name ? `${item.variant.name} · ` : ''}
                      {formatCurrency(item.unitPrice)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateQty(item.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 transition duration-250 focus-ring"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium tabular-nums text-gray-900 dark:text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleUpdateQty(item.id, item.quantity + 1)}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition duration-250 focus-ring"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <span className="w-20 text-right font-medium tabular-nums text-gray-900 dark:text-white">
                      {formatCurrency(item.total)}
                    </span>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1 rounded hover:bg-danger-100 dark:hover:bg-danger-900/30 ml-1 transition duration-250 focus-ring"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4 text-danger-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {cartLoading && (
            <div className="mt-4 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin mr-2 text-brand-600" />
              Loading cart...
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="card-brand shadow-soft">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Add any notes about this order..."
            className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 resize-none"
          />
        </div>
      </div>

      {/* RIGHT: totals + payment */}
      <div className="space-y-4">
        <div className="card-brand shadow-soft sticky top-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Order Summary
          </h2>

          {/* Totals */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Tax</span>
              <span className="tabular-nums">{formatCurrency(totals.tax)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-success-600 dark:text-success-400">
                <span>Discount</span>
                <span className="tabular-nums">-{formatCurrency(totals.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 dark:text-white pt-3 border-t border-gray-200 dark:border-gray-700 text-base">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(totals.total)}</span>
            </div>
          </div>

          {/* Manual discount */}
          <div className="mt-4">
            <label className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              <Percent className="w-3 h-3" />
              Extra discount
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={manualDiscount}
              onChange={(e) => setManualDiscount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
            />
          </div>

          {/* Payment method */}
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Payment Method
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => {
                const Icon = m.icon;
                const isActive = paymentMethod === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    disabled={!m.enabled}
                    onClick={() => setPaymentMethod(m.value as PaymentMethodValue)}
                    title={m.enabled ? m.label : `${m.label} — not yet available`}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs font-medium transition duration-250 focus-ring ${
                      isActive
                        ? 'bg-brand-gradient text-white border-brand-600 shadow-brand'
                        : m.enabled
                        ? 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        : 'bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Method-specific inputs */}
          {activeMethod.requiresPhone && (
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Mobile money phone number
              </label>
              <input
                type="tel"
                value={mobilePhone}
                onChange={(e) => setMobilePhone(e.target.value)}
                placeholder="+256 7XX XXX XXX"
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
              />
            </div>
          )}

          {activeMethod.requiresCode && (
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Gift card code
              </label>
              <input
                type="text"
                value={giftCardCode}
                onChange={(e) => setGiftCardCode(e.target.value)}
                placeholder="Enter code"
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
              />
            </div>
          )}

          {/* Paid amount — only for methods that take cash/amount upfront */}
          {['CASH', 'CREDIT_CARD', 'DEBIT_CARD'].includes(paymentMethod) && (
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Amount tendered
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
              />
              {totals.change > 0 && (
                <p className="text-xs text-success-600 dark:text-success-400 mt-1 tabular-nums">
                  Change: {formatCurrency(totals.change)}
                </p>
              )}
              {totals.balance > 0 && (
                <p className="text-xs text-danger-600 dark:text-danger-400 mt-1 tabular-nums">
                  Balance due: {formatCurrency(totals.balance)}
                </p>
              )}
            </div>
          )}

          {/* Complete button */}
          <button
            onClick={handleCompleteSale}
            disabled={submitting || shiftBlocked || !cart || cart.items.length === 0}
            className="mt-5 w-full btn-brand disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                Complete Sale — <span className="tabular-nums">{formatCurrency(totals.total)}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OrderForm;
