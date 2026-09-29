// packages/web/components/pos/PriceOverrideModal.tsx
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
  DollarSign,
  Check,
  Loader2,
  Percent,
} from 'lucide-react';

import { toast } from '../../../utils/toast-manager';
import { formatCurrency } from '../../../utils/formatters';

// ============================================
// TYPES
// ============================================

export interface PriceOverrideData {
  productName: string;
  originalPrice: number;
  newPrice: number;
  reason: string;
}

export interface PriceOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Called when the operator confirms the override. May return a
   * promise — the modal awaits it and only closes on success. A
   * rejected promise keeps the modal open and surfaces the error.
   */
  onConfirm: (data: PriceOverrideData) => Promise<void> | void;
}

type OverrideType = 'fixed' | 'percentage';

interface ReasonOption {
  value: string;
  label: string;
}

const REASON_OPTIONS: ReasonOption[] = [
  { value: 'price_match', label: 'Price Match' },
  { value: 'customer_discount', label: 'Customer Discount' },
  { value: 'damaged_item', label: 'Damaged Item' },
  { value: 'clearance', label: 'Clearance Sale' },
  { value: 'loyalty_discount', label: 'Loyalty Discount' },
  { value: 'volume_discount', label: 'Volume Discount' },
  { value: 'promotional', label: 'Promotional Offer' },
  { value: 'other', label: 'Other' },
];

/**
 * Accepts digits with at most one decimal point and up to two
 * decimal places, or the empty string. Used to filter keystrokes
 * before they reach state, so the value is always parseable.
 */
const DECIMAL_INPUT_PATTERN = /^\d*(\.\d{0,2})?$/;

// ============================================
// HELPERS
// ============================================

function parseMoney(input: string): number {
  if (!input) return 0;
  const n = parseFloat(input);
  return Number.isFinite(n) ? n : 0;
}

function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

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

export function PriceOverrideModal({
  isOpen,
  onClose,
  onConfirm,
}: PriceOverrideModalProps) {
  // ── Form state ────────────────────────────────────────────
  //
  // Prices are kept as raw strings while editing so partial inputs
  // (`""`, `"0."`, `"."`) round-trip cleanly. The numeric value is
  // derived only when needed.

  const [productName, setProductName] = useState('');
  const [originalPriceInput, setOriginalPriceInput] = useState('');
  const [newPriceInput, setNewPriceInput] = useState('');
  const [discountPercentInput, setDiscountPercentInput] = useState('');
  const [overrideType, setOverrideType] = useState<OverrideType>('fixed');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Reset on open transition ──────────────────────────────

  const wasOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (isOpen && !wasOpen) {
      setProductName('');
      setOriginalPriceInput('');
      setNewPriceInput('');
      setDiscountPercentInput('');
      setOverrideType('fixed');
      setReason('');
      setCustomReason('');
      setIsSubmitting(false);
      setSubmitError(null);
    }
  }, [isOpen]);

  // Focus the first input when the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => firstInputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [isOpen]);

  // ── Derived numeric values ────────────────────────────────

  const originalPrice = useMemo(
    () => parseMoney(originalPriceInput),
    [originalPriceInput],
  );
  const newPrice = useMemo(
    () => parseMoney(newPriceInput),
    [newPriceInput],
  );
  const discountPercent = useMemo(
    () => parseMoney(discountPercentInput),
    [discountPercentInput],
  );

  const savings = useMemo(
    () => round2(Math.max(0, originalPrice - newPrice)),
    [originalPrice, newPrice],
  );

  // ── Percentage mode: keep newPrice derived ────────────────
  //
  // In percentage mode the operator sets `originalPrice` and
  // `discountPercent`; the new price is computed. This keeps the
  // percentage and the price from drifting apart.
  //
  // In fixed mode the operator edits `newPrice` directly.

  useEffect(() => {
    if (overrideType !== 'percentage') return;
    if (originalPrice <= 0) return;
    if (discountPercent <= 0) {
      // A 0% discount means the new price equals the original.
      setNewPriceInput(originalPrice.toFixed(2));
      return;
    }
    const computed = round2(originalPrice * (1 - discountPercent / 100));
    setNewPriceInput(computed.toFixed(2));
  }, [overrideType, originalPrice, discountPercent]);

  // ── Validation ────────────────────────────────────────────

  const validationError = useMemo((): string | null => {
    if (!productName.trim()) return 'Product name is required';
    if (originalPrice <= 0) return 'Original price must be greater than zero';
    if (newPrice <= 0) return 'New price must be greater than zero';
    if (newPrice > originalPrice) {
      return 'New price cannot be higher than the original price';
    }
    if (!reason) return 'Please select a reason for the override';
    if (reason === 'other' && !customReason.trim()) {
      return 'Please describe the reason';
    }
    return null;
  }, [productName, originalPrice, newPrice, reason, customReason]);

  const canSubmit = validationError === null && !isSubmitting;

  // ── Input change handlers ─────────────────────────────────

  const handleMoneyInput = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<string>>,
    ) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.target.value;
        if (next === '' || DECIMAL_INPUT_PATTERN.test(next)) {
          setter(next);
          setSubmitError(null);
        }
      },
    [],
  );

  const handleDiscountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      if (next === '' || /^\d*(\.\d{0,2})?$/.test(next)) {
        const parsed = parseMoney(next);
        if (parsed < 0 || parsed > 100) return;
        setDiscountPercentInput(next);
        setSubmitError(null);
      }
    },
    [],
  );

  // ── Submit ────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    if (validationError) {
      // Belt-and-suspenders: the button is disabled when invalid,
      // but Enter or a programmatic call could bypass it.
      toast.warning(validationError);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const compositeReason =
      reason === 'other'
        ? `other: ${customReason.trim()}`
        : reason;

    const payload: PriceOverrideData = {
      productName: productName.trim(),
      originalPrice: round2(originalPrice),
      newPrice: round2(newPrice),
      reason: compositeReason,
    };

    try {
      await onConfirm(payload);
      if (!mountedRef.current) return;
      onClose();
    } catch (error) {
      if (!mountedRef.current) return;
      const message = extractErrorMessage(
        error,
        'Failed to apply the price override',
      );
      console.error('[PriceOverrideModal] submit failed:', message);
      setSubmitError(message);
      toast.error(message);
    } finally {
      if (mountedRef.current) setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    validationError,
    productName,
    originalPrice,
    newPrice,
    reason,
    customReason,
    onConfirm,
    onClose,
  ]);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    onClose();
  }, [isSubmitting, onClose]);

  // ── Keyboard: Escape closes, Cmd/Ctrl+Enter submits ───────

  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canSubmit) void handleSubmit();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, canSubmit, handleClose, handleSubmit]);

  // ── Render ────────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="price-override-title"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2
              id="price-override-title"
              className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"
            >
              <DollarSign
                className="w-5 h-5 text-purple-500"
                aria-hidden="true"
              />
              Price Override
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Override product pricing for special circumstances
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Product Name */}
          <div>
            <label
              htmlFor="price-override-product"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              id="price-override-product"
              ref={firstInputRef}
              type="text"
              value={productName}
              onChange={(e) => {
                setProductName(e.target.value);
                setSubmitError(null);
              }}
              disabled={isSubmitting}
              autoComplete="off"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              placeholder="Enter product name"
            />
          </div>

          {/* Price Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="price-override-original"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Original Price <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                  aria-hidden="true"
                >
                  $
                </span>
                <input
                  id="price-override-original"
                  type="text"
                  inputMode="decimal"
                  value={originalPriceInput}
                  onChange={handleMoneyInput(setOriginalPriceInput)}
                  disabled={isSubmitting}
                  className="w-full pl-7 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums disabled:opacity-50"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="price-override-new"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                New Price <span className="text-red-500">*</span>
                {overrideType === 'percentage' && (
                  <span className="ml-1 text-xs font-normal text-gray-400">
                    (calculated)
                  </span>
                )}
              </label>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                  aria-hidden="true"
                >
                  $
                </span>
                <input
                  id="price-override-new"
                  type="text"
                  inputMode="decimal"
                  value={newPriceInput}
                  onChange={handleMoneyInput(setNewPriceInput)}
                  disabled={isSubmitting || overrideType === 'percentage'}
                  readOnly={overrideType === 'percentage'}
                  className={`w-full pl-7 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums disabled:opacity-50 ${
                    overrideType === 'percentage'
                      ? 'bg-gray-50 dark:bg-gray-800 cursor-not-allowed'
                      : ''
                  }`}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Override Type */}
          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Override Type
            </span>
            <div
              role="radiogroup"
              aria-label="Override type"
              className="flex gap-2"
            >
              <button
                type="button"
                role="radio"
                aria-checked={overrideType === 'fixed'}
                onClick={() => {
                  setOverrideType('fixed');
                  setDiscountPercentInput('');
                  setSubmitError(null);
                }}
                disabled={isSubmitting}
                className={`flex-1 px-4 py-2 rounded-lg border transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                  overrideType === 'fixed'
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <DollarSign className="w-4 h-4" aria-hidden="true" />
                Fixed Amount
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={overrideType === 'percentage'}
                onClick={() => {
                  setOverrideType('percentage');
                  setSubmitError(null);
                }}
                disabled={isSubmitting}
                className={`flex-1 px-4 py-2 rounded-lg border transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                  overrideType === 'percentage'
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Percent className="w-4 h-4" aria-hidden="true" />
                Percentage
              </button>
            </div>
          </div>

          {/* Discount Percentage */}
          {overrideType === 'percentage' && (
            <div>
              <label
                htmlFor="price-override-percent"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Discount Percentage
              </label>
              <div className="relative">
                <input
                  id="price-override-percent"
                  type="text"
                  inputMode="decimal"
                  value={discountPercentInput}
                  onChange={handleDiscountChange}
                  disabled={isSubmitting}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums disabled:opacity-50"
                  placeholder="0"
                />
                <span
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                  aria-hidden="true"
                >
                  %
                </span>
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label
              htmlFor="price-override-reason"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Reason for Override <span className="text-red-500">*</span>
            </label>
            <select
              id="price-override-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (e.target.value !== 'other') setCustomReason('');
                setSubmitError(null);
              }}
              disabled={isSubmitting}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
            >
              <option value="">Select a reason…</option>
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {reason === 'other' && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => {
                  setCustomReason(e.target.value);
                  setSubmitError(null);
                }}
                disabled={isSubmitting}
                placeholder="Describe the reason…"
                aria-label="Custom reason"
                className="mt-2 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              />
            )}
          </div>

          {/* Summary */}
          {originalPrice > 0 && newPrice > 0 && newPrice <= originalPrice && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Original Price
                </span>
                <span className="text-gray-900 dark:text-white tabular-nums">
                  {formatCurrency(originalPrice)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  New Price
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-medium tabular-nums">
                  {formatCurrency(newPrice)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-medium pt-2 border-t border-gray-200 dark:border-gray-600">
                <span className="text-gray-600 dark:text-gray-400">
                  Total Savings
                </span>
                <span className="text-green-600 dark:text-green-400 tabular-nums">
                  {formatCurrency(savings)}
                </span>
              </div>
            </div>
          )}

          {/* Inline validation hint */}
          {validationError && (productName.trim().length > 0 ||
            originalPriceInput.length > 0 ||
            newPriceInput.length > 0 ||
            reason.length > 0) && (
            <div
              role="alert"
              className="text-xs text-red-600 dark:text-red-400"
            >
              {validationError}
            </div>
          )}

          {/* Submit error from onConfirm */}
          {submitError && (
            <div
              role="alert"
              className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2"
            >
              <span>{submitError}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 disabled:opacity-50 focus-ring"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
            >
              {isSubmitting ? (
                <Loader2
                  className="w-4 h-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Check className="w-4 h-4" aria-hidden="true" />
              )}
              {isSubmitting ? 'Applying…' : 'Apply Override'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PriceOverrideModal;
