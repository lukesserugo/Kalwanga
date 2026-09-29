// packages/web/components/checkout/CheckoutModal.tsx
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
  DollarSign,
  Smartphone,
  Award,
  Loader2,
  CheckCircle,
  AlertCircle,
  User,
  Sparkles,
} from 'lucide-react';

import { checkoutService } from '../../../services/checkoutService';
import {
  saleService,
  LOYALTY_POINT_VALUE,
  MAX_LOYALTY_DISCOUNT_FRACTION,
  computeLoyaltyCapacity,
  isDiscountType,
  getDiscountTypeLabel,
} from '../../../services/saleService';
import type { DiscountType } from '../../../services/saleService';
import { toast } from '../../../utils/toast-manager';
import { formatCurrency } from '../../../utils/formatters';

// ============================================
// TYPES
// ============================================

export type CheckoutPaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'MOBILE_MONEY'
  | 'LOYALTY_POINTS';

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
}

export interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;

  /** Total amount to charge (after tax and discount). */
  total: number;

  /**
   * Cart id — passed through to `checkoutService.processCheckout`.
   *
   * ⚠ Required by the backend. `SaleService.createSaleFromCart`
   *   rejects a missing `cartId` with a 400. The modal guards on
   *   this locally so the user sees a clear message instead of an
   *   axios error.
   */
  cartId?: string;

  /** Optional customer attached to the sale. */
  customer?: CheckoutCustomer | null;

  /**
   * Discount already applied to the cart (display only here).
   *
   * ⚠ The modal forwards this value to the backend as `discount`.
   *   The backend reduces the total by `discount` *again*, so
   *   `total` should already include or exclude this discount
   *   consistently with how the backend treats it. See the note
   *   below.
   */
  discount?: number;

  /** Active shift — required to process a sale. */
  shift?: CheckoutShift | null;

  /** Optional notes forwarded to checkoutService. */
  notes?: string;

  /**
   * Promotion / loyalty passthrough.
   *
   * `discountType` is typed as the 4-member Prisma `DiscountType`
   * enum — the same union `posController.posCheckoutSchema` enforces
   * with Zod. If the caller needs to pass a string that isn't a
   * member (e.g. from a URL parameter), narrow it first.
   */
  discountType?: DiscountType | null;
  promotionCode?: string | null;
  promotionDiscount?: number;

  /**
   * Optional caller-owned idempotency key. When provided, the modal
   * forwards it to the backend as the `Idempotency-Key` header; a
   * retry with the same key returns the original sale.
   *
   * Lifecycle belongs to the caller:
   *   - Caller generates a key when the operator initiates a sale.
   *   - Same key on every retry of that sale.
   *   - Caller clears the key after a successful checkout.
   *   - Caller clears the key when the operator abandons the attempt.
   *
   * The modal forwards it verbatim. It never generates or clears it.
   */
  idempotencyKey?: string;

  /**
   * Called after checkout succeeds.
   * Receives the raw result from checkoutService.processCheckout.
   */
  onPaymentComplete: (
    result: any,
    method: CheckoutPaymentMethod,
    details: CheckoutDetails
  ) => void | Promise<void>;

  /** Called when the user cancels / closes the modal. */
  onCancel?: () => void;

  /** External processing lock (e.g. from a parent that owns the request). */
  isProcessing?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

interface MethodConfig {
  id: CheckoutPaymentMethod;
  label: string;
  description: string;
  icon: React.ElementType;
}

const PAYMENT_METHODS: MethodConfig[] = [
  {
    id: 'CASH',
    label: 'Cash',
    description: 'Physical cash payment',
    icon: DollarSign,
  },
  {
    id: 'CARD',
    label: 'Card',
    description: 'Credit or debit card',
    icon: CreditCard,
  },
  {
    id: 'MOBILE_MONEY',
    label: 'Mobile Money',
    description: 'MTN / Airtel / M-Pesa',
    icon: Smartphone,
  },
  {
    id: 'LOYALTY_POINTS',
    label: 'Loyalty Points',
    description: 'Redeem customer points',
    icon: Award,
  },
];

/**
 * Canonical payment-method list for the POS route.
 * Mirrors `CANONICAL_PAYMENT_METHODS_SET` in the backend.
 */
const CANONICAL_METHODS_SET = new Set<string>([
  'CASH',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'MOBILE_MONEY',
  'BANK_TRANSFER',
  'GIFT_CARD',
  'LOYALTY_POINTS',
  'CHECK',
  'CARD',
]);

const QUICK_CASH_DENOMINATIONS = [5, 10, 20, 50, 100] as const;

/**
 * Only digits and at most two decimal places. Used to reject garbage
 * like "10.5.5" before it reaches `parseFloat`, which would silently
 * read that as `10.5`.
 */
const PAID_AMOUNT_PATTERN = /^\d*(\.\d{0,2})?$/;

// ============================================
// HELPERS
// ============================================

function extractErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  const anyErr = error as any;
  const data = anyErr?.response?.data;

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
  cartId,
  customer = null,
  discount = 0,
  shift = null,
  notes: initialNotes = '',
  discountType = null,
  promotionCode = null,
  promotionDiscount = 0,
  idempotencyKey,
  onPaymentComplete,
  onCancel,
  isProcessing: externalProcessing = false,
}: CheckoutModalProps) {
  const [method, setMethod] = useState<CheckoutPaymentMethod>('CASH');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>(initialNotes);
  const [internalProcessing, setInternalProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Guard against a duplicate `onPaymentComplete` invocation when the
   * operator double-clicks. The backend dedupes on `idempotencyKey`;
   * the modal must dedupe on its side too, or the parent's success
   * handler runs twice (double receipt print, double cart clear,
   * double route push).
   */
  const submittedKeyRef = useRef<string | null>(null);

  /**
   * Synchronous in-flight guard. `internalProcessing` from state is
   * stale inside a single render — two rapid clicks both see
   * `false`. A ref updated synchronously can't be raced.
   */
  const inFlightRef = useRef(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const processing = externalProcessing || internalProcessing;

  // ── Reset internal state on the open transition ───────────
  //
  // Keyed on the false → true transition of `isOpen`, NOT on every
  // change of `isOpen` or `initialNotes`. The previous version
  // re-ran the whole reset whenever `initialNotes` changed while the
  // modal was open, wiping the operator's in-progress cash amount.

  const wasOpenRef = useRef(false);
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
    }
  }, [isOpen, initialNotes]);

  // Keep `notes` in sync if the parent supplies a fresh value while
  // the operator hasn't typed anything.
  const notesTouchedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) return;
    if (notesTouchedRef.current) return;
    setNotes(initialNotes);
  }, [initialNotes, isOpen]);

  // Reset the touched flag when the modal closes so the next open
  // starts fresh.
  useEffect(() => {
    if (!isOpen) notesTouchedRef.current = false;
  }, [isOpen]);

  // ── Focus management ──────────────────────────────────────
  //
  // Remember what had focus before the modal opened, move focus into
  // the modal, and restore on close. A full focus trap is out of
  // scope; this at least gets the keyboard user into the modal and
  // back to where they were.

  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (typeof document === 'undefined') return;

    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement) ?? null;

    const t = setTimeout(() => {
      containerRef.current?.focus();
    }, 0);

    return () => {
      clearTimeout(t);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen]);

  // ============================================
  // DERIVED
  // ============================================

  const paidNumber = useMemo(() => {
    const n = parseFloat(paidAmount);
    return Number.isFinite(n) ? n : 0;
  }, [paidAmount]);

  const changeAmount = useMemo(
    () => Math.max(0, paidNumber - total),
    [paidNumber, total],
  );

  const cashInsufficient = method === 'CASH' && paidNumber < total;

  /**
   * Points required to cover the total, using the SAME calculation
   * the frontend service uses (`computeLoyaltyCapacity`), which in
   * turn mirrors the backend's `checkoutService.processCheckout`.
   *
   * Using the service helper directly (instead of re-deriving the
   * formula here) is what keeps the display in lockstep with what
   * the backend will actually consume. The earlier version used a
   * `Math.ceil` on the wrong side of the cap and disagreed with the
   * server by one point on some totals.
   */
  const loyaltyCapacity = useMemo(
    () =>
      computeLoyaltyCapacity(total, customer?.loyaltyPoints ?? 0),
    [total, customer?.loyaltyPoints],
  );

  const loyaltyPointsRequired = loyaltyCapacity.redeemablePoints;

  const loyaltyInsufficient = useMemo(() => {
    if (method !== 'LOYALTY_POINTS') return false;
    return (customer?.loyaltyPoints ?? 0) < loyaltyPointsRequired;
  }, [method, customer?.loyaltyPoints, loyaltyPointsRequired]);

  const breakdownPreview = useMemo(() => {
    if (!saleService.hasBreakdown({ promotionDiscount })) return null;
    return saleService.describeBreakdown({
      promotionDiscount,
      promotionCode,
    });
  }, [promotionDiscount, promotionCode]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleClose = useCallback(() => {
    if (processing) return;

    // Guard against a throwing `onCancel` blocking `onClose`. The
    // modal must always close when the user dismisses it.
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
      // Allow the empty string while typing, but reject anything
      // that isn't a partial decimal number. Rejecting here means
      // `parseFloat` never has to silently discard trailing garbage.
      if (next === '' || PAID_AMOUNT_PATTERN.test(next)) {
        setPaidAmount(next);
      }
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    setError(null);

    // Synchronous guard — prevents double submission even if state
    // hasn't re-rendered yet.
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

    if (!CANONICAL_METHODS_SET.has(method)) {
      setError(`Unsupported payment method: ${method}`);
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

    // Idempotency self-guard. If the caller supplied a key and we've
    // already successfully submitted with it during this modal's
    // open lifetime, treat the second submit as a no-op.
    const key = idempotencyKey ?? null;
    if (key && submittedKeyRef.current === key) {
      return;
    }

    // Zero is legitimate for non-cash methods (loyalty-only /
    // fully-discounted). For cash we've already validated
    // paidNumber >= total. Never coerce with `|| total`.
    const effectivePaidAmount = method === 'CASH' ? paidNumber : total;

    // Guard the enum before forwarding. If the parent passed a
    // legacy string that isn't a Prisma enum member, drop it — the
    // backend infers a valid type instead.
    const safeDiscountType: DiscountType | null =
      discountType !== null &&
      discountType !== undefined &&
      isDiscountType(discountType)
        ? discountType
        : null;

    inFlightRef.current = true;
    setInternalProcessing(true);

    let checkoutResult: any;
    try {
      checkoutResult = await checkoutService.processCheckout({
        cartId,
        customerId: customer?.id,
        paymentMethod: method,
        paidAmount: effectivePaidAmount,
        discount,
        notes: notes.trim() || undefined,
        cashRegisterId: shift.cashRegisterId,
        cashRegisterSessionId: shift.id,
        applyLoyaltyPoints: method === 'LOYALTY_POINTS',
        // Forward the caller-owned key so the backend persists /
        // dedupes on it. When undefined, behavior is unchanged.
        idempotencyKey,
        // Forward the promotion passthrough. `null` means "let the
        // backend infer". `undefined` and `null` are treated the
        // same by the backend's `readPromotionFields`.
        discountType: safeDiscountType,
        promotionCode: promotionCode ?? undefined,
        promotionDiscount: promotionDiscount || undefined,
      });
    } catch (err) {
      const message = extractErrorMessage(
        err,
        'Checkout failed. Please try again.',
      );
      console.error('[CheckoutModal] checkout failed:', message);
      setError(message);
      toast.error(message);

      inFlightRef.current = false;
      setInternalProcessing(false);
      return;
    }

    // The sale has been created on the server. Everything from here
    // is post-processing — record the key so a duplicate submit
    // can't re-run it.
    if (key) submittedKeyRef.current = key;

    const details: CheckoutDetails = {
      paidAmount: effectivePaidAmount,
      changeAmount: method === 'CASH' ? changeAmount : 0,
      notes: notes.trim() || undefined,
      reference: reference.trim() || undefined,
      loyaltyPointsUsed:
        method === 'LOYALTY_POINTS' ? loyaltyPointsRequired : undefined,
    };

    try {
      await onPaymentComplete(checkoutResult, method, details);
      toast.success('Checkout completed successfully!');
    } catch (callbackErr) {
      // The sale succeeded — only the parent's post-processing
      // failed. Surface the distinction so the operator knows not to
      // retry the payment.
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
    onPaymentComplete,
  ]);

  // ── Keyboard: Esc closes, Cmd/Ctrl+Enter submits ──────────

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

  // ============================================
  // RENDER
  // ============================================

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
                  {formatCurrency(total)}
                </span>
                {discount > 0 && (
                  <span className="ml-2 text-green-600 dark:text-green-400">
                    (Discount: -{formatCurrency(discount)})
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

        <div className="p-6 space-y-5">
          {/* Customer */}
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

          {/* Promotion preview */}
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

          {/* Shift missing warning */}
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

          {/* Payment method selector */}
          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Method
            </span>
            <div
              role="radiogroup"
              aria-label="Payment method"
              className="grid grid-cols-2 sm:grid-cols-4 gap-2"
            >
              {PAYMENT_METHODS.map((m) => {
                const Icon = m.icon;
                const active = method === m.id;
                const disabled = m.id === 'LOYALTY_POINTS' && !customer;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => !disabled && setMethod(m.id)}
                    disabled={disabled || processing}
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

          {/* Method-specific fields */}
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
                  <DollarSign
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="checkout-paid-amount"
                    type="text"
                    inputMode="decimal"
                    value={paidAmount}
                    onChange={handlePaidAmountChange}
                    placeholder={total.toFixed(2)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums"
                    disabled={processing}
                    autoFocus
                  />
                </div>
              </div>

              {/* Quick-cash shortcuts.
                  These are tender-amount shortcuts, not minimums.
                  A $5 button on a $20 sale sets paid to $5 — the
                  operator adds more cash and clicks again. The
                  previous version disabled them below the total,
                  blocking that flow. */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickCash(total)}
                  disabled={processing}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Exact ({formatCurrency(total)})
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
                    ${v}
                  </button>
                ))}
              </div>

              {paidNumber >= total && paidNumber > 0 && (
                <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <span className="text-sm text-green-700 dark:text-green-300">
                    Change
                  </span>
                  <span className="text-lg font-bold text-green-700 dark:text-green-300 tabular-nums">
                    {formatCurrency(changeAmount)}
                  </span>
                </div>
              )}
            </div>
          )}

          {method === 'CARD' && (
            <div>
              <label
                htmlFor="checkout-card-reference"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Reference / Last 4 digits
              </label>
              <input
                id="checkout-card-reference"
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. 4242"
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={processing}
              />
            </div>
          )}

          {method === 'MOBILE_MONEY' && (
            <div>
              <label
                htmlFor="checkout-mobile-reference"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Transaction Reference
              </label>
              <input
                id="checkout-mobile-reference"
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. MP123456789"
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={processing}
              />
            </div>
          )}

          {method === 'LOYALTY_POINTS' && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Points Required
                </span>
                <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                  {loyaltyPointsRequired}
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
                  1 pt = {formatCurrency(LOYALTY_POINT_VALUE)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-200 dark:border-gray-600">
                <span>Max discount</span>
                <span className="tabular-nums">
                  {formatCurrency(total * MAX_LOYALTY_DISCOUNT_FRACTION)}
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

          {/* Error */}
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

          {/* Summary */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Total</span>
              <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(total)}
              </span>
            </div>
            {method === 'CASH' && paidNumber > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Paid
                  </span>
                  <span className="text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(paidNumber)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Change
                  </span>
                  <span className="text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(changeAmount)}
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
