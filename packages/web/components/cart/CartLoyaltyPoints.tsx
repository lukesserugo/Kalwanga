// D:\Projects\Kalwanga\packages\web\components\cart\CartLoyaltyPoints.tsx

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
  /**
   * Points already applied to the cart. When > 0, the widget shows
   * the current redemption amount.
   */
  appliedPoints?: number;
}

interface LoyaltyResponse {
  points: number;
  available?: number;
  used?: number;
  totalEarned?: number;
}

const POINTS_PER_CURRENCY_UNIT = 10; // 10 points = $1
const MAX_REDEMPTION_RATIO = 0.5; // cap at 50% of cart subtotal

export function CartLoyaltyPoints({
  customerId,
  onPointsApplied,
  disabled = false,
  className = '',
  appliedPoints = 0,
}: CartLoyaltyPointsProps) {
  const { isAuthenticated } = useAuth();

  const [pointsInput, setPointsInput] = useState('');
  const [availablePoints, setAvailablePoints] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchCustomerPoints = useCallback(async () => {
    if (!customerId || !isAuthenticated) return;

    try {
      setIsFetching(true);
      const response = await api.get<LoyaltyResponse>(
        `/customers/${customerId}/loyalty`,
      );
      // Backend may return the payload directly or under `.data`.
      const payload =
        response && typeof response === 'object' && 'points' in response
          ? (response as LoyaltyResponse)
          : (response as unknown as { data: LoyaltyResponse })?.data;

      if (payload && typeof payload.points === 'number') {
        setAvailablePoints(payload.points);
      } else {
        setAvailablePoints(0);
      }
    } catch (err) {
      // Loyalty lookup is best-effort. The widget simply doesn't show
      // a balance when the endpoint fails.
      console.warn('Failed to fetch loyalty points:', err);
      setAvailablePoints(0);
    } finally {
      setIsFetching(false);
    }
  }, [customerId, isAuthenticated]);

  useEffect(() => {
    void fetchCustomerPoints();
  }, [fetchCustomerPoints]);

  // ============================================
  // HANDLERS
  // ============================================

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
      if (isNaN(pointsToRedeem) || pointsToRedeem <= 0) {
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
        toast.success(
          `${pointsToRedeem} loyalty points applied`,
        );
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

  // ============================================
  // DERIVED
  // ============================================

  const estimatedDiscount = useMemo(() => {
    const value = parseInt(pointsInput, 10);
    if (isNaN(value) || value <= 0) return 0;
    return value / POINTS_PER_CURRENCY_UNIT;
  }, [pointsInput]);

  const canRedeem =
    isAuthenticated &&
    Boolean(customerId) &&
    availablePoints > 0 &&
    !disabled;

  // ============================================
  // RENDER
  // ============================================

  // Guests and carts without a customer never see this widget.
  if (!isAuthenticated || !customerId) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-indigo-500 shrink-0" />
          <span className="font-medium text-gray-900 dark:text-white">
            Loyalty Points
          </span>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            Available:
          </span>
          {isFetching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
          ) : (
            <span className="font-medium text-indigo-600 dark:text-indigo-400 tabular-nums">
              {availablePoints}
            </span>
          )}
        </div>
      </div>

      {/* Already applied */}
      {appliedPoints > 0 && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
          <span className="text-sm text-indigo-700 dark:text-indigo-300">
            <strong className="tabular-nums">{appliedPoints}</strong>{' '}
            points applied
          </span>
          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300 tabular-nums">
            −{formatCurrency(appliedPoints / POINTS_PER_CURRENCY_UNIT)}
          </span>
        </div>
      )}

      {/* Form */}
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
                className={`w-full px-3 py-2 bg-white dark:bg-gray-700 border rounded-lg focus:ring-2 focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 transition-colors ${
                  error
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-indigo-500'
                }`}
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? 'loyalty-error' : undefined}
              />
            </div>

            <button
              type="submit"
              disabled={
                disabled ||
                isLoading ||
                !pointsInput ||
                isFetching
              }
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[100px] shadow-sm"
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
                <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(estimatedDiscount)}
                </strong>
              </span>
            </div>
          )}

          {error && (
            <p
              id="loyalty-error"
              className="text-sm text-red-600 dark:text-red-400"
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
