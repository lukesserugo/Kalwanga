// D:\Projects\Kalwanga\packages\web\components\cart\CartItemList.tsx

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
  /**
   * ID of the item currently being updated, if any. The matching card
   * shows a loading spinner on its quantity stepper.
   */
  isUpdating?: string | null;
  disabled?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  emptyActionHref?: string;
  onEmptyAction?: () => void;
  /**
   * How many skeleton rows to render while loading. Defaults to 3.
   */
  skeletonCount?: number;
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
}: CartItemListProps) {
  // ============================================
  // LOADING
  // ============================================

  if (isLoading) {
    return <CartSkeleton count={skeletonCount} />;
  }

  // ============================================
  // EMPTY
  // ============================================

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

  // ============================================
  // LIST
  // ============================================

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
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

export default CartItemList;
