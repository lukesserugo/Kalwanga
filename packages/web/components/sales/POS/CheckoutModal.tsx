// packages/web/components/sales/POS/CheckoutModal.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Percent,
  Receipt,
} from 'lucide-react';
import { checkoutService } from '../../../services/checkoutService';
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

export interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;

  /** Total amount to charge (after tax and discount). */
  total: number;

  /** Currency code, e.g. 'USD'. Defaults to 'USD'. */
  currency?: string;

  /** Cart id — passed through to checkoutService. */
  cartId?: string;

  /** Optional customer attached to the sale. */
  customer?: CheckoutCustomer | null;

  /** Discount already applied to the cart (display only here). */
  discount?: number;

  /** Active shift — required to process a sale. */
  shift?: CheckoutShift | null;

  /** Optional notes forwarded to checkoutService. */
  notes?: string;

  /**
   * Optional client-supplied idempotency key. When provided, it is sent
   * as the `Idempotency-Key` header to the backend, and retries with
   * the same value return the original sale instead of creating a
   * duplicate. When omitted, the request behaves exactly as before —
   * no idempotency, new sale on every call.
   *
   * Lifecycle belongs to the caller:
   *   - The caller generates a key when the operator initiates a sale.
   *   - The same key is passed to every retry of that sale.
   *   - The caller clears the key after a successful checkout.
   *
   * This component only forwards it; it never generates or clears it.
   */
  idempotencyKey?: string;

  /**
   * Called after checkout succeeds.
   * Receives the raw result from checkoutService.processCheckout.
   */
  onPaymentComplete: (result: any, method: CheckoutPaymentMethod, details: CheckoutDetails) => void | Promise<void>;

  /** Called when the user cancels / closes the modal. */
  onCancel?: () => void;

  /** External processing lock (e.g. from a parent that owns the request). */
  isProcessing?: boolean;
}

export interface CheckoutDetails {
  paidAmount?: number;
  changeAmount?: number;
  notes?: string;
  reference?: string;
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

// ============================================
// COMPONENT
// ============================================

export function CheckoutModal({
  isOpen,
  onClose,
  total,
  currency = 'USD',
  cartId,
  customer = null,
  discount = 0,
  shift = null,
  notes: initialNotes = '',
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

  const processing = externalProcessing || internalProcessing;

  // Reset internal state every time the modal opens, so a prior
  // session never leaks into the next one.
  //
  // NOTE: we deliberately do NOT touch `idempotencyKey` here. That
  // value is owned by the parent and must survive open/close cycles
  // within the same logical checkout attempt.
  useEffect(() => {
    if (isOpen) {
      setMethod('CASH');
      setPaidAmount('');
      setReference('');
      setNotes(initialNotes);
      setError(null);
      setInternalProcessing(false);
    }
  }, [isOpen, initialNotes]);

  // ============================================
  // DERIVED
  // ============================================

  const paidNumber = useMemo(() => {
    const n = parseFloat(paidAmount);
    return Number.isFinite(n) ? n : 0;
  }, [paidAmount]);

  const changeAmount = useMemo(
    () => Math.max(0, paidNumber - total),
    [paidNumber, total]
  );

  const cashInsufficient = method === 'CASH' && paidNumber < total;

  const loyaltyPointsRequired = useMemo(() => {
    if (method !== 'LOYALTY_POINTS') return 0;
    // Adjust the divisor if your loyalty program differs.
    // Convention here: 1 point = $0.01.
    return Math.ceil(total * 100);
  }, [method, total]);

  const loyaltyInsufficient = useMemo(() => {
    if (method !== 'LOYALTY_POINTS') return false;
    return (customer?.loyaltyPoints ?? 0) < loyaltyPointsRequired;
  }, [method, customer?.loyaltyPoints, loyaltyPointsRequired]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleClose = useCallback(() => {
    if (processing) return;
    onCancel?.();
    onClose();
  }, [processing, onCancel, onClose]);

  const handleQuickCash = useCallback(
    (amount: number) => {
      setPaidAmount(amount.toFixed(2));
      setError(null);
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    setError(null);

    if (!shift) {
      setError('Please open a shift before processing a sale.');
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

    const effectivePaidAmount =
      method === 'CASH' ? paidNumber : total;

    try {
      setInternalProcessing(true);

      const result = await checkoutService.processCheckout({
        cartId,
        customerId: customer?.id,
        paymentMethod: method,
        paidAmount: effectivePaidAmount,
        discount,
        notes: notes.trim() || undefined,
        cashRegisterId: shift.cashRegisterId,
        cashRegisterSessionId: shift.id,
        applyLoyaltyPoints: method === 'LOYALTY_POINTS',
        // ✅ Forward the caller-owned key so the backend persists /
        //    dedupes on it. When undefined, the request is unchanged
        //    from the pre-idempotency behavior.
        idempotencyKey,
      });

      const details: CheckoutDetails = {
        paidAmount: effectivePaidAmount,
        changeAmount: method === 'CASH' ? changeAmount : 0,
        notes: notes.trim() || undefined,
        reference: reference.trim() || undefined,
      };

      await onPaymentComplete(result, method, details);
      toast.success('Checkout completed successfully!');
    } catch (err: any) {
      console.error('Checkout failed:', err);
      const message = err?.message || 'Checkout failed. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setInternalProcessing(false);
    }
  }, [
    shift,
    method,
    cashInsufficient,
    loyaltyInsufficient,
    paidNumber,
    total,
    cartId,
    customer?.id,
    discount,
    notes,
    reference,
    changeAmount,
    idempotencyKey,
    onPaymentComplete,
  ]);

  // Keyboard: Esc closes, Cmd/Ctrl+Enter submits.
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!processing) handleSubmit();
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              disabled={processing}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-500" />
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
            onClick={handleClose}
            disabled={processing}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Customer */}
          {customer && (
            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
              <User className="w-4 h-4 flex-shrink-0" />
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

          {/* Shift missing warning */}
          {!shift && (
            <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>No open shift. Please open a shift first.</span>
            </div>
          )}

          {/* Payment method selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PAYMENT_METHODS.map((m) => {
                const Icon = m.icon;
                const active = method === m.id;
                const disabled =
                  m.id === 'LOYALTY_POINTS' && !customer;
                return (
                  <button
                    key={m.id}
                    type="button"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount Paid
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder={total.toFixed(2)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={processing}
                    autoFocus
                  />
                </div>
              </div>

              {/* Quick-cash shortcuts */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickCash(total)}
                  disabled={processing}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Exact ({formatCurrency(total)})
                </button>
                {[5, 10, 20, 50, 100].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => handleQuickCash(v)}
                    disabled={processing || v < total}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30"
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
                  <span className="text-lg font-bold text-green-700 dark:text-green-300">
                    {formatCurrency(changeAmount)}
                  </span>
                </div>
              )}
            </div>
          )}

          {method === 'CARD' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reference / Last 4 digits
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. 4242"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={processing}
              />
            </div>
          )}

          {method === 'MOBILE_MONEY' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Transaction Reference
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. MP123456789"
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
                <span className="font-medium text-gray-900 dark:text-white">
                  {loyaltyPointsRequired}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Available
                </span>
                <span
                  className={`font-medium ${
                    loyaltyInsufficient
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}
                >
                  {customer?.loyaltyPoints ?? 0}
                </span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional information..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              disabled={processing}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Summary */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Total
              </span>
              <span className="font-bold text-gray-900 dark:text-white">
                {formatCurrency(total)}
              </span>
            </div>
            {method === 'CASH' && paidNumber > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Paid
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {formatCurrency(paidNumber)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Change
                  </span>
                  <span className="text-gray-900 dark:text-white">
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
            onClick={handleSubmit}
            disabled={
              processing ||
              !shift ||
              (method === 'CASH' && cashInsufficient) ||
              (method === 'LOYALTY_POINTS' && loyaltyInsufficient)
            }
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {processing ? 'Processing…' : 'Complete Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CheckoutModal;
