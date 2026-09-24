// D:\Projects\Kalwanga\packages\web\components\pos\CartSummary.tsx

'use client';

import { ShoppingCart, Trash2 } from 'lucide-react';
import { CartTotalsPreview } from './CartTotalsPreview';
import { formatCurrency } from '../../utils/formatters';
import type { Cart } from '../../services/saleService';

interface CartSummaryProps {
  cart: Cart;
  /** Current loyalty points to redeem, from the cashier's input. */
  loyaltyPointsToUse?: number;
  /** Customer's loyalty balance for the cap calculation. */
  availableLoyaltyPoints?: number;
  /** Click handler for the "clear cart" button. */
  onClear?: () => void;
  /** Optional class applied to the outer wrapper. */
  className?: string;
}

export function CartSummary({
  cart,
  loyaltyPointsToUse = 0,
  availableLoyaltyPoints = 0,
  onClear,
  className = '',
}: CartSummaryProps) {
  const itemCount = cart.itemCount || cart.items?.length || 0;

  // Prefer the persisted promotion breakdown from the cart when
  // present (server-authoritative), else fall back to whatever the
  // caller is previewing locally.
  const promotionDiscount =
    cart.promotionDiscount ?? (cart.discount > 0 ? cart.discount : 0);
  const promotionCode = cart.promotionCode ?? null;

  return (
    <div
      className={`rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Cart
          </h2>
          <span className="text-xs tabular-nums px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            {itemCount}
          </span>
        </div>
        {onClear && itemCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors focus-ring"
            aria-label="Clear cart"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-4">
        <CartTotalsPreview
          total={cart.subtotal + cart.tax}
          promotionDiscount={promotionDiscount}
          promotionCode={promotionCode}
          loyaltyPointsToUse={loyaltyPointsToUse}
          availableLoyaltyPoints={availableLoyaltyPoints}
        />
      </div>
    </div>
  );
}

export default CartSummary;
