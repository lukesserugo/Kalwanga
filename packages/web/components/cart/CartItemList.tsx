'use client';

import React from 'react';
import { AnimatePresence } from 'framer-motion';
import CartItemCard from './CartItemCard';
import EmptyCart from './EmptyCart';
import CartSkeleton from './CartSkeleton';

interface CartItemType {
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

// ✅ FIXED: Added 'export' keyword to make the interface available
export interface CartItemListProps {
  items: CartItemType[];
  onUpdateQuantity: (itemId: string, quantity: number) => Promise<void> | void;
  onRemove: (itemId: string) => Promise<void> | void;
  isLoading?: boolean;
  isUpdating?: string | null;
  disabled?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  emptyActionHref?: string;
  onEmptyAction?: () => void;
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
  emptyActionHref = '/',
  onEmptyAction,
}: CartItemListProps) {
  if (isLoading) {
    return <CartSkeleton count={3} />;
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
      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <CartItemCard
            key={item.id}
            {...item}
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
