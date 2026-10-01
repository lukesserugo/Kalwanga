'use client';

import React from 'react';
import { AnimatePresence } from 'framer-motion';
import CartItemCard from './CartItemCard';
import EmptyCart from './EmptyCart';
import CartSkeleton from './CartSkeleton';

export interface CartItemType {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  images?: string[];
  variantName?: string;
  availableStock: number;
  isInStock: boolean;
}

export interface CartItemListProps {
  items: CartItemType[];
  onUpdateQuantity: (
    itemId: string,
    quantity: number,
  ) => Promise<void> | void;
  onRemove: (itemId: string) => Promise<void> | void;
  isLoading?: boolean;
  isUpdating?: string | null;
  disabled?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  emptyActionHref?: string;
  onEmptyAction?: () => void;
  skeletonCount?: number;

  /**
   * ── Phase 2: ISO 4217 currency code for every amount on the ──
   *   lines in this list.
   *
   * Pass `cart.currency` from the parent. Every `CartItemCard` in
   * the list receives it as `currency`, and each card formats its
   * `unitPrice` and `total` in that currency.
   *
   * ⚠ REQUIRED, not optional. `CartItemCard.currency` is required,
   *   so this list must supply it. Making the prop required here
   *   too means the compiler catches a mount site that forgot to
   *   pass it — rather than silently falling back to USD and
   *   reintroducing the hardcoded-dollar bug on that site.
   *
   * See `Cart.currency` in `packages/web/types/cart.ts` for the
   * resolution chain (business unit → platform default).
   */
  currency: string;
}

export function CartItemList({
  items,
  onUpdateQuantity,
  onRemove,
  isLoading = false,
  isUpdating = null,
  disabled = false,
  emptyTitle = 'Your cart is empty',
  emptyDescription = 'Browse our products and add items to your cart.',
  emptyActionLabel = 'Start Shopping',
  emptyActionHref = '/shop',
  onEmptyAction,
  skeletonCount = 3,
  // ── Phase 2: currency forwarded to every CartItemCard ────
  currency,
}: CartItemListProps) {
  if (isLoading) {
    return <CartSkeleton count={skeletonCount} />;
  }

  if (items.length === 0) {
    return (
      <EmptyCart
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        actionHref={emptyActionHref}
        onAction={onEmptyAction}
      />
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout" initial={false}>
        {items.map((item) => (
          <CartItemCard
            key={item.id}
            id={item.id}
            productId={item.productId}
            productName={item.productName}
            sku={item.sku}
            quantity={item.quantity}
            unitPrice={item.unitPrice}
            total={item.total}
            images={item.images}
            variantName={item.variantName}
            availableStock={item.availableStock}
            isInStock={item.isInStock}
            onUpdateQuantity={onUpdateQuantity}
            onRemove={onRemove}
            isUpdating={isUpdating === item.id}
            disabled={disabled}
            // ── Phase 2: currency forwarded to the card ──
            currency={currency}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

export default CartItemList;
