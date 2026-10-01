'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Gift, Loader2, Info } from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { cartService } from '../../services/cartService';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency } from '../../utils/formatters';

interface CartLoyaltyPointsProps {
  customerId?: string;
  onPointsApplied?: (result: unknown) => void;
  disabled?: boolean;
  className?: string;
  appliedPoints?: number;

  /**
   * ── Phase 2: ISO 4217 currency code for the cart. ─────────────
   *
   * Pass `cart.currency` from the parent. The two amounts this
   * component renders (the applied-points discount and the
   * estimated-discount preview) are denominated in this currency,
   * and `formatCurrency(x, currency)` renders them correctly.
   *
   * ⚠ Optional for backward compatibility with callers that have
   *   not been migrated yet. When omitted, `formatCurrency` falls
   *   back to `'USD'` — which is what every caller got before
   *   Phase 2, so the unmigrated behaviour is unchanged.
   */
  currency?: string;

  /**
   * ── Phase 2: display symbol for `currency`. ───────────────────
   *
   * Currently unused by the render path (the two amounts use
   * `formatCurrency`, which produces its own symbol), but accepted
   * so a caller that has `cart.currencySymbol` in hand can pass it
   * without a TypeScript mismatch. Reserved for future use if a
   * compact symbol-only display is added.
   *
   * ⚠ Optional; safe to omit.
   */
  currencySymbol?: string;
}

interface LoyaltyResponse {
  points: number;
  available?: number;
  used?: number;
  totalEarned?: number;
}

/**
 * Points-per-currency-unit conversion rate.
 *
 * ⚠ SEMANTIC BUG (pre-existing, NOT introduced by Phase 2):
 *   The rate `1 point = 0.10` is a HARDCODED USD-derived rate.
 *   It is mirrored on the backend in
 *   `CartService.applyLoyaltyPoints` and in
 *   `CheckoutService.processCheckout`, both of which do
 *   `points * 0.1`.
 *
 *   On a UGX cart, `1 point = 0.10 UGX` is effectively zero —
 *   redeeming 500 points discounts the cart by UGX 50 against a
 *   subtotal that is typically in the millions. The customer sees
 *   a discount of essentially nothing.
 *
 *   The frontend math here is CORRECT relative to the backend —
 *   it uses the same rate the backend uses, so the "estimated
 *   discount" preview matches what the backend will actually
 *   apply. The bug is in the RATE ITSELF, which must come from
 *   `CartSettings` (or `LoyaltyProgram`) and be currency-aware
 *   before this is correct on non-USD deployments.
 *
 *   Fixing this requires a coordinated backend + frontend change:
 *     1. Add `pointsPerCurrencyUnit` (or equivalent) to
 *        `CartSettings` / `LoyaltyProgram`.
 *     2. Resolve the rate through `currencyService` server-side.
 *     3. Surface the resolved rate on the cart payload.
 *     4. Replace this constant with the resolved rate from the
 *        payload.
 *
 *   Until then, this constant keeps the frontend preview in sync
 *   with the backend's actual behaviour. Do NOT change it in
 *   isolation — the preview would then lie about what the backend
 *   will do.
 */
const POINTS_PER_CURRENCY_UNIT = 10;

function unwrapApiResponse<T>(response: unknown): T | null {
  if (response == null) return null;
  if (typeof response === 'object' && 'data' in (response as any)) {
    const inner = (response as any).data;
    if (inner && typeof inner === 'object') return inner as T;
  }
  return response as T;
}

export function CartLoyaltyPoints({
  customerId,
  onPointsApplied,
  disabled = false,
  className = '',
  appliedPoints = 0,
  // ── Phase 2: currency props ──────────────────────────────
  // Optional for backward compatibility. See the prop JSDoc.
  // `currencySymbol` is accepted for symmetry with the other
  // cart components but is not read by the render path — the
  // two amounts go through `formatCurrency`, which produces
  // its own symbol from `currency`.
  currency,
  currencySymbol: _currencySymbol,
}: CartLoyaltyPointsProps) {
  const { isAuthenticated } = useAuth();

  const [pointsInput, setPointsInput] = useState('');
  const [availablePoints, setAvailablePoints] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Phase 2: resolve the currency code for formatting ────
  // Prefer the prop (authoritative — comes from `cart.currency`,
  // resolved server-side). Fall back to `'USD'` for unmigrated
  // callers so `formatCurrency` behaves exactly as it did before
  // Phase 2.
  const resolvedCurrency = currency ?? 'USD';

  const fetchCustomerPoints = useCallback(async () => {
    if (!customerId || !isAuthenticated) return;

    try {
      setIsFetching(true);
      const response = await api.get(`/customers/${customerId}/loyalty`);
      const payload = unwrapApiResponse<LoyaltyResponse>(response);

      if (payload && typeof payload.points === 'number') {
        setAvailablePoints(payload.points);
      } else {
        setAvailablePoints(0);
      }
    } catch (err) {
      console.warn('Failed to fetch loyalty points:', err);
      setAvailablePoints(0);
    } finally {
      setIsFetching(false);
    }
  }, [customerId, isAuthenticated]);

  useEffect(() => {
    void fetchCustomerPoints();
  }, [fetchCustomerPoints]);

  const handleApplyPoints = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!isAuthenticated) {
        setError('Sign in to redeem loyalty points');
        return;
      }

      if (!customerId) {
        setError('Please associate a customer with this cart');
        return;
      }

      const pointsToRedeem = parseInt(pointsInput, 10);
      if (!Number.isFinite(pointsToRedeem) || pointsToRedeem <= 0) {
        setError('Please enter valid points to redeem');
        return;
      }

      if (pointsToRedeem > availablePoints) {
        setError(`You only have ${availablePoints} points available`);
        return;
      }

      setError(null);
      setIsLoading(true);

      try {
        const result = await cartService.applyLoyaltyPoints(
          customerId,
          pointsToRedeem,
        );
        toast.success(`${pointsToRedeem} loyalty points applied`);
        setPointsInput('');
        await fetchCustomerPoints();
        window.dispatchEvent(new CustomEvent('cart:updated'));
        onPointsApplied?.(result);
      } catch (err: any) {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to apply loyalty points';
        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [
      isAuthenticated,
      customerId,
      pointsInput,
      availablePoints,
      fetchCustomerPoints,
      onPointsApplied,
    ],
  );

  const estimatedDiscount = useMemo(() => {
    const value = parseInt(pointsInput, 10);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return value / POINTS_PER_CURRENCY_UNIT;
  }, [pointsInput]);

  const canRedeem =
    isAuthenticated &&
    Boolean(customerId) &&
    availablePoints > 0 &&
    !disabled;

  if (!isAuthenticated || !customerId) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-secondary-500 shrink-0" />
          <span className="font-medium text-gray-900 dark:text-white">
            Loyalty Points
          </span>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            Available:
          </span>
          {isFetching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-secondary-500" />
          ) : (
            <span className="font-medium text-secondary-600 dark:text-secondary-400 tabular-nums">
              {availablePoints}
            </span>
          )}
        </div>
      </div>

      {appliedPoints > 0 && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-secondary-50 dark:bg-secondary-900/20 border border-secondary-200 dark:border-secondary-800">
          <span className="text-sm text-secondary-700 dark:text-secondary-300">
            <strong className="tabular-nums">{appliedPoints}</strong>{' '}
            points applied
          </span>
          <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300 tabular-nums">
            {/*
              ── Phase 2: format in the cart's own currency ──
              `formatCurrency(x, resolvedCurrency)` renders the
              discount with the correct ISO code. When the caller
              is unmigrated (`currency` undefined),
              `resolvedCurrency` is `'USD'` and the render is
              identical to the pre-Phase-2 behaviour.
            */}
            −{formatCurrency(
              appliedPoints / POINTS_PER_CURRENCY_UNIT,
              resolvedCurrency,
            )}
          </span>
        </div>
      )}

      {canRedeem ? (
        <>
          <form
            onSubmit={handleApplyPoints}
            className="flex flex-col sm:flex-row gap-2"
          >
            <div className="flex-1">
              <input
                type="number"
                min="0"
                max={availablePoints}
                step="1"
                value={pointsInput}
                onChange={(e) => {
                  setPointsInput(e.target.value);
                  setError(null);
                }}
                placeholder="Points to redeem"
                disabled={disabled || isLoading || isFetching}
                inputMode="numeric"
                className={`w-full px-3 py-2 bg-white dark:bg-gray-700 border rounded-lg focus:ring-2 focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 transition-colors tabular-nums ${
                  error
                    ? 'border-danger-500 focus:ring-danger-500'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-secondary-500'
                }`}
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? 'loyalty-error' : undefined}
              />
            </div>

            <button
              type="submit"
              disabled={
                disabled || isLoading || !pointsInput || isFetching
              }
              className="px-4 py-2 bg-secondary-600 hover:bg-secondary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[100px] shadow-soft focus-ring"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Redeeming…
                </>
              ) : (
                'Redeem'
              )}
            </button>
          </form>

          {estimatedDiscount > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Info className="w-4 h-4 shrink-0" />
              <span>
                Estimated discount:{' '}
                <strong className="text-success-600 dark:text-success-400 tabular-nums">
                  {/* ── Phase 2: same currency resolution ── */}
                  {formatCurrency(estimatedDiscount, resolvedCurrency)}
                </strong>
              </span>
            </div>
          )}

          {error && (
            <p
              id="loyalty-error"
              className="text-sm text-danger-600 dark:text-danger-400"
            >
              {error}
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <Info className="w-3 h-3 shrink-0" />
          {isFetching
            ? 'Loading balance…'
            : availablePoints === 0
            ? 'No loyalty points available for this customer'
            : 'Loyalty redemption unavailable'}
        </p>
      )}
    </div>
  );
}

export default CartLoyaltyPoints;
