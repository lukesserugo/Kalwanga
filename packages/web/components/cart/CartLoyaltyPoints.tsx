// D:\Projects\Kalwanga\packages\web\components\cart\CartLoyaltyPoints.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { Gift, Loader2, Info } from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { cartService } from '../../services/cartService';
import { api } from '../../services/api';

interface CartLoyaltyPointsProps {
  customerId?: string;
  onPointsApplied?: (result: any) => void;
  disabled?: boolean;
  className?: string;
}

interface LoyaltyResponse {
  points: number;
}

export function CartLoyaltyPoints({
  customerId,
  onPointsApplied,
  disabled = false,
  className = '',
}: CartLoyaltyPointsProps) {
  const [points, setPoints] = useState<string>('');
  const [availablePoints, setAvailablePoints] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch customer loyalty points
  useEffect(() => {
    if (customerId) {
      fetchCustomerPoints();
    }
  }, [customerId]);

  const fetchCustomerPoints = async () => {
    if (!customerId) return;
    
    try {
      setIsFetching(true);
      const response = await api.get(`/customers/${customerId}/loyalty`);
      // ✅ FIX: response is the data directly
      if (response && typeof response === 'object') {
        const loyaltyData = response as LoyaltyResponse;
        if (loyaltyData.points !== undefined) {
          setAvailablePoints(loyaltyData.points);
        }
      }
    } catch (error) {
      console.warn('Failed to fetch loyalty points:', error);
    } finally {
      setIsFetching(false);
    }
  };

  const handleApplyPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerId) {
      setError('Please select a customer first');
      return;
    }

    const pointsToRedeem = parseInt(points);
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
      const result = await cartService.applyLoyaltyPoints(customerId, pointsToRedeem);
      toast.success(`${pointsToRedeem} loyalty points applied successfully`);
      setPoints('');
      fetchCustomerPoints(); // Refresh points
      if (onPointsApplied) {
        onPointsApplied(result);
      }
    } catch (error: any) {
      setError(error?.message || 'Failed to apply loyalty points');
      toast.error(error?.message || 'Failed to apply loyalty points');
    } finally {
      setIsLoading(false);
    }
  };

  const getEstimatedDiscount = (): number => {
    const pointsToRedeem = parseInt(points) || 0;
    return pointsToRedeem * 0.1; // 10 points = $1
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-indigo-500" />
          <span className="font-medium text-gray-900 dark:text-white">Loyalty Points</span>
        </div>
        {customerId && (
          <div className="flex items-center gap-1 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Available:</span>
            <span className="font-medium text-indigo-600 dark:text-indigo-400">
              {isFetching ? '...' : availablePoints}
            </span>
          </div>
        )}
      </div>

      <form onSubmit={handleApplyPoints} className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <input
            type="number"
            min="0"
            max={availablePoints}
            value={points}
            onChange={(e) => {
              setPoints(e.target.value);
              setError(null);
            }}
            placeholder="Enter points to redeem"
            disabled={disabled || isLoading || !customerId || isFetching}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={disabled || isLoading || !customerId || !points || isFetching}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[100px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Applying...
            </>
          ) : (
            'Redeem'
          )}
        </button>
      </form>

      {points && parseInt(points) > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Info className="w-4 h-4" />
          <span>
            Estimated discount: <strong className="text-green-600 dark:text-green-400">
              ${getEstimatedDiscount().toFixed(2)}
            </strong>
            {!customerId && (
              <span className="text-yellow-500 ml-1">(customer required)</span>
            )}
          </span>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {!customerId && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <Info className="w-3 h-3 inline mr-1" />
          Associate a customer to use loyalty points
        </p>
      )}
    </div>
  );
}

export default CartLoyaltyPoints;
