// packages/web/components/sales/POS/CheckoutModal.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  X,
  ArrowLeft,
  CreditCard,
  Banknote,
  Award,
  ExternalLink,
  Loader2,
  CheckCircle,
  AlertCircle,
  User,
  Sparkles,
} from 'lucide-react';

import {
  saleService,
  LOYALTY_POINT_VALUE,
  MAX_LOYALTY_DISCOUNT_FRACTION,
  computeLoyaltyCapacity,
  isDiscountType,
  getDiscountTypeLabel,
} from '../../../services/saleService';
import type {
  DiscountType,
  PaymentMethod as ServicePaymentMethod,
} from '../../../services/saleService';
import { toast } from '../../../utils/toast-manager';
import { formatCurrency } from '../../../utils/formatters';
import { formatPosCurrency } from './posDisplay';

// ============================================
// PUBLIC TYPES
// ============================================

/**
 * Payment methods the POS endpoint can settle directly. Mobile
 * money and gateway-backed methods must use the online checkout
 * flow so provider authorization is completed before the sale.
 */
export type CheckoutPaymentMethod =
  | 'CASH'
  | 'LOYALTY_POINTS'
  | 'GIFT_CARD'
  | 'BANK_TRANSFER'
  | 'CHECK';

export interface CheckoutCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  loyaltyPoints?: number;
}

export interface CheckoutShift {
  id: string;
  cashRegisterId: string;
}

export interface CheckoutDetails {
  paidAmount?: number;
  changeAmount?: number;
  notes?: string;
  reference?: string;
  loyaltyPointsUsed?: number;
  loyaltyDiscount?: number;
  promotionDiscount?: number;
  promotionCode?: string | null;
  discountType?: DiscountType | null;
}

export interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;

  total: number;

  /**
   * ISO 4217 ledger currency for `total`. The POS resolves it from
   * the cart, the shift's business unit, or the auth payload — in
   * that order — and passes it here. Never fabricate a code; if the
   * POS hasn't resolved one yet, it should not open the modal.
   */
  currency: string;

  cartId?: string;

  customer?: CheckoutCustomer | null;

  /** Pre-computed cart-level discount (promotion + loyalty). */
  discount?: number;

  shift?: CheckoutShift | null;

  notes?: string;

  /**
   * Promotion / loyalty passthrough. The modal forwards these
   * verbatim into `saleService.posCheckout` so the backend
   * persists the attribution on the `Sale` row instead of
   * inferring a possibly-wrong `discountType`.
   */
  discountType?: DiscountType | null;
  promotionCode?: string | null;
  promotionDiscount?: number;

  /**
   * Loyalty points the cashier has chosen to redeem. When omitted
   * the modal defaults to the max-redeemable amount for the
   * customer's balance. The actual redemption is capped
   * server-side, so a value that is too high just gets clipped.
   */
  loyaltyPointsUsed?: number;
  /** Currency value of `loyaltyPointsUsed`. Forwarded for receipt text. */
  loyaltyDiscount?: number;

  /**
   * Payer's chosen display currency (ISO 4217). Recorded on the
   * `Payment` row as an audit fact. Never mutates any amount.
   */
  displayCurrency?: string | null;

  idempotencyKey?: string;

  onPaymentComplete: (
    result: any,
    method: CheckoutPaymentMethod,
    details: CheckoutDetails,
  ) => void | Promise<void>;

  onCancel?: () => void;
  onOnlineCheckout?: () => void;

  isProcessing?: boolean;
}

// ============================================
// INTERNAL CONFIG
// ============================================

interface MethodConfig {
  id: CheckoutPaymentMethod;
  label: string;
  description: string;
  icon: React.ElementType;
  /** When true, the tile is only enabled if a customer is attached. */
  requiresCustomer?: boolean;
}

/**
 * The POS method grid. Gateway-backed methods are absent by design
 * — the backend rejects them on `/sales/pos/checkout` and the
 * cashier's correct action is to route the customer to the online
 * checkout, not to try harder on the POS.
 *
 * ⚠ Keep this list in sync with `PaymentMethod` in the frontend
 *   `saleService.ts` and `REMOTE_GATEWAY_METHODS` in the backend
 *   `saleController.ts`.
 */
const PAYMENT_METHODS: MethodConfig[] = [
  {
    id: 'CASH',
    label: 'Cash',
    description: 'Physical cash payment',
    icon: Banknote,
  },
  {
    id: 'LOYALTY_POINTS',
    label: 'Loyalty Points',
    description: 'Redeem customer points',
    icon: Award,
    requiresCustomer: true,
  },
  {
    id: 'GIFT_CARD',
    label: 'Gift Card',
    description: 'Redeem a gift card',
    icon: CreditCard,
  },
  {
    id: 'BANK_TRANSFER',
    label: 'Bank Transfer',
    description: 'Direct bank deposit',
    icon: CreditCard,
  },
  {
    id: 'CHECK',
    label: 'Check',
    description: 'Paper check',
    icon: CreditCard,
  },
];

/**
 * Methods the modal refuses to submit. The backend rejects them
 * with a 400 on the POS endpoint. Listed here so the modal can
 * pre-empt with a clear, actionable message.
 */
const GATEWAY_METHODS_TO_REJECT = new Set<string>([
  'CARD',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'PAYPAL',
  'FLUTTERWAVE',
  'PAYSTACK',
  'SQUARE',
]);

const QUICK_CASH_DENOMINATIONS = [5, 10, 20, 50, 100] as const;

const PAID_AMOUNT_PATTERN = /^\d*(\.\d{0,2})?$/;

function extractErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  const anyErr = error as any;
  const data = anyErr?.response?.data;

  if (data) {
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors
        .map((entry: any) => {
          const field =
            entry.field ??
            (Array.isArray(entry.path) ? entry.path.join('.') : undefined) ??
            'Field';
          return `${field}: ${entry.message ?? 'Invalid value'}`;
        })
        .join('; ');
    }
    if (typeof data.error === 'string') return data.error;
    if (data.error?.message) return String(data.error.message);
    if (data.message) return String(data.message);
  }

  if (anyErr?.message) return String(anyErr.message);
  return fallback;
}

// ============================================
// COMPONENT
// ============================================

export function CheckoutModal({
  isOpen,
  onClose,
  total,
  currency,
  cartId,
  customer = null,
  discount = 0,
  shift = null,
  notes: initialNotes = '',
  discountType = null,
  promotionCode = null,
  promotionDiscount = 0,
  loyaltyPointsUsed: loyaltyPointsUsedProp,
  loyaltyDiscount: loyaltyDiscountProp,
  displayCurrency = null,
  idempotencyKey,
  onPaymentComplete,
  onCancel,
  onOnlineCheckout,
  isProcessing: externalProcessing = false,
}: CheckoutModalProps) {
  const [method, setMethod] = useState<CheckoutPaymentMethod>('CASH');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>(initialNotes);
  const [internalProcessing, setInternalProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Loyalty points to redeem. ───────────────────────────────
  // Defaults to the max-redeemable amount for the customer's
  // balance, capped by the modal's own `MAX_LOYALTY_DISCOUNT_FRACTION`
  // rule. The cashier can lower it.
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState<number>(0);

  const submittedKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const paidAmountInputRef = useRef<HTMLInputElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const notesTouchedRef = useRef(false);
  const wasOpenRef = useRef(false);

  const processing = externalProcessing || internalProcessing;

  // ---------- Reset on open ----------
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (isOpen && !wasOpen) {
      setMethod('CASH');
      setPaidAmount('');
      setReference('');
      setNotes(initialNotes);
      setError(null);
      setInternalProcessing(false);
      submittedKeyRef.current = null;
      inFlightRef.current = false;
      notesTouchedRef.current = false;
      // Loyalty points reset is handled by the effect below, which
      // runs after the customer's balance is known.
      setLoyaltyPointsToRedeem(0);
    }
  }, [isOpen, initialNotes]);

  // Adopt caller-supplied `initialNotes` only until the cashier
  // edits the textarea.
  useEffect(() => {
    if (!isOpen) return;
    if (notesTouchedRef.current) return;
    setNotes(initialNotes);
  }, [initialNotes, isOpen]);

  useEffect(() => {
    if (!isOpen) notesTouchedRef.current = false;
  }, [isOpen]);

  // ---------- Focus management ----------
  useEffect(() => {
    if (!isOpen) return;
    if (typeof document === 'undefined') return;

    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement) ?? null;

    const t = setTimeout(() => {
      (paidAmountInputRef.current ?? containerRef.current)?.focus();
    }, 0);

    return () => {
      clearTimeout(t);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen]);

  // ---------- Derived numbers ----------
  const paidNumber = useMemo(() => {
    const n = parseFloat(paidAmount);
    return Number.isFinite(n) ? n : 0;
  }, [paidAmount]);

  const changeAmount = useMemo(
    () => Math.max(0, paidNumber - total),
    [paidNumber, total],
  );

  const cashInsufficient = method === 'CASH' && paidNumber < total;

  // Max points the customer can apply to this order. Server enforces
  // the same cap, so an over-large value just gets clipped on the
  // backend — but capping on the client gives a truthful preview.
  const loyaltyCapacity = useMemo(
    () => computeLoyaltyCapacity(total, customer?.loyaltyPoints ?? 0),
    [total, customer?.loyaltyPoints],
  );

  // Sync the redeem amount the first time we know the capacity.
  // Once the cashier edits it, we keep their value.
  useEffect(() => {
    if (!isOpen) return;
    // If the caller supplied an explicit amount, use that.
    if (typeof loyaltyPointsUsedProp === 'number') {
      setLoyaltyPointsToRedeem(
        Math.min(
          Math.max(0, Math.floor(loyaltyPointsUsedProp)),
          loyaltyCapacity.redeemablePoints,
        ),
      );
      return;
    }
    // Otherwise default to the max redeemable for the customer.
    setLoyaltyPointsToRedeem(loyaltyCapacity.redeemablePoints);
  }, [isOpen, loyaltyPointsUsedProp, loyaltyCapacity.redeemablePoints]);

  const loyaltyPointsRequired = loyaltyPointsToRedeem;
  const loyaltyDiscount = useMemo(
    () =>
      Math.round(loyaltyPointsRequired * LOYALTY_POINT_VALUE * 100) / 100,
    [loyaltyPointsRequired],
  );

  const loyaltyInsufficient = useMemo(() => {
    if (method !== 'LOYALTY_POINTS') return false;
    return (customer?.loyaltyPoints ?? 0) < loyaltyPointsRequired;
  }, [method, customer?.loyaltyPoints, loyaltyPointsRequired]);

  const breakdownPreview = useMemo(() => {
    const hasPromotion = promotionDiscount > 0;
    const hasLoyalty = loyaltyDiscount > 0;
    if (!hasPromotion && !hasLoyalty) return null;
    return saleService.describeBreakdown({
      promotionDiscount,
      promotionCode,
      loyaltyPointsUsed: loyaltyPointsRequired,
      loyaltyDiscount,
    });
  }, [
    promotionDiscount,
    promotionCode,
    loyaltyPointsRequired,
    loyaltyDiscount,
  ]);

  // ---------- Handlers ----------
  const handleClose = useCallback(() => {
    if (processing) return;
    try {
      onCancel?.();
    } catch (err) {
      console.error('onCancel handler threw:', err);
    }
    onClose();
  }, [processing, onCancel, onClose]);

  const handleQuickCash = useCallback((amount: number) => {
    setPaidAmount(amount.toFixed(2));
    setError(null);
  }, []);

  const handlePaidAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      if (next === '' || PAID_AMOUNT_PATTERN.test(next)) {
        setPaidAmount(next);
      }
    },
    [],
  );

  /**
   * Submit the POS checkout.
   *
   * ⚠ This is the ONLY path the POS uses. It calls
   *   `saleService.posCheckout(...)`, which routes to
   *   `POST /sales/pos/checkout`. Do NOT swap this for
   *   `checkoutService.processCheckout(...)` — that endpoint is
   *   `/checkout` (online), which creates a PENDING sale and waits
   *   for a gateway webhook. POS sales are ledger-native and must
   *   complete immediately.
   */
  const handleSubmit = useCallback(async () => {
    setError(null);

    if (inFlightRef.current) return;
    if (processing) return;

    if (!shift) {
      setError('Please open a shift before processing a sale.');
      return;
    }
    if (!cartId) {
      setError('No cart is attached to this checkout.');
      return;
    }

    // Pre-empt gateway-backed methods with a clear message.
    if (GATEWAY_METHODS_TO_REJECT.has(method)) {
      setError(
        `${method} requires gateway authorization. Use the online checkout instead.`,
      );
      return;
    }

    if (method === 'CASH' && cashInsufficient) {
      setError('Paid amount is less than the total.');
      return;
    }
    if (method === 'LOYALTY_POINTS' && loyaltyInsufficient) {
      setError('Customer does not have enough loyalty points.');
      return;
    }

    const key = idempotencyKey ?? null;
    if (key && submittedKeyRef.current === key) {
      return;
    }

    const effectivePaidAmount = method === 'CASH' ? paidNumber : total;

    // ── Normalize the passthrough ──────────────────────────────
    // `discountType` is narrowed to the union the service accepts.
    // Any other value is dropped so the backend can still infer a
    // valid one from the amounts.
    const safeDiscountType: DiscountType | null =
      discountType !== null &&
      discountType !== undefined &&
      isDiscountType(discountType)
        ? discountType
        : null;

    // Total discount = the cart's own discount + the loyalty
    // discount the cashier selected in this modal. The cart already
    // included the loyalty discount when the cashier pre-applied
    // it, so if `loyaltyDiscountProp` matches the cart value we
    // pass `discount` through unchanged; otherwise we add the
    // delta.
    const cartLoyalty =
      typeof loyaltyDiscountProp === 'number' ? loyaltyDiscountProp : 0;
    const extraLoyalty = Math.max(0, loyaltyDiscount - cartLoyalty);
    const effectiveDiscount = Math.round((discount + extraLoyalty) * 100) / 100;

    const paymentMethod: ServicePaymentMethod =
      method as ServicePaymentMethod;

    inFlightRef.current = true;
    setInternalProcessing(true);

    let checkoutResult: any;
    try {
      checkoutResult = await saleService.posCheckout({
        cartId,
        paymentMethod,
        paidAmount: effectivePaidAmount,
        customerId: customer?.id,
        discount: effectiveDiscount,
        notes: notes.trim() || undefined,
        cashRegisterId: shift.cashRegisterId,
        cashRegisterSessionId: shift.id,
        applyLoyaltyPoints:
          method === 'LOYALTY_POINTS' || loyaltyPointsRequired > 0,
        idempotencyKey,
        displayCurrency: displayCurrency ?? null,

        // Promotion / loyalty passthrough. These ride through
        // to the Sale row's discountType, promotionCode,
        // promotionDiscount, loyaltyPointsUsed, loyaltyDiscount
        // columns.
        discountType: safeDiscountType ?? undefined,
        promotionCode: promotionCode ?? undefined,
        promotionDiscount:
          promotionDiscount > 0 ? promotionDiscount : undefined,
      });
    } catch (err) {
      const message = extractErrorMessage(
        err,
        'Checkout failed. Please try again.',
      );
      console.error('[CheckoutModal] POS checkout failed:', message);
      setError(message);
      toast.error(message);

      inFlightRef.current = false;
      setInternalProcessing(false);
      return;
    }

    if (key) submittedKeyRef.current = key;

    const details: CheckoutDetails = {
      paidAmount: effectivePaidAmount,
      changeAmount: method === 'CASH' ? changeAmount : 0,
      notes: notes.trim() || undefined,
      reference: reference.trim() || undefined,
      loyaltyPointsUsed:
        loyaltyPointsRequired > 0 ? loyaltyPointsRequired : undefined,
      loyaltyDiscount: loyaltyDiscount > 0 ? loyaltyDiscount : undefined,
      promotionDiscount:
        promotionDiscount > 0 ? promotionDiscount : undefined,
      promotionCode: promotionCode ?? null,
      discountType: safeDiscountType,
    };

    try {
      await onPaymentComplete(checkoutResult, method, details);
    } catch (callbackErr) {
      console.error(
        '[CheckoutModal] onPaymentComplete callback failed:',
        callbackErr,
      );
      toast.error(
        'Payment succeeded, but the post-checkout action failed. Do not retry the payment.',
      );
    } finally {
      inFlightRef.current = false;
      setInternalProcessing(false);
    }
  }, [
    processing,
    shift,
    cartId,
    method,
    cashInsufficient,
    loyaltyInsufficient,
    paidNumber,
    total,
    customer?.id,
    discount,
    notes,
    reference,
    changeAmount,
    idempotencyKey,
    discountType,
    promotionCode,
    promotionDiscount,
    loyaltyPointsRequired,
    loyaltyDiscount,
    loyaltyDiscountProp,
    displayCurrency,
    onPaymentComplete,
  ]);

  // ---------- Keyboard shortcuts ----------
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!processing) void handleSubmit();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, processing, handleClose, handleSubmit]);

  if (!isOpen) return null;

  // ---------- Render ----------
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700 outline-none"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={processing}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              title="Back"
              aria-label="Back"
            >
              <ArrowLeft
                className="w-5 h-5 text-gray-600 dark:text-gray-400"
                aria-hidden="true"
              />
            </button>
            <div>
              <h2
                id="checkout-modal-title"
                className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"
              >
                <CreditCard
                  className="w-5 h-5 text-blue-500"
                  aria-hidden="true"
                />
                Complete Payment
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total due:{' '}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(total, currency)}
                </span>
                {discount > 0 && (
                  <span className="ml-2 text-green-600 dark:text-green-400">
                    (Discount: -{formatCurrency(discount, currency)})
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={processing}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {customer && (
            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
              <User
                className="w-4 h-4 flex-shrink-0"
                aria-hidden="true"
              />
              <span className="font-medium">
                {customer.firstName} {customer.lastName}
              </span>
              {typeof customer.loyaltyPoints === 'number' && (
                <>
                  <span className="text-gray-400 dark:text-gray-500">|</span>
                  <span>Points: {customer.loyaltyPoints}</span>
                </>
              )}
            </div>
          )}

          {breakdownPreview && (
            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
              <Sparkles
                className="w-4 h-4 flex-shrink-0"
                aria-hidden="true"
              />
              <span className="font-medium">{breakdownPreview}</span>
              {promotionCode && (
                <code className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-[11px] font-mono">
                  {promotionCode}
                </code>
              )}
              {isDiscountType(discountType) && (
                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                  {getDiscountTypeLabel(discountType)}
                </span>
              )}
            </div>
          )}

          {!shift && (
            <div
              role="alert"
              className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg px-3 py-2"
            >
              <AlertCircle
                className="w-4 h-4 flex-shrink-0"
                aria-hidden="true"
              />
              <span>No open shift. Please open a shift first.</span>
            </div>
          )}

          {/* Payment method grid */}
          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Method
            </span>
            <div
              role="radiogroup"
              aria-label="Payment method"
              className="grid grid-cols-2 sm:grid-cols-3 gap-2"
            >
              {PAYMENT_METHODS.map((m) => {
                const Icon = m.icon;
                const active = method === m.id;
                const disabled =
                  (m.requiresCustomer && !customer) || processing;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => !disabled && setMethod(m.id)}
                    disabled={disabled}
                    className={`p-3 rounded-lg border text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      active
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 mb-1 ${
                        active
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                      aria-hidden="true"
                    />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {m.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {m.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cash tender */}
          {method === 'CASH' && (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="checkout-paid-amount"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Amount Paid
                </label>
                <div className="relative">
                  <Banknote
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    ref={paidAmountInputRef}
                    id="checkout-paid-amount"
                    type="text"
                    inputMode="decimal"
                    value={paidAmount}
                    onChange={handlePaidAmountChange}
                    placeholder={total.toFixed(2)}
                    aria-invalid={cashInsufficient}
                    aria-describedby={
                      cashInsufficient
                        ? 'checkout-paid-amount-validation'
                        : undefined
                    }
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums"
                    disabled={processing}
                    autoFocus
                  />
                </div>
                {cashInsufficient && (
                  <p
                    id="checkout-paid-amount-validation"
                    className="mt-1 text-sm text-red-600 dark:text-red-400"
                    aria-live="polite"
                  >
                    Amount received must be at least{' '}
                    {formatCurrency(total, currency)}.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickCash(total)}
                  disabled={processing}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Exact ({formatCurrency(total, currency)})
                </button>
                {QUICK_CASH_DENOMINATIONS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => handleQuickCash(v)}
                    disabled={processing}
                    className={`px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 ${
                      v >= total
                        ? 'border-success-400 dark:border-success-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    +{v}
                  </button>
                ))}
              </div>

              {paidNumber >= total && paidNumber > 0 && (
                <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <span className="text-sm text-green-700 dark:text-green-300">
                    Change
                  </span>
                  <span className="text-lg font-bold text-green-700 dark:text-green-300 tabular-nums">
                    {formatCurrency(changeAmount, currency)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Gift card reference */}
          {method === 'GIFT_CARD' && (
            <div>
              <label
                htmlFor="checkout-giftcard-reference"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Gift Card Number
              </label>
              <input
                id="checkout-giftcard-reference"
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. GC-001-234-567"
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={processing}
              />
            </div>
          )}

          {/* Bank transfer reference */}
          {method === 'BANK_TRANSFER' && (
            <div>
              <label
                htmlFor="checkout-bank-reference"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Transfer Reference
              </label>
              <input
                id="checkout-bank-reference"
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. TXN-2025-001"
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={processing}
              />
            </div>
          )}

          {/* Check reference */}
          {method === 'CHECK' && (
            <div>
              <label
                htmlFor="checkout-check-reference"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Check Number
              </label>
              <input
                id="checkout-check-reference"
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. 000123"
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={processing}
              />
            </div>
          )}

          {/* Loyalty points */}
          {method === 'LOYALTY_POINTS' && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-2 text-sm">
              <div>
                <label
                  htmlFor="checkout-loyalty-points"
                  className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
                >
                  Points to Redeem
                </label>
                <input
                  id="checkout-loyalty-points"
                  type="number"
                  min={0}
                  max={loyaltyCapacity.redeemablePoints}
                  value={loyaltyPointsToRedeem}
                  onChange={(e) => {
                    const raw = parseInt(e.target.value, 10);
                    const n = Number.isFinite(raw) ? raw : 0;
                    setLoyaltyPointsToRedeem(
                      Math.max(
                        0,
                        Math.min(n, loyaltyCapacity.redeemablePoints),
                      ),
                    );
                  }}
                  disabled={processing}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white tabular-nums"
                />
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Max Redeemable
                </span>
                <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                  {loyaltyCapacity.redeemablePoints}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Available
                </span>
                <span
                  className={`font-medium tabular-nums ${
                    loyaltyInsufficient
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}
                >
                  {customer?.loyaltyPoints ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Conversion
                </span>
                <span className="text-gray-900 dark:text-white tabular-nums">
                  1 pt = {formatCurrency(LOYALTY_POINT_VALUE, currency)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                <span className="text-gray-600 dark:text-gray-400">
                  Discount Applied
                </span>
                <span className="font-medium text-green-600 dark:text-green-400 tabular-nums">
                  -{formatCurrency(loyaltyDiscount, currency)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                <span>
                  Max discount ({Math.round(MAX_LOYALTY_DISCOUNT_FRACTION * 100)}%)
                </span>
                <span className="tabular-nums">
                  {formatCurrency(
                    total * MAX_LOYALTY_DISCOUNT_FRACTION,
                    currency,
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label
              htmlFor="checkout-notes"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Notes (optional)
            </label>
            <textarea
              id="checkout-notes"
              value={notes}
              onChange={(e) => {
                notesTouchedRef.current = true;
                setNotes(e.target.value);
              }}
              rows={2}
              placeholder="Any additional information…"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              disabled={processing}
            />
          </div>

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2"
            >
              <AlertCircle
                className="w-4 h-4 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{error}</span>
            </div>
          )}

          {/* Totals footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Total</span>
              <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(total, currency)}
              </span>
            </div>
            {method === 'LOYALTY_POINTS' && loyaltyDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-600 dark:text-green-400">
                  Loyalty ({loyaltyPointsRequired} pts)
                </span>
                <span className="text-green-600 dark:text-green-400 tabular-nums">
                  -{formatCurrency(loyaltyDiscount, currency)}
                </span>
              </div>
            )}
            {method === 'CASH' && paidNumber > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Paid
                  </span>
                  <span className="text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(paidNumber, currency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Change
                  </span>
                  <span className="text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(changeAmount, currency)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={processing}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          {onOnlineCheckout && (
            <button
              type="button"
              onClick={onOnlineCheckout}
              disabled={processing}
              className="px-4 py-2 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              More payment options
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={
              processing ||
              !shift ||
              !cartId ||
              (method === 'CASH' && cashInsufficient) ||
              (method === 'LOYALTY_POINTS' && loyaltyInsufficient)
            }
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
              <Loader2
                className="w-4 h-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <CheckCircle className="w-4 h-4" aria-hidden="true" />
            )}
            {processing ? 'Processing…' : 'Complete Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CheckoutModal;
